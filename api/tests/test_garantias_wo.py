# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Test de `GET /api/garantias-wo` (ADR-0008 F3.3/C4, P7).

El backfill de `descripcion`/`estado_wo` en registros antiguos hacía un
`find_one` + `save` por documento dentro del bucle (N+1); se reescribe con dos
consultas + un `bulk_write`. Este test verifica que el backfill sigue
completando lo que falta, deja intacto lo que ya estaba completo, y persiste
el cambio (no solo en la respuesta HTTP).
"""
from app.documents.garantia_wo import GarantiaWO
from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabrica
from tests.conftest import headers_con_token


async def test_listar_completa_registros_incompletos_y_persiste(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    await SoporteSolicitudFabrica(
        aplicacion_id=app.codigo,
        fila_origen=1,
        lider="Líder Uno",
        squad="Squad Uno",
        datos={
            "Work Order ID": "WO-1",
            "Detailed Description": "Descripción de la WO-1",
            "Status WO": "Abierta",
        },
    ).insert()
    incompleta = await GarantiaWO(
        work_order_id="WO-1", aplicacion_id=app.codigo, descripcion=None, estado_wo=None
    ).insert()
    completa = await GarantiaWO(
        work_order_id="WO-2",
        aplicacion_id=app.codigo,
        descripcion="Ya tenía descripción",
        estado_wo="Cerrada",
    ).insert()

    _, token = await fabrica_usuario(
        [app.codigo], permisos=["soporte.solicitudes_fabrica.ver"]
    )
    resp = await cliente.get(
        "/api/garantias-wo", headers=headers_con_token(token, app.codigo)
    )
    assert resp.status_code == 200
    por_wo = {f["work_order_id"]: f for f in resp.json()}
    assert por_wo["WO-1"]["descripcion"] == "Descripción de la WO-1"
    assert por_wo["WO-1"]["estado_wo"] == "Abierta"
    # La que ya estaba completa no se toca.
    assert por_wo["WO-2"]["descripcion"] == "Ya tenía descripción"
    assert por_wo["WO-2"]["estado_wo"] == "Cerrada"

    # El backfill debe quedar persistido, no solo en la respuesta HTTP.
    releida = await GarantiaWO.get(incompleta.id)
    assert releida is not None
    assert releida.descripcion == "Descripción de la WO-1"
    assert releida.estado_wo == "Abierta"
    releida_completa = await GarantiaWO.get(completa.id)
    assert releida_completa is not None
    assert releida_completa.descripcion == "Ya tenía descripción"
