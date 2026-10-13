# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""El resumen de solicitudes de fábrica incluye Horas y Minutos aprobados."""
from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabrica
from tests.conftest import headers_con_token


async def test_resumen_incluye_minutos_aprobados(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    await SoporteSolicitudFabrica(
        aplicacion_id=app.codigo, fila_origen=1, lider="L", squad="S",
        datos={"Work Order ID": "WO-9", "Horas_Aprobadas": "2", "Minutos_Aprobados": "120"},
    ).insert()
    await SoporteSolicitudFabrica(
        aplicacion_id=app.codigo, fila_origen=2, lider="L", squad="S",
        datos={"Work Order ID": "WO-10"},
    ).insert()
    _, token = await fabrica_usuario([app.codigo], permisos=["soporte.solicitudes_fabrica.ver"])
    resp = await cliente.get(
        "/api/soporte/solicitudes-fabrica/resumen", headers=headers_con_token(token, app.codigo)
    )
    assert resp.status_code == 200, resp.text
    por_wo = {r["Work_Order_ID"]: r for r in resp.json()["registros"]}
    assert por_wo["WO-9"]["Horas_Aprobadas"] == "2" and por_wo["WO-9"]["Minutos_Aprobados"] == "120"
    assert por_wo["WO-10"]["Minutos_Aprobados"] == ""
