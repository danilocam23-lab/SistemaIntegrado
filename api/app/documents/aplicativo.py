"""Colección operativa: aplicativos (software objetivo de un requerimiento).

Era la entidad ``Aplicacion`` del Sistema Liquidador; se renombró para no
chocar con ``aplicaciones`` (los tenants de la plataforma).
"""
from pydantic import BaseModel
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class Direccion(BaseModel):
    """Dirección de EPM a la que pertenece el aplicativo (documento embebido)."""

    nombre: str


class Aplicativo(DocumentoOperativo):
    nombre: str
    direccion: Direccion | None = None

    class Settings:
        name = "aplicativos"
        indexes = [IndexModel([("aplicacion_id", ASCENDING), ("nombre", ASCENDING)], name="ix_app_nombre")]
