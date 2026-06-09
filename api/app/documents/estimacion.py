"""Colección operativa: estimaciones.

Unifica ``project_estimation_meta`` + ``project_estimation_rows`` del Workload
Manager. Las filas se modelan embebidas.
"""
from datetime import datetime

from pydantic import BaseModel
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class FilaEstimacion(BaseModel):
    numero: int | None = None
    epica_feature: str | None = None
    historia_usuario: str | None = None
    tipo_tarea: str | None = None
    sprint: int | None = None
    id_epm: str | None = None
    id_hitss: str | None = None
    actividad: str | None = None
    complejidad: str | None = None
    horas_estimadas: float = 0
    mejor_caso: float = 0
    peor_caso: float = 0
    promedio: float = 0
    metodologia_10: float = 0
    horas_totales: float = 0
    # IDs de las work items creadas en Azure DevOps (HITSS y EPM).
    created_task_hitss: int | None = None
    created_task_epm: int | None = None
    # ID de la User Story creada en Azure DevOps HITSS para esta fila.
    created_hu_hitss: int | None = None


class Estimacion(DocumentoOperativo):
    requerimiento_id: str | None = None
    titulo: str | None = None
    cliente: str | None = None
    iniciativa: str | None = None
    # ID del Feature creado en Azure DevOps HITSS a partir de la iniciativa.
    created_feature_hitss: int | None = None
    fecha_estimacion: datetime | None = None
    archivo: str | None = None
    total_filas: int = 0
    total_horas: float = 0
    total_horas_estimadas: float = 0
    total_mejor_caso: float = 0
    total_peor_caso: float = 0
    total_promedio: float = 0
    total_horas_finales: float = 0
    subido_en: datetime | None = None
    filas: list[FilaEstimacion] = []

    class Settings:
        name = "estimaciones"
        indexes = [
            IndexModel([("aplicacion_id", ASCENDING), ("requerimiento_id", ASCENDING)], name="ix_app_req")
        ]
