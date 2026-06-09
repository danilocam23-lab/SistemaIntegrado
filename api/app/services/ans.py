"""Cálculo de ANS por días hábiles (portado del Sistema Liquidador)."""
from datetime import date, datetime, time, timedelta

from app.documents.enums import AnsResultado
from app.documents.festivo import Festivo


class ANSService:
    """Determina si un trabajo cumple el ANS según los días hábiles transcurridos."""

    @staticmethod
    async def calcular(
        aplicacion_id: str,
        fecha_inicio: date,
        fecha_fin: date,
        umbral_dias_habiles: int,
    ) -> AnsResultado:
        if fecha_fin < fecha_inicio:
            raise ValueError("fecha_fin no puede ser menor que fecha_inicio")

        inicio = datetime.combine(fecha_inicio, time.min)
        fin = datetime.combine(fecha_fin, time.max)
        docs = await Festivo.find(
            Festivo.aplicacion_id == aplicacion_id,
            Festivo.fecha >= inicio,
            Festivo.fecha <= fin,
        ).to_list()
        festivos = {d.fecha.date() for d in docs}

        dias_habiles = 0
        cursor = fecha_inicio
        while cursor <= fecha_fin:
            if cursor.weekday() < 5 and cursor not in festivos:
                dias_habiles += 1
            cursor += timedelta(days=1)

        return (
            AnsResultado.CUMPLE
            if dias_habiles <= umbral_dias_habiles
            else AnsResultado.NO_CUMPLE
        )
