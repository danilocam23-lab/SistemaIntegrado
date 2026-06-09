"""Cálculo del valor de una entrega (portado del Sistema Liquidador)."""
from datetime import datetime
from decimal import Decimal

from app.documents.enums import TipoCosto
from app.documents.requerimiento import Entrega, Requerimiento
from app.documents.tarifa import Tarifa


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

        # Buscar tarifa global por año (tarifas ya no están segmentadas por squad)
        anio = fecha.year
        candidatas = await Tarifa.find(
            Tarifa.anio == anio,
        ).to_list()

        if candidatas:
            return candidatas[0]

        # Si no hay del año actual, buscar la más reciente de cualquier squad
        ultima = await Tarifa.find_all().sort("-anio").first_or_none()

        if ultima is not None:
            return ultima

        raise ValueError(f"No existe una tarifa para el año {anio}")
