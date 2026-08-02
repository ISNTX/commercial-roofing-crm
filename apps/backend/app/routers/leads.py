from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.exceptions import APIError
from supabase import Client

from app.core.auth import require_user
from app.core.supabase import get_supabase

router = APIRouter(prefix="/leads", tags=["leads"], dependencies=[Depends(require_user)])


@router.get("")
def list_leads(
    county: str | None = Query(None, description="County name filter"),
    city: str | None = Query(None, description="City name filter"),
    project_type: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase),
):
    query = supabase.table("leads").select(
        "*, counties(name), cities(name)", count="exact"
    )

    if project_type:
        query = query.eq("project_type", project_type)
    if status:
        query = query.eq("status", status)
    if county:
        county_row = (
            supabase.table("counties").select("id").eq("name", county).limit(1).execute()
        )
        if not county_row.data:
            return {"items": [], "total": 0, "limit": limit, "offset": offset}
        query = query.eq("county_id", county_row.data[0]["id"])
    if city:
        city_row = supabase.table("cities").select("id").eq("name", city).limit(1).execute()
        if not city_row.data:
            return {"items": [], "total": 0, "limit": limit, "offset": offset}
        query = query.eq("city_id", city_row.data[0]["id"])

    query = query.order("scraped_at", desc=True).range(offset, offset + limit - 1)

    try:
        result = query.execute()
    except APIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "items": result.data,
        "total": result.count,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{lead_id}")
def get_lead(lead_id: str, supabase: Client = Depends(get_supabase)):
    result = (
        supabase.table("leads")
        .select(
            "*, counties(name), cities(name), contractors(name, license_number, phone, email)"
        )
        .eq("id", lead_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    return result.data[0]
