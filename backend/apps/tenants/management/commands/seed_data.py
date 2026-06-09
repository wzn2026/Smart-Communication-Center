from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.tenants.models import Tenant, TenantMembership, ApiKey, SubscriptionPlan, Subscription
from django.utils import timezone
from apps.channels.models import WhatsAppNumber, Contact
from apps.conversations.models import Conversation, Message
from apps.knowledge.models import KnowledgeBase, KnowledgeItem, QuickReplyTemplate


class Command(BaseCommand):
    help = 'Seed development data: tenants, WhatsApp numbers, knowledge base, sample conversations.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('Seeding Smart Communication Center...'))

        # ── Users ──────────────────────────────────────────────────────────────
        admin = self._get_or_create_user(
            'admin', 'admin@scc.local', 'admin123', is_staff=True, is_superuser=True
        )
        agent = self._get_or_create_user(
            'agent1', 'agent1@scc.local', 'agent123',
            first_name='أحمد', last_name='السالم'
        )
        self.stdout.write('  ✓ Users: admin / agent1')

        # ── Tenants ────────────────────────────────────────────────────────────
        nedaa, _ = Tenant.objects.get_or_create(
            slug='nedaa',
            defaults={
                'name': 'منصة نداء',
                'tenant_type': 'platform',
                'status': 'active',
                'plan': 'enterprise',
            }
        )
        fund, _ = Tenant.objects.get_or_create(
            slug='family-fund-sample',
            defaults={
                'name': 'صندوق الأسرة النموذجي',
                'tenant_type': 'family_fund',
                'status': 'active',
                'plan': 'basic',
            }
        )
        self.stdout.write('  ✓ Tenants: Nedaa, Family Fund Sample')

        # ── Memberships ────────────────────────────────────────────────────────
        TenantMembership.objects.get_or_create(tenant=nedaa, user=admin, defaults={'role': 'owner'})
        TenantMembership.objects.get_or_create(tenant=nedaa, user=agent, defaults={'role': 'agent'})
        TenantMembership.objects.get_or_create(tenant=fund, user=admin, defaults={'role': 'owner'})

        # ── API Keys ───────────────────────────────────────────────────────────
        if not nedaa.api_keys.filter(is_active=True).exists():
            _, raw = ApiKey.generate(nedaa, 'Nedaa Platform Key')
            self.stdout.write(f'  ✓ Nedaa API Key: {raw}')
        if not fund.api_keys.filter(is_active=True).exists():
            _, raw = ApiKey.generate(fund, 'Family Fund Key')
            self.stdout.write(f'  ✓ Family Fund API Key: {raw}')

        # ── WhatsApp Numbers ───────────────────────────────────────────────────
        nedaa_wa, _ = WhatsAppNumber.objects.get_or_create(
            tenant=nedaa, phone_number='+966500000001',
            defaults={'provider': 'mock', 'display_name': 'نداء — دعم العملاء', 'status': 'active'}
        )
        fund_wa, _ = WhatsAppNumber.objects.get_or_create(
            tenant=fund, phone_number='+966500000002',
            defaults={'provider': 'mock', 'display_name': 'صندوق الأسرة — استفسارات', 'status': 'active'}
        )
        self.stdout.write('  ✓ WhatsApp numbers created')

        # ── Knowledge Bases ────────────────────────────────────────────────────
        nedaa_kb, _ = KnowledgeBase.objects.get_or_create(
            tenant=nedaa, name='قاعدة معرفة نداء',
            defaults={'description': 'أسئلة شائعة لمنصة نداء', 'is_active': True}
        )
        fund_kb, _ = KnowledgeBase.objects.get_or_create(
            tenant=fund, name='قاعدة معرفة الصندوق',
            defaults={'description': 'أسئلة شائعة لصندوق الأسرة', 'is_active': True}
        )

        # ── Nedaa FAQ ──────────────────────────────────────────────────────────
        nedaa_faqs = [
            ('كيف أسجل في منصة نداء؟',
             'يمكنك التسجيل من خلال زيارة موقع نداء الرسمي والنقر على زر "إنشاء حساب"، ثم إدخال بياناتك الشخصية وتفعيل الحساب عبر البريد الإلكتروني.',
             'تسجيل', 'تسجيل,حساب,اشتراك,جديد', False, 10),
            ('كيف أعيد تعيين كلمة المرور؟',
             'انقر على "نسيت كلمة المرور" في صفحة تسجيل الدخول، وأدخل بريدك الإلكتروني. ستصلك رسالة بتعليمات إعادة التعيين خلال دقائق.',
             'حساب', 'كلمة مرور,نسيت,استعادة,تغيير', False, 9),
            ('ما هي خطط الاشتراك المتاحة؟',
             'تقدم نداء ثلاث خطط: المجانية، والأساسية (99 ريال/شهر)، والمتقدمة (299 ريال/شهر). تواصل معنا لمعرفة مزايا كل خطة.',
             'اشتراك', 'خطة,اشتراك,سعر,تكلفة,رسوم', False, 8),
            ('كيف أتواصل مع الدعم الفني؟',
             'يمكنك التواصل مع فريق الدعم الفني عبر البريد الإلكتروني support@nedaa.sa أو عبر هذا الرقم في أوقات الدوام الرسمي.',
             'دعم', 'دعم,مساعدة,تواصل,مشكلة,تقنية', False, 7),
            ('هل تدعم المنصة اللغة العربية؟',
             'نعم، منصة نداء مصممة أصلاً باللغة العربية وتدعم الكتابة من اليمين لليسار بشكل كامل.',
             'عام', 'عربي,لغة,rtl,واجهة', False, 5),
        ]
        for q, a, cat, kws, rh, pri in nedaa_faqs:
            KnowledgeItem.objects.get_or_create(
                tenant=nedaa, question=q,
                defaults={
                    'answer': a, 'category': cat, 'keywords': kws,
                    'knowledge_base': nedaa_kb, 'is_active': True,
                    'requires_human': rh, 'priority': pri,
                }
            )

        # ── Family Fund FAQ ────────────────────────────────────────────────────
        fund_faqs = [
            ('كيف أقدم طلب دعم من الصندوق؟',
             'لتقديم طلب دعم، يرجى زيارة مقر الصندوق بالوثائق المطلوبة: الهوية الوطنية، وثيقة الدخل، شهادة الأسرة. أو أرسل طلبك عبر البريد الإلكتروني.',
             'طلبات', 'طلب,دعم,مساعدة,تقديم,مالي', False, 10),
            ('ما هي شروط الاستفادة من الصندوق؟',
             'يشترط في المستفيد: أن يكون سعودي الجنسية، وأن لا يتجاوز دخله الحد المقرر، وأن يكون مقيماً في نطاق خدمة الصندوق. سيتواصل معك أحد الموظفين لاستكمال التقييم.',
             'شروط', 'شروط,أهلية,استحقاق,قبول', True, 9),
            ('متى يتم صرف المستحقات؟',
             'تُصرف المستحقات في اليوم الخامس عشر من كل شهر ميلادي. في حال تأخر الصرف يرجى التواصل مع إدارة الصندوق مباشرة.',
             'مالي', 'صرف,راتب,موعد,تاريخ,مستحقات', False, 8),
            ('كيف أحدّث بياناتي في الصندوق؟',
             'لتحديث بياناتك، يرجى زيارة مقر الصندوق بالوثائق الرسمية أو التواصل مع موظفي الاستقبال.',
             'بيانات', 'تحديث,بيانات,معلومات,تعديل', False, 6),
        ]
        for q, a, cat, kws, rh, pri in fund_faqs:
            KnowledgeItem.objects.get_or_create(
                tenant=fund, question=q,
                defaults={
                    'answer': a, 'category': cat, 'keywords': kws,
                    'knowledge_base': fund_kb, 'is_active': True,
                    'requires_human': rh, 'priority': pri,
                }
            )
        self.stdout.write('  ✓ Knowledge items created')

        # ── Quick Replies ──────────────────────────────────────────────────────
        QuickReplyTemplate.objects.get_or_create(
            tenant=nedaa, title='ترحيب',
            defaults={'body': 'أهلاً وسهلاً! كيف يمكنني مساعدتك اليوم؟', 'category': 'عام', 'is_active': True}
        )
        QuickReplyTemplate.objects.get_or_create(
            tenant=nedaa, title='شكراً للتواصل',
            defaults={'body': 'شكراً لتواصلك مع نداء. هل هناك شيء آخر يمكنني مساعدتك به؟', 'category': 'عام', 'is_active': True}
        )
        QuickReplyTemplate.objects.get_or_create(
            tenant=nedaa, title='طلب انتظار',
            defaults={'body': 'شكراً لتواصلك، يرجى الانتظار لحين تحويلك لأحد المختصين.', 'category': 'دعم', 'is_active': True}
        )
        QuickReplyTemplate.objects.get_or_create(
            tenant=fund, title='ترحيب الصندوق',
            defaults={'body': 'مرحباً بك في صندوق الأسرة. يسعدنا خدمتك.', 'category': 'عام', 'is_active': True}
        )
        QuickReplyTemplate.objects.get_or_create(
            tenant=fund, title='إحالة للمسؤول',
            defaults={'body': 'سيتواصل معك أحد موظفينا في أقرب وقت ممكن.', 'category': 'دعم', 'is_active': True}
        )
        self.stdout.write('  ✓ Quick replies created')

        # ── Sample Conversations ───────────────────────────────────────────────
        contact1, _ = Contact.objects.get_or_create(
            tenant=nedaa, phone='+966512345678',
            defaults={'name': 'محمد العتيبي', 'source_platform': 'whatsapp'}
        )
        contact2, _ = Contact.objects.get_or_create(
            tenant=nedaa, phone='+966556789012',
            defaults={'name': 'سارة الغامدي', 'source_platform': 'whatsapp'}
        )
        contact3, _ = Contact.objects.get_or_create(
            tenant=fund, phone='+966598765432',
            defaults={'name': 'فاطمة الزهراني', 'source_platform': 'whatsapp'}
        )

        if not Conversation.objects.filter(tenant=nedaa, contact=contact1).exists():
            conv1 = Conversation.objects.create(
                tenant=nedaa, contact=contact1, whatsapp_number=nedaa_wa,
                status='open', category='support', ai_enabled=True, assigned_to=agent
            )
            Message.objects.create(
                tenant=nedaa, conversation=conv1, direction='inbound',
                body='السلام عليكم، كيف أسجل في نداء؟', status='delivered'
            )
            Message.objects.create(
                tenant=nedaa, conversation=conv1, direction='outbound',
                body='وعليكم السلام! يمكنك التسجيل من خلال زيارة موقع نداء الرسمي والنقر على زر "إنشاء حساب".',
                status='sent', is_ai_generated=True
            )
            Message.objects.create(
                tenant=nedaa, conversation=conv1, direction='inbound',
                body='شكراً جزيلاً', status='delivered'
            )

        if not Conversation.objects.filter(tenant=nedaa, contact=contact2).exists():
            conv2 = Conversation.objects.create(
                tenant=nedaa, contact=contact2, whatsapp_number=nedaa_wa,
                status='needs_human', category='complaint', ai_enabled=True
            )
            Message.objects.create(
                tenant=nedaa, conversation=conv2, direction='inbound',
                body='لدي مشكلة في الدفع ولا أستطيع إتمام الاشتراك', status='delivered'
            )

        if not Conversation.objects.filter(tenant=fund, contact=contact3).exists():
            conv3 = Conversation.objects.create(
                tenant=fund, contact=contact3, whatsapp_number=fund_wa,
                status='needs_human', category='faq', ai_enabled=True
            )
            Message.objects.create(
                tenant=fund, conversation=conv3, direction='inbound',
                body='أريد معرفة شروط الاستفادة من الصندوق', status='delivered'
            )

        self.stdout.write('  ✓ Sample conversations created')

        # ── Subscription Plans ─────────────────────────────────────────────────
        plans_data = [
            {
                'slug': 'free', 'name': 'مجاني', 'sort_order': 0,
                'description': 'ابدأ مجاناً بدون بطاقة ائتمانية',
                'price_monthly': 0, 'price_yearly': 0,
                'max_whatsapp_numbers': 1, 'max_agents': 2, 'max_messages_per_month': 500,
                'is_featured': False, 'is_active': True,
                'features': ['رقم واتساب واحد', 'وكيلان', '500 رسالة/شهر', 'قاعدة معرفة أساسية', 'دعم عبر البريد'],
            },
            {
                'slug': 'starter', 'name': 'ستارتر', 'sort_order': 1,
                'description': 'مثالي للشركات الصغيرة والناشئة',
                'price_monthly': 99, 'price_yearly': 990,
                'max_whatsapp_numbers': 3, 'max_agents': 5, 'max_messages_per_month': 5000,
                'is_featured': False, 'is_active': True,
                'features': ['3 أرقام واتساب', '5 وكلاء', '5,000 رسالة/شهر', 'ردود سريعة غير محدودة', 'تقارير أساسية', 'دعم عبر الواتساب'],
            },
            {
                'slug': 'pro', 'name': 'احترافي', 'sort_order': 2,
                'description': 'للشركات المتوسطة التي تحتاج أداءً عالياً',
                'price_monthly': 299, 'price_yearly': 2990,
                'max_whatsapp_numbers': 10, 'max_agents': 20, 'max_messages_per_month': 30000,
                'is_featured': True, 'is_active': True,
                'features': ['10 أرقام واتساب', '20 وكيل', '30,000 رسالة/شهر', 'ذكاء اصطناعي متقدم', 'تقارير تفصيلية', 'دعم ذو أولوية', 'API مفتوح'],
            },
            {
                'slug': 'enterprise', 'name': 'مؤسسي', 'sort_order': 3,
                'description': 'حلول مخصصة للمؤسسات الكبرى',
                'price_monthly': 999, 'price_yearly': 9990,
                'max_whatsapp_numbers': None, 'max_agents': None, 'max_messages_per_month': None,
                'is_featured': False, 'is_active': True,
                'features': ['أرقام واتساب غير محدودة', 'وكلاء غير محدودون', 'رسائل غير محدودة', 'مدير حساب مخصص', 'SLA مضمون 99.9%', 'تكامل مخصص', 'تدريب الفريق'],
            },
        ]
        for p in plans_data:
            SubscriptionPlan.objects.get_or_create(slug=p['slug'], defaults=p)
        self.stdout.write('  ✓ Subscription plans created')

        # ── Assign subscriptions to seed tenants ───────────────────────────────
        enterprise_plan = SubscriptionPlan.objects.get(slug='enterprise')
        starter_plan = SubscriptionPlan.objects.get(slug='starter')
        today = timezone.now().date()

        if not nedaa.subscriptions.exists():
            Subscription.objects.create(
                tenant=nedaa, plan=enterprise_plan, status='active',
                billing_cycle='yearly', start_date=today,
                end_date=today.replace(year=today.year + 1), auto_renew=True,
            )
        if not fund.subscriptions.exists():
            Subscription.objects.create(
                tenant=fund, plan=starter_plan, status='trial',
                billing_cycle='monthly', start_date=today,
                trial_ends_at=today.replace(month=today.month + 1) if today.month < 12 else today.replace(year=today.year + 1, month=1),
                auto_renew=False,
            )
        self.stdout.write('  ✓ Sample subscriptions created')

        self.stdout.write(self.style.SUCCESS('\n✅ Seed complete!'))
        self.stdout.write('  Login: admin / admin123')
        self.stdout.write('  Login: agent1 / agent123')

    def _get_or_create_user(self, username, email, password, is_staff=False,
                             is_superuser=False, first_name='', last_name=''):
        if User.objects.filter(username=username).exists():
            return User.objects.get(username=username)
        if is_superuser:
            return User.objects.create_superuser(username, email, password)
        user = User.objects.create_user(
            username, email, password,
            first_name=first_name, last_name=last_name, is_staff=is_staff
        )
        return user
