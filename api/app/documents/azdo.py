"""Colecciones operativas: integración con Azure DevOps."""
from datetime import datetime

from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class AzdoWorkItem(DocumentoOperativo):
    """Work item de Azure DevOps sincronizado a la plataforma."""

    azdo_id: int
    asignacion_id: str | None = None
    proyecto_id: str | None = None
    sprint_id: str | None = None
    persona_id: str | None = None
    tipo: str
    titulo: str
    estado: str | None = None
    asignado_a: str | None = None
    original_estimate: float = 0
    completed_work: float = 0
    remaining_work: float = 0
    fecha_inicio: datetime | None = None
    iteration_path: str | None = None
    area_path: str | None = None
    tags: str | None = None
    url: str | None = None
    ultima_sync: datetime | None = None

    class Settings:
        name = "azdo_work_items"
        indexes = [
            IndexModel(
                [("aplicacion_id", ASCENDING), ("azdo_id", ASCENDING)], unique=True, name="uq_app_azdo_id"
            )
        ]


class AzdoSyncLog(DocumentoOperativo):
    """Registro histórico de una sincronización con Azure DevOps."""

    sprint_id: str | None = None
    estado: str
    work_items: int = 0
    total_completado: float = 0
    total_restante: float = 0
    total_original: float = 0
    error: str | None = None
    iniciado_en: datetime
    finalizado_en: datetime | None = None

    class Settings:
        name = "azdo_sync_log"
        indexes = [IndexModel([("aplicacion_id", ASCENDING), ("sprint_id", ASCENDING)], name="ix_app_sprint")]
