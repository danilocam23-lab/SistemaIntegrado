"""Tests de ``ANSService.calcular`` (ADR-0008 F2.2), incluida la regresión C1."""
from datetime import date, datetime

import pytest

from app.documents.enums import AnsResultado
from app.documents.festivo import Festivo
from app.services.ans import ANSService


async def test_cumple_cuando_los_dias_habiles_no_superan_el_umbral(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    # Lunes a viernes de la misma semana: 5 días hábiles, sin fin de semana de por medio.
    resultado = await ANSService.calcular(app.codigo, date(2025, 1, 6), date(2025, 1, 10), 5)
    assert resultado == AnsResultado.CUMPLE


async def test_no_cumple_cuando_los_dias_habiles_superan_el_umbral(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    resultado = await ANSService.calcular(app.codigo, date(2025, 1, 6), date(2025, 1, 10), 4)
    assert resultado == AnsResultado.NO_CUMPLE


async def test_el_fin_de_semana_no_cuenta_como_dia_habil(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    # 2025-01-06 (lunes) a 2025-01-12 (domingo): 5 días hábiles (lun-vie).
    resultado = await ANSService.calcular(app.codigo, date(2025, 1, 6), date(2025, 1, 12), 5)
    assert resultado == AnsResultado.CUMPLE


async def test_un_festivo_de_la_propia_aplicacion_se_descuenta(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await Festivo(aplicacion_id=app.codigo, fecha=datetime(2025, 1, 8)).insert()
    # Sin el festivo serían 5 días hábiles; con él, 4.
    resultado = await ANSService.calcular(app.codigo, date(2025, 1, 6), date(2025, 1, 10), 4)
    assert resultado == AnsResultado.CUMPLE


async def test_fecha_fin_anterior_a_inicio_lanza_value_error(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    with pytest.raises(ValueError):
        await ANSService.calcular(app.codigo, date(2025, 1, 10), date(2025, 1, 6), 3)


@pytest.mark.xfail(
    strict=True,
    reason=(
        "ADR-0008 C1: ANSService.calcular filtra Festivo.aplicacion_id == aplicacion_id "
        "pero POST /api/festivos crea todos los festivos con aplicacion_id='global' "
        "(festivos.py), así que un festivo cargado desde la UI nunca se descuenta del "
        "ANS. Pendiente de corregir en F3.6 (unificar el criterio a "
        "{'$in': [aplicacion_id, 'global']}). Este test documenta el bug: hoy falla "
        "porque el festivo global se ignora y el resultado sale NO_CUMPLE en vez de "
        "CUMPLE."
    ),
)
async def test_c1_un_festivo_global_tambien_deberia_descontarse(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    # Igual que el test anterior pero con aplicacion_id="global" (como los crea
    # POST /api/festivos hoy) en vez del código real de la aplicación.
    await Festivo(aplicacion_id="global", fecha=datetime(2025, 1, 8)).insert()
    resultado = await ANSService.calcular(app.codigo, date(2025, 1, 6), date(2025, 1, 10), 4)
    assert resultado == AnsResultado.CUMPLE
