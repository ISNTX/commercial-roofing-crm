from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "commercial-roofing-crm"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:5173"

    supabase_url: str = ""
    supabase_service_role_key: str = ""

    outreach_engine_url: str = ""
    outreach_engine_api_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
