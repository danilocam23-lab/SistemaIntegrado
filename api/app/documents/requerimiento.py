"""Colección operativa NÚCLEO: requerimientos.

Unifica el Requerimiento + SolicitudCotizacion del Liquidador con el
project_catalog del Workload Manager. La solicitud y las entregas (con su
facturación) se modelan como documentos embebidos.
"""
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any

from bson import Decimal128
from pydantic import BaseModel, BeforeValidator, PlainSerializer
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo
from app.documents.enums import (
    AnsResultado,
    EstadoEntrega,
    EstadoFacturacion,
    EstadoRequerimiento,
    TipoCosto,
)


def _decimal128_a_decimal(v: Any) -> Any:
    """Convierte Decimal128 de MongoDB a Decimal de Python."""
    if isinstance(v, Decimal128):
        return v.to_decimal()
    return v


MongoDecimal = Annotated[
    Decimal,
    BeforeValidator(_decimal128_a_decimal),
    PlainSerializer(lambda x: float(x), return_type=float, when_used="json"),
]


class Facturacion(BaseModel):
    """Facturación de una entrega (documento embebido 1:1)."""

    mes_facturacion: datetime | None = None
    estado: EstadoFacturacion | None = None
    fecha_aprobacion_factura: datetime | None = None
    valor_facturado: MongoDecimal | None = None


class Entrega(BaseModel):
    """Entrega de un requerimiento (documento embebido)."""

    numero: int
    horas: MongoDecimal | None = None
    porcentaje: MongoDecimal | None = None
    fecha_comprometida: datetime | None = None
    fecha_recepcion: datetime | None = None
    fecha_cargue: datetime | None = None
    fecha_aprobacion: datetime | None = None
    fecha_ejecucion: datetime | None = None
    estado: str | None = None
    observaciones: str | None = None
    mes_aprobacion: str | None = None
    ans_entrega: AnsResultado | None = None
    garantia: bool = False
    acta_trabajo_id: str | None = None
    orden_compra_id: str | None = None
    facturacion: Facturacion | None = None


class Solicitud(BaseModel):
    """Solicitud de cotización (documento embebido 1:1 en el requerimiento)."""

    codigo_sc: str
    fecha_solicitud: datetime | None = None
    aplicativo_id: str | None = None
    squad_id: str | None = None
    lt_hitss_id: str | None = None
    lt_epm_id: str | None = None
    scrum_id: str | None = None
    tipo_costo: TipoCosto | None = None
    estado: str | None = None
    anio_tarifa: int | None = None
    tecnologia: str | None = None
    tarifa_id: str | None = None


class Requerimiento(DocumentoOperativo):
    codigo_req: str
    nombre: str | None = None
    solicitud: Solicitud
    estado: str
    total_horas_estimadas: MongoDecimal | None = None
    fecha_real_entrega_estimacion: datetime | None = None
    ans_estimacion: AnsResultado | None = None
    fecha_solicitud_acta: datetime | None = None
    fecha_limite: datetime | None = None
    ans_acta: AnsResultado | None = None
    motivo_cierre: str | None = None
    reemplaza_a_id: str | None = None
    seguimiento: str | None = None
    monto_pactado: MongoDecimal | None = None
    acta_trabajo: str | None = None
    cantidad_entregas: int = 0
    # Campos provenientes del Workload Manager (project_catalog).
    categoria_id: str | None = None
    developers_asignados: list[str] = []
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    entregas: list[Entrega] = []

    class Settings:
        name = "requerimientos"
        indexes = [
            IndexModel(
                [
                    ("aplicacion_id", ASCENDING),
                    ("codigo_req", ASCENDING),
                    ("solicitud.squad_id", ASCENDING),
                    ("solicitud.codigo_sc", ASCENDING),
                ],
                unique=True,
                name="uq_app_req_squad_sc",
            ),
            IndexModel(
                [("aplicacion_id", ASCENDING), ("estado", ASCENDING)],
                name="ix_app_estado",
            ),
        ]
