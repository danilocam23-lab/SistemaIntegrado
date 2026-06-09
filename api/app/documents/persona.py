"""Colección operativa: personas (directorio del dominio, por aplicación)."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class Persona(DocumentoOperativo):
    """Persona del dominio: desarrollador, LT HITSS, LT EPM, etc.

    Si la persona también inicia sesión, ``usuario_id`` enlaza con su cuenta.
    """

    nombre: str
    email: str | None = None
    rol_operativo: str = "DEV"
    activo: bool = True
    squads: list[str] = []
    es_lider_tecnico: bool = False
    permite_sobrecarga: bool = False
    usuario_id: str | None = None

    class Settings:
        name = "personas"
        indexes = [IndexModel([("aplicacion_id", ASCENDING), ("email", ASCENDING)], name="ix_app_email")]
