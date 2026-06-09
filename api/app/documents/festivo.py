"""Colección operativa: festivos (para el cálculo de ANS por días hábiles)."""
from datetime import datetime

from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class Festivo(DocumentoOperativo):
    fecha: datetime
    descripcion: str | None = None

    class Settings:
        name = "festivos"
        indexes = [IndexModel([("aplicacion_id", ASCENDING), ("fecha", ASCENDING)], name="ix_app_fecha")]
