"""Colección operativa: squads."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class Squad(DocumentoOperativo):
    nombre: str
    lt_hitss_id: str | None = None
    activo: bool = True

    class Settings:
        name = "squads"
        indexes = [IndexModel([("aplicacion_id", ASCENDING), ("nombre", ASCENDING)], name="ix_app_nombre")]
