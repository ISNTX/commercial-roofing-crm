import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import cities, counties, leads

logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)

if settings.missing_supabase_settings:
    logger.error("Missing env vars: %s", ", ".join(settings.missing_supabase_settings))


# Unhandled exceptions normally become a 500 from Starlette's outermost
# error middleware, which sits outside CORSMiddleware — so the browser sees
# a response with no CORS headers and reports a CORS error instead of the
# real failure. Catching here (added before CORS, so it runs inside it)
# keeps CORS headers on error responses.
@app.middleware("http")
async def json_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse({"detail": "Internal server error"}, status_code=500)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leads.router)
app.include_router(counties.router)
app.include_router(cities.router)


@app.get("/health")
def health():
    # Names of missing settings and the allowed origins only — never values.
    return {
        "status": "ok",
        "app": settings.app_name,
        "missing_env": settings.missing_supabase_settings,
        "cors_origins": settings.cors_origin_list,
    }
