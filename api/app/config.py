"""Configuración de la aplicación, leída de variables de entorno / archivo .env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = API_DIR / ".env"


def _leer_env_file(clave: str) -> str:
    if not ENV_FILE.exists():
        return ""
    prefijo = f"{clave}="
    for linea in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if linea.startswith(prefijo):
            return linea[len(prefijo):].strip().strip('"').strip("'")
    return ""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

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

    # Integración externa (Power Automate, etc.)
    api_key: str = ""
    api_key_requerimientos: str = ""
    api_key_solicitudes: str = ""

    # Aplicación inicial
    aplicacion_inicial_codigo: str = "epm-hitss"
    aplicacion_inicial_nombre: str = "EPM-HITSS"

    @property
    def cors_lista(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.api_key:
        settings.api_key = _leer_env_file("API_KEY")
    if not settings.api_key_requerimientos:
        settings.api_key_requerimientos = _leer_env_file("API_KEY_REQUERIMIENTOS")
    if not settings.api_key_solicitudes:
        settings.api_key_solicitudes = _leer_env_file("API_KEY_SOLICITUDES")
    return settings
