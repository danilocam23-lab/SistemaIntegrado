"""Colección operativa: planes de acción."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class PlanAccion(DocumentoOperativo):
    titulo: str
    descripcion: str | None = None
    responsable_id: str | None = None
    fecha_limite: str | None = None  # 'YYYY-MM-DD'
    estado: str = "PENDIENTE"  # 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADO' | 'CANCELADO'

    class Settings:
        name = "planes_accion"
        indexes = [
            IndexModel(
                [("aplicacion_id", ASCENDING), ("estado", ASCENDING)],
                name="ix_app_estado",
            )
        ]
