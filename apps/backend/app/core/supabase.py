from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings


@lru_cache
def get_supabase() -> Client:
    # Service role key: the backend is a trusted internal service and
    # writes leads/contractors on behalf of the scraper, so it bypasses RLS.
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
