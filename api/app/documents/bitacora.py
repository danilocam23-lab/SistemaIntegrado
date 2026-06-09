"""Colección operativa: bitácora unificada (eventos + auditoría)."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class Bitacora(DocumentoOperativo):
    """Evento de bitácora / auditoría sobre cualquier entidad del dominio."""

    entidad_tipo: str
    entidad_id: str
    accion: str
    descripcion: str = ""
    autor: str | None = None
    datos_antes: dict | None = None
    datos_despues: dict | None = None

    class Settings:
        name = "bitacora"
        indexes = [
            IndexModel([("aplicacion_id", ASCENDING), ("entidad_tipo", ASCENDING)], name="ix_app_entidad_tipo"),
            IndexModel([("entidad_id", ASCENDING)], name="ix_entidad_id"),
        ]
