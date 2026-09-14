"""Cálculo del valor de una entrega (portado del Sistema Liquidador)."""
from datetime import datetime
from decimal import Decimal

from app.documents.enums import TipoCosto
from app.documents.requerimiento import Entrega, Requerimiento
from app.documents.tarifa import Tarifa

# Las tarifas son un catálogo compartido: `POST /api/tarifas` y el importador de
# Excel las crean con aplicacion_id="global" (ver api/app/api/tarifas.py,
# api/app/importer/excel_importer.py:800). La consulta debe acotarse igual a
# [aplicacion_id, "global"] — nunca a toda la colección sin filtro — para que una
# aplicación no pueda terminar facturando con la tarifa de OTRA aplicación si en
# algún momento existen tarifas propias por aplicación (ADR-0008 C2).
_APP_GLOBAL = "global"


class LiquidacionService:
    """Calcula el valor a facturar de una entrega según el tipo de costo."""

    @staticmethod
    async def valor_entrega(requerimiento: Requerimiento, entrega: Entrega) -> Decimal:
        if entrega.garantia:
            return Decimal("0")

        solicitud = requerimiento.solicitud
        if solicitud.tipo_costo == TipoCosto.FIJO:
            if requerimiento.monto_pactado is not None:
                return requerimiento.monto_pactado
            # Sin monto pactado: usar valor_hora de la tarifa vigente del año (tarifa anual Fábrica)
            fecha_base = (
                entrega.fecha_aprobacion
                or entrega.fecha_cargue
                or entrega.fecha_recepcion
                or datetime.now()
            )
            tarifa = await LiquidacionService._tarifa_vigente(
                requerimiento.aplicacion_id, solicitud.tarifa_id, fecha_base
            )
            horas = entrega.horas or Decimal("0")
            return (horas * tarifa.valor_hora).quantize(Decimal("0.01"))

        fecha_base = (
            entrega.fecha_aprobacion
            or entrega.fecha_cargue
            or entrega.fecha_recepcion
            or datetime.now()
        )
        tarifa = await LiquidacionService._tarifa_vigente(
            requerimiento.aplicacion_id, solicitud.tarifa_id, fecha_base
        )
        horas = entrega.horas or Decimal("0")
        return (horas * tarifa.valor_hora).quantize(Decimal("0.01"))

    @staticmethod
    async def _tarifa_vigente(
        aplicacion_id: str, tarifa_id: str | None, fecha: datetime
    ) -> Tarifa:
        if tarifa_id:
            tarifa = await Tarifa.get(tarifa_id)
            if tarifa is not None:
                return tarifa

        # Buscar la tarifa del año, acotada a esta aplicación (+ el catálogo global).
        # Orden explícito y determinista: la más reciente creada desempata en vez de
        # depender del orden natural (no garantizado) de la colección.
        anio = fecha.year
        filtro_aplicacion = {"aplicacion_id": {"$in": [aplicacion_id, _APP_GLOBAL]}}
        candidatas = (
            await Tarifa.find(filtro_aplicacion, Tarifa.anio == anio)
            .sort("-creado_en")
            .to_list()
        )

        if candidatas:
            return candidatas[0]

        # Si no hay tarifa del año pedido, usar la más reciente disponible PARA ESTA
        # APLICACIÓN (o global) — nunca la de otra aplicación sin relación alguna.
        ultima = (
            await Tarifa.find(filtro_aplicacion).sort("-anio", "-creado_en").first_or_none()
        )

        if ultima is not None:
            return ultima

        raise ValueError(f"No existe una tarifa para el año {anio}")
