"""Cálculo de fecha límite para ANS de acta."""
from datetime import datetime, time, timedelta

from app.documents.festivo import Festivo


async def calcular_fecha_limite(
    aplicacion_id: str,
    fecha_solicitud: datetime,
    total_horas: float | None,
) -> datetime:
    """Calcula la fecha límite según las reglas de días hábiles.

    Reglas:
    1. Base = fecha_solicitud
    2. Si hora < 18:00 → contar desde ese día
    3. Si hora >= 18:00 → contar desde siguiente día hábil
    4. Días hábiles: lun-vie excluyendo festivos configurados
    5. Si horas <= 90 → sumar 3 días hábiles
    6. Si horas > 90 → sumar 5 días hábiles
    """
    dias_a_sumar = 3 if (total_horas or 0) <= 90 else 5

    # Determinar fecha base de inicio del conteo
    fecha_base = fecha_solicitud.date()
    if fecha_solicitud.time() >= time(18, 0):
        # Empezar desde el siguiente día hábil
        fecha_base += timedelta(days=1)

    # Obtener festivos del rango amplio (máx 30 días debería bastar)
    inicio_busqueda = datetime.combine(fecha_base, time.min)
    fin_busqueda = datetime.combine(fecha_base + timedelta(days=30), time.max)
    docs = await Festivo.find(
        Festivo.aplicacion_id == aplicacion_id,
        Festivo.fecha >= inicio_busqueda,
        Festivo.fecha <= fin_busqueda,
    ).to_list()
    festivos = {d.fecha.date() for d in docs}

    # Avanzar fecha_base hasta que sea día hábil (por si cayó en finde/festivo)
    while fecha_base.weekday() >= 5 or fecha_base in festivos:
        fecha_base += timedelta(days=1)

    # Sumar días hábiles
    dias_contados = 0
    cursor = fecha_base
    while dias_contados < dias_a_sumar:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5 and cursor not in festivos:
            dias_contados += 1

    return datetime.combine(cursor, time(18, 0))
