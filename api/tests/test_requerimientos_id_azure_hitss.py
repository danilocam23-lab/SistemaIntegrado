# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Test de `PATCH /api/requerimientos/{codigo_req}/id-azure-hitss`.

Cubre el permiso granular ``requerimientos.id_azure_hitss.editar``, que
permite editar solo el ID de Azure (Hitss) sin dar acceso al PUT general
de "Datos generales" (gateado por ``requerimientos.editar``); mismo patrón
que ``PATCH /detalle-ans`` (ver ``actualizar_detalle_ans_req``).
"""
from decimal import Decimal

from app.documents.bitacora import Bitacora
from app.documents.requerimiento import Requerimiento, Solicitud
from tests.conftest import headers_con_token


async def _crear_requerimiento(app_codigo: str, codigo_req: str = "REQ-1") -> Requerimiento:
    return await Requerimiento(
        aplicacion_id=app_codigo,
        codigo_req=codigo_req,
        solicitud=Solicitud(codigo_sc="SC-1"),
        estado="ABIERTO",
        total_horas_estimadas=Decimal("10"),
        id_azure_hitss=100,
    ).insert()


async def test_permiso_granular_permite_patch_pero_no_put_general(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    req = await _crear_requerimiento(app.codigo)
    _, token = await fabrica_usuario(
        [app.codigo], permisos=["requerimientos.id_azure_hitss.editar"]
    )

    resp = await cliente.patch(
        f"/api/requerimientos/{req.codigo_req}/id-azure-hitss",
        json={"id_azure_hitss": 200},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 200
    assert resp.json()["id_azure_hitss"] == 200

    actualizado = await Requerimiento.get(req.id)
    assert actualizado.id_azure_hitss == 200

    # El mismo usuario NO puede tocar el PUT general (Datos generales).
    resp_put = await cliente.put(
        f"/api/requerimientos/{req.codigo_req}",
        json={"nombre": "Nuevo nombre"},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp_put.status_code == 403


async def test_permiso_general_tambien_permite_el_patch(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    req = await _crear_requerimiento(app.codigo)
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar"])

    resp = await cliente.patch(
        f"/api/requerimientos/{req.codigo_req}/id-azure-hitss",
        json={"id_azure_hitss": 300},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 200
    assert resp.json()["id_azure_hitss"] == 300


async def test_sin_ninguno_de_los_dos_permisos_da_403(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    req = await _crear_requerimiento(app.codigo)
    _, token = await fabrica_usuario([app.codigo], permisos=[])

    resp = await cliente.patch(
        f"/api/requerimientos/{req.codigo_req}/id-azure-hitss",
        json={"id_azure_hitss": 400},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 403


async def test_bitacora_registra_cambio_y_no_duplica_si_no_hay_cambio(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    req = await _crear_requerimiento(app.codigo)
    _, token = await fabrica_usuario(
        [app.codigo], permisos=["requerimientos.id_azure_hitss.editar"]
    )

    resp = await cliente.patch(
        f"/api/requerimientos/{req.codigo_req}/id-azure-hitss",
        json={"id_azure_hitss": 500},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 200

    registros = await Bitacora.find(
        Bitacora.entidad_tipo == "requerimiento",
        Bitacora.entidad_id == str(req.id),
    ).to_list()
    assert len(registros) == 1
    assert "100" in registros[0].descripcion
    assert "500" in registros[0].descripcion

    # Reenviar el mismo valor no debe generar una segunda entrada de bitácora.
    resp2 = await cliente.patch(
        f"/api/requerimientos/{req.codigo_req}/id-azure-hitss",
        json={"id_azure_hitss": 500},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp2.status_code == 200

    registros_2 = await Bitacora.find(
        Bitacora.entidad_tipo == "requerimiento",
        Bitacora.entidad_id == str(req.id),
    ).to_list()
    assert len(registros_2) == 1
