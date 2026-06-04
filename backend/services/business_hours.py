"""
Business hours helper — Phase 1.5 skeleton.
Returns True (always open) unless business_hours_enabled=False.
Full scheduling support is planned for Phase 2.
"""
from django.utils import timezone


def is_within_business_hours(tenant) -> bool:
    """
    Return True if the tenant is currently within business hours.
    Phase 1.5: always True unless business_hours_enabled is explicitly False
    and no schedule is defined (safe default — don't block conversations).
    """
    try:
        settings = tenant.settings
        if not settings.business_hours_enabled:
            return True
        # Future: check schedule here
        # For now, if business hours are enabled but no schedule is configured, allow
        return True
    except Exception:
        return True
