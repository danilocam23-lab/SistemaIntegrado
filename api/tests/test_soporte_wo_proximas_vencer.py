# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""``GET /soporte/solicitudes-fabrica/wo-proximas-vencer``: WO por vencer o vencidas."""
from datetime import date, timedelta

from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabrica
from app.services.soporte_solicitudes_fabrica_service import (
    clasificar_wo_proxima_vencer,
    estado_wo_cerrado,
    parsear_fecha_wo,
)
from app.services.vigencia import hoy_bogota
from tests.conftest import CONSOLIDADO, headers_con_token

RUTA = "/api/soporte/solicitudes-fabrica/wo-proximas-vencer"
RUTA_ALIAS = "/api/soporte/wo-proximas-vencer"


def _fecha(dias: int) -> str:
    return (hoy_bogota() + timedelta(days=dias)).isoformat()


async def _wo(app_codigo: str, fila: int, wo_id: str, fecha, status="Asignado", asignado="Ana"):
    datos = {
        "Work Order ID": wo_id,
        "Summary": f"Resumen {wo_id}",
        "Assigned To": asignado,
        "Status WO": status,
    }
    if fecha is not None:
        datos["Fecha_Programada_Fin"] = fecha
    await SoporteSolicitudFabrica(
        aplicacion_id=app_codigo, fila_origen=fila, lider="Lid", squad="Sq", datos=datos
    ).insert()


def test_parsear_fecha_wo():
    assert parsear_fecha_wo("2026-10-25") == date(2026, 10, 25)
    assert parsear_fecha_wo("2026-10-25T14:30:00") == date(2026, 10, 25)
    assert parsear_fecha_wo("2026-10-25 14:30:00") == date(2026, 10, 25)
    assert parsear_fecha_wo("25/10/2026") == date(2026, 10, 25)
    assert parsear_fecha_wo("25/10/2026 08:00") == date(2026, 10, 25)
    assert parsear_fecha_wo("") is None
    assert parsear_fecha_wo(None) is None
    assert parsear_fecha_wo("pronto") is None
    assert parsear_fecha_wo("31/02/2026") is None


def test_estado_wo_cerrado_insensible():
    assert estado_wo_cerrado(" CERRADO ")
    assert estado_wo_cerrado("Cancelado")
    assert estado_wo_cerrado("Terminádo")
    assert not estado_wo_cerrado("Asignado")
    assert not estado_wo_cerrado(None)


def test_clasificar_limites():
    hoy = date(2026, 10, 21)
    assert clasificar_wo_proxima_vencer({"Fecha_Programada_Fin": "2026-10-26"}, hoy, 5) == (
        "2026-10-26", 5)
    assert clasificar_wo_proxima_vencer({"Fecha_Programada_Fin": "2026-10-27"}, hoy, 5) is None
    assert clasificar_wo_proxima_vencer({"Fecha_Programada_Fin": "2026-10-20"}, hoy, 5) == (
        "2026-10-20", -1)


async def test_wo_proximas_vencer_reglas(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await _wo(app.codigo, 1, "WO-VENCIDA", _fecha(-3))
    await _wo(app.codigo, 2, "WO-5D", _fecha(5) + "T00:00:00")
    await _wo(app.codigo, 3, "WO-6D", _fecha(6))
    await _wo(app.codigo, 4, "WO-CERRADA", _fecha(1), status="Cerrado")
    await _wo(app.codigo, 5, "WO-CANCEL", _fecha(1), status=" cancelado ")
    await _wo(app.codigo, 6, "WO-TERMIN", _fecha(1), status="TERMINADO")
    await _wo(app.codigo, 7, "WO-SINASIG", _fecha(2), asignado="")
    await _wo(app.codigo, 8, "WO-SINFECHA", None)
    await _wo(app.codigo, 9, "WO-VACIA", "")
    await _wo(app.codigo, 10, "WO-INVALIDA", "no es fecha")
    _, token = await fabrica_usuario([app.codigo], permisos=["soporte.solicitudes_fabrica.ver"])
    resp = await cliente.get(RUTA, headers=headers_con_token(token, app.codigo))
    assert resp.status_code == 200, resp.text
    lista = resp.json()
    assert [r["wo_id"] for r in lista] == ["WO-VENCIDA", "WO-SINASIG", "WO-5D"]
    assert [r["dias_restantes"] for r in lista] == [-3, 2, 5]
    sin_asignar = lista[1]
    assert sin_asignar["assigned_to"] == ""
    assert lista[2]["fecha_programada_fin"] == _fecha(5)
    assert set(lista[0]) == {
        "id", "lider", "squad", "wo_id", "summary", "assigned_to", "status",
        "fecha_programada_fin", "dias_restantes",
    }
    assert lista[0]["lider"] == "Lid" and lista[0]["squad"] == "Sq"
    assert lista[0]["summary"] == "Resumen WO-VENCIDA"

    resp6 = await cliente.get(
        RUTA, params={"dias": 6}, headers=headers_con_token(token, app.codigo)
    )
    assert "WO-6D" in [r["wo_id"] for r in resp6.json()]

    alias = await cliente.get(RUTA_ALIAS, headers=headers_con_token(token, app.codigo))
    assert alias.status_code == 200 and alias.json() == lista


async def test_wo_proximas_vencer_sin_fuga_entre_aplicaciones(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    await _wo(app_a.codigo, 1, "WO-DE-A", _fecha(1))
    await _wo(app_b.codigo, 1, "WO-DE-B", _fecha(1))
    _, token = await fabrica_usuario(
        [app_a.codigo, app_b.codigo], permisos=["soporte.solicitudes_fabrica.ver"]
    )
    resp = await cliente.get(RUTA, headers=headers_con_token(token, app_a.codigo))
    assert [r["wo_id"] for r in resp.json()] == ["WO-DE-A"]


async def test_wo_proximas_vencer_consolidado(
    cliente, superadmin_token, fabrica_aplicacion
):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    await _wo(app_a.codigo, 1, "WO-CONS-A", _fecha(1))
    await _wo(app_b.codigo, 1, "WO-CONS-B", _fecha(1))
    resp = await cliente.get(RUTA, headers=headers_con_token(superadmin_token, CONSOLIDADO))
    assert resp.status_code == 200, resp.text
    ids = {r["wo_id"] for r in resp.json()}
    assert {"WO-CONS-A", "WO-CONS-B"} <= ids


async def test_wo_proximas_vencer_exige_permiso(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=[])
    resp = await cliente.get(RUTA, headers=headers_con_token(token, app.codigo))
    assert resp.status_code == 403
