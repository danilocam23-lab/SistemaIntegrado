"""Esquemas de entrada del módulo de requerimientos."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.documents.enums import (
    AnsResultado,
    EstadoFacturacion,
    TipoCosto,
)


class SolicitudIn(BaseModel):
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


class RequerimientoIn(BaseModel):
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
    monto_pactado: Decimal | None = None
    acta_trabajo: str | None = None
    cantidad_entregas: int = 0
    categoria_id: str | None = None
    developers_asignados: list[str] = []
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None


class RequerimientoUpdate(BaseModel):
    nombre: str | None = None
    solicitud: SolicitudIn | None = None
    estado: str | None = None
    total_horas_estimadas: Decimal | None = None
    fecha_real_entrega_estimacion: datetime | None = None
    ans_estimacion: AnsResultado | None = None
    fecha_solicitud_acta: datetime | None = None
    motivo_cierre: str | None = None
    seguimiento: str | None = None
    monto_pactado: Decimal | None = None
    acta_trabajo: str | None = None
    cantidad_entregas: int | None = None
    categoria_id: str | None = None
    developers_asignados: list[str] | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None


class FacturacionIn(BaseModel):
    mes_facturacion: datetime | None = None
    estado: EstadoFacturacion | None = None
    fecha_aprobacion_factura: datetime | None = None
    valor_facturado: Decimal | None = None


class EntregaIn(BaseModel):
    numero: int
    horas: Decimal | None = None
    porcentaje: Decimal | None = None
    fecha_comprometida: datetime
    fecha_recepcion: datetime | None = None
    fecha_cargue: datetime | None = None
    fecha_aprobacion: datetime | None = None
    fecha_ejecucion: datetime | None = None
    estado: str | None = None
    ans_entrega: AnsResultado | None = None
    garantia: bool = False
    acta_trabajo_id: str | None = None
    orden_compra_id: str | None = None
    facturacion: FacturacionIn | None = None


class TransicionIn(BaseModel):
    nuevo_estado: str
    descripcion: str = ""


class AnsCalcularIn(BaseModel):
    fecha_inicio: date
    fecha_fin: date
    umbral_dias_habiles: int
