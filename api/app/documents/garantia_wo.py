"""Documento para garantías de Work Orders."""
from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING

from .base import DocumentoBase, ahora
from datetime import datetime


class GarantiaWO(DocumentoBase):
    """Registro de una WO marcada como garantía con observaciones."""

    work_order_id: str
    aplicacion_id: str
    squad: str | None = None
    lider: str | None = None
    descripcion: str | None = None
    fecha_creacion_wo: str | None = None
    estado_wo: str | None = None
    observaciones: str | None = None
    observaciones_resolucion: str | None = None

    class Settings:
        name = "garantias_wo"
        indexes = [
            IndexModel([("work_order_id", ASCENDING)], name="ix_wo_id", unique=True),
            IndexModel([("aplicacion_id", ASCENDING)], name="ix_app"),
        ]
