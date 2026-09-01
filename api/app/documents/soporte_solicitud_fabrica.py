"""Colecciones operativas para Soporte / Solicitudes Fábrica."""
from datetime import datetime

from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class ErrorValidacionSoporte(BaseModel):
    fila: int
    lider: str | None = None
    squad: str | None = None
    motivo: str


class SoporteSolicitudFabrica(DocumentoOperativo):
    """Registro importado desde la sábana de solicitudes de fábrica."""

    fila_origen: int
    lider: str
    squad: str
    datos: dict[str, str] = Field(default_factory=dict)
    sincronizado_en: datetime | None = None

    class Settings:
        name = "soporte_solicitudes_fabrica"
        indexes = [
            IndexModel([("aplicacion_id", ASCENDING), ("fila_origen", ASCENDING)], name="ix_app_fila_origen"),
            IndexModel([("aplicacion_id", ASCENDING), ("lider", ASCENDING)], name="ix_app_lider"),
            IndexModel([("aplicacion_id", ASCENDING), ("squad", ASCENDING)], name="ix_app_squad"),
            IndexModel([("aplicacion_id", ASCENDING), ("datos.Work Order ID", ASCENDING)], name="ix_app_wo_id"),
            IndexModel([("aplicacion_id", ASCENDING), ("datos.Fecha_Fin_Real", ASCENDING)], name="ix_app_fecha_fin_real"),
        ]


class SoporteSolicitudFabricaSyncLog(DocumentoOperativo):
    """Histórico de sincronizaciones de Solicitudes Fábrica."""

    estado: str = "exitoso"
    fuente_url: str
    archivo: str | None = None
    total_encontrados: int = 0
    validos: int = 0
    con_error: int = 0
    cargados: int = 0
    omitidos: int = 0
    duracion_ms: int = 0
    error_general: str | None = None
    headers_excel: list[str] = Field(default_factory=list)
    iniciado_en: datetime
    finalizado_en: datetime | None = None
    errores: list[ErrorValidacionSoporte] = Field(default_factory=list)

    class Settings:
        name = "soporte_solicitudes_fabrica_sync_log"
        indexes = [
            IndexModel([("aplicacion_id", ASCENDING), ("iniciado_en", DESCENDING)], name="ix_app_iniciado_desc"),
        ]
