# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Cálculo de ANS por días hábiles (portado del Sistema Liquidador)."""
from datetime import date, datetime, time, timedelta

from app.documents.enums import AnsResultado
from app.documents.festivo import Festivo

# Los festivos son un catálogo compartido: `POST /api/festivos` los crea todos con
# aplicacion_id="global" (ver api/app/api/festivos.py), igual que tarifas/categorías/
# configuración. Toda lectura de festivos debe acotarse a [aplicacion_id, "global"]
# para no perder ni mezclar aplicaciones (ADR-0008 C1).
_APP_GLOBAL = "global"


class ANSService:
    """Determina si un trabajo cumple el ANS según los días hábiles transcurridos."""

    @staticmethod
    async def calcular(
        aplicacion_id: str,
        fecha_inicio: date,
        fecha_fin: date,
        umbral_dias_habiles: int,
    ) -> AnsResultado:
        """Cuenta los días hábiles entre ``fecha_inicio`` y ``fecha_fin`` (ambas
        incluidas, excluyendo fines de semana y festivos de ``aplicacion_id`` o
        globales) y compara contra ``umbral_dias_habiles``.

        Devuelve ``AnsResultado.CUMPLE`` si los días hábiles no superan el
        umbral, ``NO_CUMPLE`` en caso contrario. Lanza ``ValueError`` si
        ``fecha_fin`` es anterior a ``fecha_inicio``.
        """
        if fecha_fin < fecha_inicio:
            raise ValueError("fecha_fin no puede ser menor que fecha_inicio")

        inicio = datetime.combine(fecha_inicio, time.min)
        fin = datetime.combine(fecha_fin, time.max)
        docs = await Festivo.find(
            {"aplicacion_id": {"$in": [aplicacion_id, _APP_GLOBAL]}},
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
