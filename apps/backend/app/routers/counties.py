from fastapi import APIRouter, Depends
from supabase import Client

from app.core.supabase import get_supabase

router = APIRouter(prefix="/counties", tags=["counties"])


@router.get("")
def list_counties(supabase: Client = Depends(get_supabase)):
    result = supabase.table("counties").select("id, name, fips_code").order("name").execute()
    return result.data
