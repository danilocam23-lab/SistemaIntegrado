# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Esquemas de entrada del módulo de requerimientos."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.documents.enums import (
    AnsResultado,
    EstadoFacturacion,
    Tipificacion,
    TipoCosto,
)


def _texto_no_vacio(valor: str) -> str:
    """Recorta espacios y rechaza cadenas vacías (códigos que identifican registros)."""
    limpio = valor.strip()
    if not limpio:
        raise ValueError("No puede estar vacío")
    return limpio


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

    @field_validator("codigo_sc")
    @classmethod
    def _validar_codigo_sc(cls, valor: str) -> str:
        return _texto_no_vacio(valor)


class RequerimientoIn(BaseModel):
    """Datos para crear un requerimiento completo (con su solicitud embebida)."""

    codigo_req: str
    nombre: str | None = None
    solicitud: SolicitudIn
    estado: str
    total_horas_estimadas: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    horas_siguiente_anio: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    fecha_entrega_comprometida_siguiente_anio: datetime | None = None
    fecha_real_entrega_siguiente_anio: datetime | None = None
    fecha_real_entrega_estimacion: datetime | None = None
    ans_estimacion: AnsResultado | None = None
    fecha_solicitud_acta: datetime | None = None
    seguimiento: str | None = None
    tipificacion: Tipificacion | None = None
    monto_pactado: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    acta_trabajo: str | None = None
    id_azure_hitss: int | None = None
    cantidad_entregas: int = 0
    categoria_id: str | None = None
    developers_asignados: list[str] = []
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None

    @field_validator("codigo_req")
    @classmethod
    def _validar_codigo_req(cls, valor: str) -> str:
        return _texto_no_vacio(valor)


class RequerimientoUpdate(BaseModel):
    """Campos editables de un requerimiento existente; todos opcionales.

    ``cantidad_entregas`` no es editable (se calcula con las entregas) y, si llega,
    se ignora. ``actualizado_en`` es opcional: el valor que el cliente leyó, para
    detectar ediciones concurrentes (concurrencia optimista); no se persiste.
    """

    actualizado_en: datetime | None = None

    nombre: str | None = None
    solicitud: SolicitudIn | None = None
    estado: str | None = None
    total_horas_estimadas: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    horas_siguiente_anio: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    fecha_entrega_comprometida_siguiente_anio: datetime | None = None
    fecha_real_entrega_siguiente_anio: datetime | None = None
    fecha_real_entrega_estimacion: datetime | None = None
    ans_estimacion: AnsResultado | None = None
    fecha_solicitud_acta: datetime | None = None
    seguimiento: str | None = None
    tipificacion: Tipificacion | None = None
    monto_pactado: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    acta_trabajo: str | None = None
    id_azure_hitss: int | None = None
    categoria_id: str | None = None
    developers_asignados: list[str] | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None


class HorasSiguienteAnioUpdate(BaseModel):
    """Edición independiente del bloque informativo; rechaza campos ajenos."""

    model_config = ConfigDict(extra="forbid")

    horas_siguiente_anio: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    fecha_entrega_comprometida_siguiente_anio: datetime | None = None
    fecha_real_entrega_siguiente_anio: datetime | None = None


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


class SeguimientoEpmIn(BaseModel):
    """Nuevo registro del historial de Seguimiento EPM."""

    texto: str = Field(min_length=1, max_length=4000)

    @field_validator("texto")
    @classmethod
    def _validar_texto(cls, valor: str) -> str:
        return _texto_no_vacio(valor)


class TransicionIn(BaseModel):
    """Cambio de estado de un requerimiento, con la nota que queda en la bitácora."""

    nuevo_estado: str
    descripcion: str = ""


class CambiarSquadIn(BaseModel):
    """Cuerpo de ``POST /requerimientos/{codigo_req}/cambiar-squad``."""

    squad_destino: str


class AnsCalcularIn(BaseModel):
    """Parámetros para calcular el resultado ANS entre dos fechas (``services/ans.py``)."""

    fecha_inicio: date
    fecha_fin: date
    umbral_dias_habiles: int
