"""Tests de ``calcular_fecha_limite`` (ADR-0008 F2.2), incluida la regresión C1."""
from datetime import datetime, time

import pytest

from app.documents.festivo import Festivo
from app.services.fecha_limite import calcular_fecha_limite


async def test_antes_de_las_18_cuenta_desde_el_mismo_dia_y_suma_3_dias_habiles_si_horas_bajas(
    fabrica_aplicacion,
):
    app = await fabrica_aplicacion()
    # Lunes 2025-01-06 a las 10:00, 10 horas (<=90) -> 3 días hábiles: mar, mié, jue.
    solicitud = datetime(2025, 1, 6, 10, 0)
    limite = await calcular_fecha_limite(app.codigo, solicitud, 10)
    assert limite == datetime(2025, 1, 9, 18, 0)


async def test_a_las_18_o_despues_cuenta_desde_el_siguiente_dia_habil(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    # Lunes 2025-01-06 a las 18:00 -> empieza a contar desde el martes.
    solicitud = datetime(2025, 1, 6, 18, 0)
    limite = await calcular_fecha_limite(app.codigo, solicitud, 10)
    # Base = martes 7; +3 días hábiles: mié, jue, vie.
    assert limite == datetime(2025, 1, 10, 18, 0)


async def test_mas_de_90_horas_suma_5_dias_habiles(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    solicitud = datetime(2025, 1, 6, 10, 0)
    limite = await calcular_fecha_limite(app.codigo, solicitud, 120)
    # Base = lunes 6; +5 días hábiles: mar, mié, jue, vie, lun(13).
    assert limite == datetime(2025, 1, 13, 18, 0)


async def test_base_en_fin_de_semana_avanza_al_siguiente_dia_habil(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    # Sábado 2025-01-11 a las 10:00 -> la base avanza al lunes 13.
    solicitud = datetime(2025, 1, 11, 10, 0)
    limite = await calcular_fecha_limite(app.codigo, solicitud, 10)
    # Base = lunes 13; +3 días hábiles: mar, mié, jue.
    assert limite == datetime(2025, 1, 16, 18, 0)


async def test_festivo_de_la_propia_aplicacion_se_descuenta(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    # Festivo el martes 7: los 3 días hábiles pasan a ser mié, jue, vie.
    await Festivo(aplicacion_id=app.codigo, fecha=datetime(2025, 1, 7)).insert()
    solicitud = datetime(2025, 1, 6, 10, 0)
    limite = await calcular_fecha_limite(app.codigo, solicitud, 10)
    assert limite == datetime(2025, 1, 10, 18, 0)


async def test_la_fecha_limite_siempre_es_a_las_18_00(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    limite = await calcular_fecha_limite(app.codigo, datetime(2025, 1, 6, 9, 0), 10)
    assert limite.time() == time(18, 0)


@pytest.mark.xfail(
    strict=True,
    reason=(
        "ADR-0008 C1: calcular_fecha_limite filtra Festivo.aplicacion_id == "
        "aplicacion_id pero POST /api/festivos crea todos los festivos con "
        "aplicacion_id='global', así que un festivo cargado desde la UI nunca se "
        "descuenta y la fecha límite del acta sale más temprana de lo debido. "
        "Pendiente de corregir en F3.6."
    ),
)
async def test_c1_un_festivo_global_tambien_deberia_descontarse(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await Festivo(aplicacion_id="global", fecha=datetime(2025, 1, 7)).insert()
    solicitud = datetime(2025, 1, 6, 10, 0)
    limite = await calcular_fecha_limite(app.codigo, solicitud, 10)
    assert limite == datetime(2025, 1, 10, 18, 0)
