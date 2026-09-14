"""Configuración de la aplicación, leída de variables de entorno / archivo .env."""
from functools import lru_cache
from pathlib import Path

from pydantic import ValidationError
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
    # Sin valor por defecto a propósito (F0.5 / ADR-0008 S11): si falta en el
    # .env, el arranque debe fallar en vez de firmar tokens con una clave
    # pública y conocida.
    jwt_secret: str
    jwt_algoritmo: str = "HS256"
    jwt_expira_minutos: int = 480

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Superadmin inicial
    superadmin_nombre: str = "Administrador"
    superadmin_email: str = "admin@hitss.com"
    # Sin valor por defecto a propósito (F0.5 / ADR-0008 S11): idem jwt_secret.
    superadmin_password: str

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
    try:
        # mypy no sabe que pydantic-settings completa jwt_secret y
        # superadmin_password desde variables de entorno / .env en runtime.
        settings = Settings()  # type: ignore[call-arg]
    except ValidationError as exc:
        campos = ", ".join(str(err["loc"][0]) for err in exc.errors())
        raise RuntimeError(
            "Configuración incompleta: faltan variables obligatorias en api/.env "
            f"({campos}). Copia api/.env.example a api/.env y define un valor real "
            "para cada una (nunca uses el valor de ejemplo en producción)."
        ) from exc
    if not settings.api_key:
        settings.api_key = _leer_env_file("API_KEY")
    if not settings.api_key_requerimientos:
        settings.api_key_requerimientos = _leer_env_file("API_KEY_REQUERIMIENTOS")
    if not settings.api_key_solicitudes:
        settings.api_key_solicitudes = _leer_env_file("API_KEY_SOLICITUDES")
    return settings
