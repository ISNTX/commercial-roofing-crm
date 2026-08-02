from functools import lru_cache

from fastapi import Header, HTTPException
from gotrue.errors import AuthApiError
from supabase import Client, create_client

from app.core.config import settings


@lru_cache
def get_auth_client() -> Client:
    # Anon key only: this client is used solely to validate bearer tokens
    # against Supabase Auth, never to read/write data.
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def require_user(authorization: str | None = Header(None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    try:
        result = get_auth_client().auth.get_user(token)
    except AuthApiError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    if not result or not result.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return result.user
