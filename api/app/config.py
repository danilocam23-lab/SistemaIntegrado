"""Configuración de la aplicación, leída de variables de entorno / archivo .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Sistema Integrado HITSS"
    app_root_path: str = ""

    # MongoDB
    mongo_url: str = "mongodb://localhost:27017"
    mongo_db: str = "tecnoinsights_unificado"

    # Seguridad (JWT)
    jwt_secret: str = "cambia-esta-clave-en-produccion"
    jwt_algoritmo: str = "HS256"
    jwt_expira_minutos: int = 480

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Superadmin inicial
    superadmin_nombre: str = "Administrador"
    superadmin_email: str = "admin@hitss.com"
    superadmin_password: str = "Admin123*"

    # Aplicación inicial
    aplicacion_inicial_codigo: str = "epm-hitss"
    aplicacion_inicial_nombre: str = "EPM-HITSS"

    @property
    def cors_lista(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
