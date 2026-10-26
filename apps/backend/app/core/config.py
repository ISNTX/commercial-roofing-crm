from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "commercial-roofing-crm"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:5173"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    outreach_engine_url: str = ""
    outreach_engine_api_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        # Browsers send Origin without a trailing slash, and CORSMiddleware
        # matches exactly, so a URL pasted as "https://x.up.railway.app/"
        # would silently block every request.
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def missing_supabase_settings(self) -> list[str]:
        required = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_ANON_KEY": self.supabase_anon_key,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
        }
        return [name for name, value in required.items() if not value]


settings = Settings()
