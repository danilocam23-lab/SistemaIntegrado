"""Colección operativa: asignaciones de carga de trabajo.

Unifica ``workload_assignments`` + ``workload_projects`` + ``sprints`` del
Workload Manager. Los proyectos y sprints se modelan embebidos.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


def _nuevo_id() -> str:
    return uuid.uuid4().hex


class AzdoSprint(BaseModel):
    """Totales de Azure DevOps cacheados sobre un sprint."""

    completado: float = 0
    restante: float = 0
    original: float = 0
    work_items: int = 0
    ultima_sync: datetime | None = None


class AzdoMapping(BaseModel):
    """Vínculo de un sprint con una iteración de Azure DevOps."""

    azdo_project: str
    iteration_path: str


class Sprint(BaseModel):
    id: str = Field(default_factory=_nuevo_id)
    nombre: str
    porcentaje: float = 0
    horas: float | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    estado: str = "active"
    orden: int = 0
    azdo: AzdoSprint | None = None
    azdo_mapping: AzdoMapping | None = None


class Proyecto(BaseModel):
    id: str = Field(default_factory=_nuevo_id)
    nombre: str
    porcentaje: float = 0
    estado: str = "active"
    activo: bool = True
    notas: str | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    # Vínculo con el requerimiento (reemplaza catalog_project_id del Workload Manager).
    requerimiento_id: str | None = None
    sprints: list[Sprint] = []


class Asignacion(DocumentoOperativo):
    persona_id: str
    categoria_id: str
    total_porcentaje: float = 0
    estado: str = "active"
    activo: bool = True
    proyectos: list[Proyecto] = []

    class Settings:
        name = "asignaciones"
        indexes = [
            IndexModel([("aplicacion_id", ASCENDING), ("persona_id", ASCENDING)], name="ix_app_persona"),
            IndexModel([("aplicacion_id", ASCENDING), ("categoria_id", ASCENDING)], name="ix_app_categoria"),
        ]
