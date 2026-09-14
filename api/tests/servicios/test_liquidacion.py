"""Tests de ``LiquidacionService`` (ADR-0008 F2.2), incluida la regresión C2.

Cada test usa un año de tarifa distinto (2101, 2102, ...) a propósito: C2
documenta que ``_tarifa_vigente`` no filtra por ``aplicacion_id`` (busca
``Tarifa.anio == anio`` en toda la base), así que dos tests que compartieran
año podrían "verse" la tarifa del otro. Usar años que ningún otro test toca
aísla estos tests del bug sin necesidad de limpiar la colección entre tests.
"""
from datetime import datetime
from decimal import Decimal

import pytest

from app.documents.enums import TipoCosto
from app.documents.requerimiento import Entrega, Requerimiento, Solicitud
from app.documents.tarifa import Tarifa
from app.services.liquidacion import LiquidacionService


def _requerimiento(aplicacion_id: str, tipo_costo: TipoCosto, monto_pactado=None) -> Requerimiento:
    return Requerimiento(
        aplicacion_id=aplicacion_id,
        codigo_req=f"REQ-{aplicacion_id}",
        solicitud=Solicitud(codigo_sc=f"SC-{aplicacion_id}", tipo_costo=tipo_costo),
        estado="ESTIMACION APROBADA ENTREGA PENDIENTE",
        monto_pactado=monto_pactado,
    )


async def test_una_entrega_en_garantia_no_se_factura(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    req = _requerimiento(app.codigo, TipoCosto.TYM)
    entrega = Entrega(numero=1, horas=Decimal("10"), garantia=True)
    assert await LiquidacionService.valor_entrega(req, entrega) == Decimal("0")


async def test_fijo_con_monto_pactado_usa_el_monto_tal_cual(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    req = _requerimiento(app.codigo, TipoCosto.FIJO, monto_pactado=Decimal("5000000"))
    entrega = Entrega(numero=1, horas=Decimal("999"))  # las horas no deberían importar
    valor = await LiquidacionService.valor_entrega(req, entrega)
    assert valor == Decimal("5000000")


async def test_fijo_sin_monto_pactado_usa_la_tarifa_del_anio(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await Tarifa(aplicacion_id=app.codigo, anio=2101, valor_hora=Decimal("100")).insert()
    req = _requerimiento(app.codigo, TipoCosto.FIJO)
    entrega = Entrega(numero=1, horas=Decimal("8"), fecha_aprobacion=datetime(2101, 3, 1))
    valor = await LiquidacionService.valor_entrega(req, entrega)
    assert valor == Decimal("800.00")


async def test_tym_usa_horas_por_valor_hora_de_la_tarifa(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await Tarifa(aplicacion_id=app.codigo, anio=2102, valor_hora=Decimal("50.5")).insert()
    req = _requerimiento(app.codigo, TipoCosto.TYM)
    entrega = Entrega(numero=1, horas=Decimal("4"), fecha_aprobacion=datetime(2102, 5, 1))
    valor = await LiquidacionService.valor_entrega(req, entrega)
    assert valor == Decimal("202.00")


async def test_sin_tarifa_para_el_anio_ni_ninguna_otra_lanza_value_error():
    # _tarifa_vigente cae a "la tarifa más reciente de cualquier squad" si no
    # hay ninguna del año pedido (ver C2 más abajo): para probar el caso
    # "no hay tarifa en absoluto" hay que garantizar que la colección esté
    # vacía, sin depender del orden de ejecución respecto a otros tests que sí
    # insertan tarifas (con sus propios años, ver el docstring del módulo).
    await Tarifa.find_all().delete()
    with pytest.raises(ValueError, match="No existe una tarifa"):
        await LiquidacionService._tarifa_vigente("app-sin-tarifas", None, datetime(2103, 1, 1))


@pytest.mark.xfail(
    strict=True,
    reason=(
        "ADR-0008 C2: _tarifa_vigente recibe aplicacion_id pero NO lo usa en la "
        "consulta (Tarifa.find(Tarifa.anio == anio) es global, sin filtro de "
        "aplicacion_id): una aplicación sin tarifa propia para el año puede terminar "
        "facturando con la tarifa de OTRA aplicación en vez de fallar. Además, con más "
        "de una candidata del mismo año, 'candidatas[0]' no tiene orden determinista. "
        "Pendiente de corregir en F3.6 (filtrar por aplicacion_id y desempatar con un "
        "criterio explícito)."
    ),
)
async def test_c2_tarifa_vigente_no_deberia_cruzar_aplicaciones(fabrica_aplicacion):
    propietaria = await fabrica_aplicacion()
    otra = await fabrica_aplicacion()
    await Tarifa(aplicacion_id=propietaria.codigo, anio=2104, valor_hora=Decimal("100")).insert()
    # "otra" no tiene tarifa propia del 2104: debería fallar, no heredar la de "propietaria".
    with pytest.raises(ValueError, match="No existe una tarifa"):
        await LiquidacionService._tarifa_vigente(otra.codigo, None, datetime(2104, 6, 1))
