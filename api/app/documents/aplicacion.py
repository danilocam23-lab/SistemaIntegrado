"""Colección de plataforma: aplicaciones (tenants)."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoBase


class Aplicacion(DocumentoBase):
    """Una aplicación (tenant) de la plataforma: CRM, BI, Soporte, EPM-HITSS, ..."""

    codigo: str
    nombre: str
    descripcion: str = ""
    activa: bool = True
    creada_por: str | None = None

    class Settings:
        name = "aplicaciones"
        indexes = [IndexModel([("codigo", ASCENDING)], unique=True, name="uq_codigo")]
