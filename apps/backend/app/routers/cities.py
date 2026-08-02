from fastapi import APIRouter, Depends
from supabase import Client

from app.core.auth import require_user
from app.core.supabase import get_supabase

router = APIRouter(prefix="/cities", tags=["cities"], dependencies=[Depends(require_user)])


@router.get("")
def list_cities(supabase: Client = Depends(get_supabase)):
    result = (
        supabase.table("cities")
        .select("id, name, county_id, counties(name)")
        .order("name")
        .execute()
    )
    return result.data
