import logging
import re
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.providers.registry import get_provider
from .models import WhatsAppNumber, Contact

logger = logging.getLogger(__name__)

PHONE_RE = re.compile(r'[^\d]')


def _clean_phone(raw: str) -> str | None:
    """
    Normalise phone number to international format without +.
    Handles common Saudi formats:
      504259325      → 966504259325   (9 digits starting with 5)
      0504259325     → 966504259325   (10 digits with leading 0)
      00966504259325 → 966504259325   (double-zero international)
      +966504259325  → 966504259325   (stripped in PHONE_RE)
      966504259325   → 966504259325   (already correct)
    """
    cleaned = PHONE_RE.sub('', raw.strip())
    if not cleaned:
        return None

    # Strip double-zero international prefix
    if cleaned.startswith('00'):
        cleaned = cleaned[2:]

    # Saudi local: 9 digits starting with 5  →  add 966
    if len(cleaned) == 9 and cleaned.startswith('5'):
        cleaned = '966' + cleaned

    # Saudi local with leading 0: 0XXXXXXXXX (10 digits) → strip 0 + add 966
    elif cleaned.startswith('0') and len(cleaned) == 10:
        cleaned = '966' + cleaned[1:]

    return cleaned if cleaned.isdigit() else None


def _personalise(template: str, name: str) -> str:
    msg = template
    msg = msg.replace('[الاسم]', name)
    msg = msg.replace('{name}', name)
    return msg


def _save_to_conversation(wa_number, phone: str, name: str, body: str,
                           provider_message_id: str, has_image: bool = False) -> None:
    """
    Persist a sent broadcast message into the conversation history.
    Creates Contact and Conversation if they don't exist yet.
    Wrapped in try/except so a save failure never blocks the send response.
    """
    try:
        from apps.conversations.models import Conversation, Message

        tenant = wa_number.tenant

        # Contact — unique per (tenant, phone)
        contact, created = Contact.objects.get_or_create(
            tenant=tenant,
            phone=phone,
            defaults={'name': name or ''},
        )
        if not created and name and not contact.name:
            contact.name = name
            contact.save(update_fields=['name'])

        # Conversation — reuse the existing open one for this contact, or create
        conv = (
            Conversation.objects.filter(
                contact=contact, whatsapp_number=wa_number, status='open'
            ).first()
            or Conversation.objects.filter(contact=contact, whatsapp_number=wa_number).first()
        )
        if not conv:
            conv = Conversation.objects.create(
                tenant=tenant,
                contact=contact,
                whatsapp_number=wa_number,
                status='open',
                category='other',
            )

        # Message record
        Message.objects.create(
            tenant=tenant,
            conversation=conv,
            direction='outbound',
            message_type='text',
            body=body,
            provider_message_id=provider_message_id,
            status='sent',
            metadata={'source': 'broadcast', 'has_image': has_image},
        )

        conv.last_message_at = timezone.now()
        conv.save(update_fields=['last_message_at', 'updated_at'])

    except Exception as exc:
        logger.warning(f"Could not save broadcast message to DB for {phone}: {exc}")


class BroadcastSendOneView(APIView):
    """Send a single personalised WhatsApp message — called per-recipient by the frontend."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        phone_raw = str(request.data.get('phone', '')).strip()
        message   = str(request.data.get('message', '')).strip()
        name      = str(request.data.get('name',  '')).strip()
        image_b64 = request.data.get('image', '')
        filename  = str(request.data.get('filename', 'image.jpg')).strip()
        mimetype  = str(request.data.get('mimetype', 'image/jpeg')).strip()

        if not phone_raw or not message:
            return Response({'status': 'failed', 'reason': 'phone و message مطلوبان'}, status=400)

        phone = _clean_phone(phone_raw)
        if not phone:
            return Response({'status': 'failed', 'reason': 'رقم غير صالح'})

        wa_number = WhatsAppNumber.objects.filter(status='active').exclude(provider='mock').first()
        if not wa_number:
            return Response({'status': 'failed', 'reason': 'لا يوجد رقم واتساب مفعّل'}, status=400)

        provider = get_provider(wa_number.provider, wa_number)

        try:
            if image_b64:
                result = provider.send_image_message(
                    to=phone, body=message, from_number=wa_number.phone_number,
                    image_b64=image_b64, filename=filename, mimetype=mimetype,
                )
            else:
                result = provider.send_text_message(
                    to=phone, body=message, from_number=wa_number.phone_number,
                )

            message_id = result.get('message_id', '')
            logger.info(f"Broadcast sent to {phone}")

            # Persist to conversation history
            _save_to_conversation(
                wa_number=wa_number, phone=phone, name=name,
                body=message, provider_message_id=message_id,
                has_image=bool(image_b64),
            )

            return Response({'status': 'sent', 'message_id': message_id})

        except Exception as e:
            err = str(e)
            if '466' in err:
                reason = 'الرقم غير مسجل في واتساب'
            elif '400' in err:
                reason = 'رقم غير صالح'
            elif '401' in err or '403' in err:
                reason = 'خطأ في المصادقة'
            elif '429' in err:
                reason = 'تم تجاوز حد الإرسال — انتظر قليلاً'
            else:
                reason = err[:80]
            logger.error(f"Broadcast failed for {phone}: {err}")
            return Response({'status': 'failed', 'reason': reason})


class BroadcastSendView(APIView):
    """Legacy bulk endpoint (kept for compatibility)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({'error': 'استخدم نقطة النهاية الجديدة send-one/'}, status=410)
