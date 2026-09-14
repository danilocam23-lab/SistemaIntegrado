"""Esquemas de entrada del módulo de requerimientos."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.documents.enums import (
    AnsResultado,
    EstadoFacturacion,
    Tipificacion,
    TipoCosto,
)


class SolicitudIn(BaseModel):
    """Datos de la solicitud (SC) que origina un requerimiento: quién la pidió,
    a qué squad/tecnología pertenece y con qué tarifa se liquida."""

    codigo_sc: str
    fecha_solicitud: datetime | None = None
    aplicativo_id: str | None = None
    squad_id: str | None = None
    lt_hitss_id: str | None = None
    lt_epm_id: str | None = None
    scrum_id: str | None = None
    analista_requerimientos_id: str | None = None
    tipo_costo: TipoCosto | None = None
    estado: str | None = None
    anio_tarifa: int | None = None
    tecnologia: str | None = None
    tarifa_id: str | None = None


class RequerimientoIn(BaseModel):
    """Datos para crear un requerimiento completo (con su solicitud embebida)."""

    codigo_req: str
    nombre: str | None = None
    solicitud: SolicitudIn
    estado: str
    total_horas_estimadas: Decimal | None = None
    fecha_real_entrega_estimacion: datetime | None = None
    ans_estimacion: AnsResultado | None = None
    fecha_solicitud_acta: datetime | None = None
    motivo_cierre: str | None = None
    seguimiento: str | None = None
    seguimiento_epm: str | None = None
    tipificacion: Tipificacion | None = None
    monto_pactado: Decimal | None = None
    acta_trabajo: str | None = None
    cantidad_entregas: int = 0
    categoria_id: str | None = None
    developers_asignados: list[str] = []
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None


class RequerimientoUpdate(BaseModel):
    """Campos editables de un requerimiento existente; todos opcionales."""

    nombre: str | None = None
    solicitud: SolicitudIn | None = None
    estado: str | None = None
    total_horas_estimadas: Decimal | None = None
    fecha_real_entrega_estimacion: datetime | None = None
    ans_estimacion: AnsResultado | None = None
    fecha_solicitud_acta: datetime | None = None
    motivo_cierre: str | None = None
    seguimiento: str | None = None
    seguimiento_epm: str | None = None
    tipificacion: Tipificacion | None = None
    monto_pactado: Decimal | None = None
    acta_trabajo: str | None = None
    cantidad_entregas: int | None = None
    categoria_id: str | None = None
    developers_asignados: list[str] | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None


class FacturacionIn(BaseModel):
    """Datos de facturación de una entrega concreta."""

    mes_facturacion: datetime | None = None
    estado: EstadoFacturacion | None = None
    fecha_aprobacion_factura: datetime | None = None
    valor_facturado: Decimal | None = None


class EntregaIn(BaseModel):
    """Una entrega (hito facturable) de un requerimiento: fechas, horas/porcentaje,
    estado del ANS y, si aplica, sus datos de facturación."""

    numero: int
    horas: Decimal | None = None
    porcentaje: Decimal | None = None
    fecha_comprometida: datetime
    fecha_recepcion: datetime | None = None
    fecha_cargue: datetime | None = None
    fecha_aprobacion: datetime | None = None
    fecha_ejecucion: datetime | None = None
    estado: str | None = None
    observaciones: str | None = None
    observaciones_hitss: str | None = None
    tipificacion: Tipificacion | None = None
    mes_aprobacion: str | None = None
    ans_entrega: AnsResultado | None = None
    garantia: bool = False
    numero_garantia: int | None = None
    acta_trabajo_id: str | None = None
    orden_compra_id: str | None = None
    facturacion: FacturacionIn | None = None


class TransicionIn(BaseModel):
    """Cambio de estado de un requerimiento, con la nota que queda en la bitácora."""

    nuevo_estado: str
    descripcion: str = ""


class AnsCalcularIn(BaseModel):
    """Parámetros para calcular el resultado ANS entre dos fechas (``services/ans.py``)."""

    fecha_inicio: date
    fecha_fin: date
    umbral_dias_habiles: int
