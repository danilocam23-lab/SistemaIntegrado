"""Colección operativa: backlog futuro (ítems planificados aún no formalizados como acta)."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class BacklogFuturo(DocumentoOperativo):
    nombre_iniciativa: str
    squad_id: str
    horas_aproximadas: float = 0
    fecha_tentativa_inicio: str | None = None  # 'YYYY-MM-DD'
    estado: str = "PENDIENTE"  # 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADO' | 'CANCELADO'
    volvio_acta: bool = False
    acta_id: str | None = None  # id del Requerimiento en el que se formalizó (si volvio_acta=True)

    class Settings:
        name = "backlog_futuro"
        indexes = [
            IndexModel([("aplicacion_id", ASCENDING), ("squad_id", ASCENDING)], name="ix_app_squad"),
        ]
