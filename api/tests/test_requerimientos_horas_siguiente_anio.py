# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Bloque informativo único, independiente de liquidación y ANS."""
from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from bson import Decimal128
from pydantic import ValidationError

from app.documents.bitacora import Bitacora
from app.documents.enums import AnsResultado
from app.documents.requerimiento import Requerimiento, Solicitud
from app.schemas.requerimiento import RequerimientoIn, RequerimientoUpdate
from tests.conftest import headers_con_token

CAMPOS = (
    "horas_siguiente_anio",
    "fecha_entrega_comprometida_siguiente_anio",
    "fecha_real_entrega_siguiente_anio",
)
BLOQUE = dict(zip(CAMPOS, ("12.75", "2024-06-01T00:00:00", "2028-02-01T00:00:00"), strict=True))
DATOS_BASE = {
    "codigo_req": "REQ-SIGUIENTE",
    "solicitud": {"codigo_sc": "SC-SIGUIENTE"},
    "estado": "ABIERTO",
}


async def _crear(codigo_app: str, **datos) -> Requerimiento:
    return await Requerimiento(
        aplicacion_id=codigo_app,
        codigo_req=DATOS_BASE["codigo_req"],
        solicitud=Solicitud(codigo_sc="SC-SIGUIENTE"),
        estado="ABIERTO",
        total_horas_estimadas=Decimal("10"),
        **datos,
    ).insert()


@pytest.mark.parametrize("esquema", [RequerimientoIn, RequerimientoUpdate, Requerimiento])
@pytest.mark.parametrize("horas", ["-0.01", "NaN", "sNaN", "Infinity", "-Infinity"])
def test_rechaza_horas_negativas_y_no_finitas(esquema, horas):
    with pytest.raises(ValidationError):
        esquema.model_validate({
            **DATOS_BASE, "aplicacion_id": "app-test", "horas_siguiente_anio": horas,
        })


@pytest.mark.parametrize("horas", [None, "0", "0.125", Decimal128("2.5")])
def test_documento_acepta_horas_validas(horas):
    req = Requerimiento(
        aplicacion_id="app-test",
        **DATOS_BASE,
        horas_siguiente_anio=horas,
    )
    esperado = horas.to_decimal() if isinstance(horas, Decimal128) else horas
    assert req.horas_siguiente_anio == (Decimal(esperado) if esperado is not None else None)


async def test_crear_leer_cambiar_omitir_y_limpiar(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario(
        [app.codigo],
        permisos=["requerimientos.crear", "requerimientos.ver", "requerimientos.editar"],
    )
    headers = headers_con_token(token, app.codigo)
    respuesta = await cliente.post(
        "/api/requerimientos", json={**DATOS_BASE, **BLOQUE}, headers=headers,
    )
    assert respuesta.status_code == 201
    ruta = f"/api/requerimientos/{respuesta.json()['_id']}"
    filtro = {"aplicacion_id": app.codigo, "codigo_req": DATOS_BASE["codigo_req"]}
    persistido = await Requerimiento.find_one(filtro)
    assert persistido.horas_siguiente_anio == Decimal("12.75")
    assert persistido.fecha_entrega_comprometida_siguiente_anio == datetime(2024, 6, 1)
    assert persistido.fecha_real_entrega_siguiente_anio == datetime(2028, 2, 1)
    leido = await cliente.get(ruta, headers=headers)
    assert leido.status_code == 200
    assert leido.json()["horas_siguiente_anio"] == 12.75

    cambiado = await cliente.put(ruta, json={"horas_siguiente_anio": 0}, headers=headers)
    assert cambiado.status_code == 200
    assert cambiado.json()["horas_siguiente_anio"] == 0
    nuevas_fechas = {
        "fecha_entrega_comprometida_siguiente_anio": "2023-05-01T00:00:00",
        "fecha_real_entrega_siguiente_anio": "2029-03-01T00:00:00",
    }
    fechas_cambiadas = await cliente.put(ruta, json=nuevas_fechas, headers=headers)
    assert fechas_cambiadas.status_code == 200
    omitido = await cliente.put(ruta, json={"nombre": "Solo nombre"}, headers=headers)
    assert omitido.status_code == 200
    persistido = await Requerimiento.find_one(filtro)
    assert persistido.horas_siguiente_anio == Decimal("0")
    assert persistido.fecha_entrega_comprometida_siguiente_anio == datetime(2023, 5, 1)
    assert persistido.fecha_real_entrega_siguiente_anio == datetime(2029, 3, 1)

    limpiado = await cliente.put(ruta, json=dict.fromkeys(CAMPOS), headers=headers)
    assert limpiado.status_code == 200
    assert all(limpiado.json()[campo] is None for campo in CAMPOS)
    persistido = await Requerimiento.find_one(filtro)
    assert all(getattr(persistido, campo) is None for campo in CAMPOS)
    registros = await Bitacora.find({
        "aplicacion_id": app.codigo, "entidad_id": str(persistido.id), "accion": "actualizar",
    }).to_list()
    assert any("Horas para el siguiente año: '12.75' → '0'" in r.descripcion for r in registros)
    assert any("Horas para el siguiente año: '0' → ''" in r.descripcion for r in registros)
    assert any("Fecha entrega comprometida siguiente año" in r.descripcion for r in registros)
    assert any("Fecha real entrega siguiente año" in r.descripcion for r in registros)


async def test_documento_antiguo_sin_campos_carga_null(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    app = await fabrica_aplicacion()
    req = await _crear(app.codigo)
    await Requerimiento.get_pymongo_collection().update_one(
        {"aplicacion_id": app.codigo, "_id": req.id},
        {"$unset": dict.fromkeys(CAMPOS, "")},
    )
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.ver"])
    respuesta = await cliente.get(
        f"/api/requerimientos/{req.id}", headers=headers_con_token(token, app.codigo),
    )
    assert respuesta.status_code == 200
    assert all(respuesta.json()[campo] is None for campo in CAMPOS)


@pytest.mark.parametrize("tiene_solicitud", [False, True])
@pytest.mark.parametrize("cambios", [
    BLOQUE,
    *({campo: BLOQUE[campo]} for campo in CAMPOS),
    dict.fromkeys(CAMPOS),
])
async def test_solo_bloque_no_calcula_ni_modifica_ans(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch, cambios, tiene_solicitud,
):
    app = await fabrica_aplicacion()
    limite = datetime(2026, 4, 10, 18)
    req = await _crear(
        app.codigo,
        fecha_solicitud_acta=datetime(2026, 4, 1) if tiene_solicitud else None,
        fecha_real_entrega_estimacion=datetime(2026, 4, 2),
        fecha_limite=limite,
        ans_acta=AnsResultado.NO_CUMPLE,
    )
    calcular = AsyncMock(side_effect=AssertionError("No debe recalcular ANS"))
    monkeypatch.setattr("app.services.fecha_limite.calcular_fecha_limite", calcular)
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar"])
    respuesta = await cliente.put(
        f"/api/requerimientos/{req.id}", json=cambios,
        headers=headers_con_token(token, app.codigo),
    )
    assert respuesta.status_code == 200
    calcular.assert_not_awaited()
    actualizado = await Requerimiento.find_one({"aplicacion_id": app.codigo, "_id": req.id})
    assert actualizado.fecha_limite == limite
    assert actualizado.ans_acta == AnsResultado.NO_CUMPLE
    assert actualizado.total_horas_estimadas == Decimal("10")
    assert actualizado.entregas == []


@pytest.mark.parametrize("cambios", [{}, {"nombre": "General"}, {**BLOQUE, "nombre": "Mixto"}])
async def test_put_preexistente_y_mixto_conservan_recalculo(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch, cambios,
):
    app = await fabrica_aplicacion()
    solicitud = datetime(2026, 4, 1)
    limite = datetime(2026, 4, 10, 18)
    req = await _crear(
        app.codigo, fecha_solicitud_acta=solicitud,
        fecha_real_entrega_estimacion=datetime(2026, 4, 2),
        ans_acta=AnsResultado.NO_CUMPLE,
    )
    calcular = AsyncMock(return_value=limite)
    monkeypatch.setattr("app.services.fecha_limite.calcular_fecha_limite", calcular)
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar"])
    respuesta = await cliente.put(
        f"/api/requerimientos/{req.id}", json=cambios,
        headers=headers_con_token(token, app.codigo),
    )
    assert respuesta.status_code == 200
    calcular.assert_awaited_once_with(app.codigo, solicitud, 10.0)
    actualizado = await Requerimiento.find_one({"aplicacion_id": app.codigo, "_id": req.id})
    assert actualizado.fecha_limite == limite
    assert actualizado.ans_acta == AnsResultado.CUMPLE


@pytest.mark.parametrize("horas", ["-1", "NaN", "Infinity", "-Infinity"])
async def test_http_rechaza_horas_invalidas(
    cliente, fabrica_aplicacion, fabrica_usuario, horas,
):
    app = await fabrica_aplicacion()
    req = await _crear(app.codigo)
    _, token = await fabrica_usuario(
        [app.codigo], permisos=["requerimientos.crear", "requerimientos.editar"],
    )
    headers = headers_con_token(token, app.codigo)
    datos = {"horas_siguiente_anio": horas}
    creado = await cliente.post(
        "/api/requerimientos", json={**DATOS_BASE, **datos}, headers=headers,
    )
    cambiado = await cliente.put(f"/api/requerimientos/{req.id}", json=datos, headers=headers)
    assert creado.status_code == 422
    assert cambiado.status_code == 422


async def test_permisos_aislamiento_y_consolidado(
    cliente, fabrica_aplicacion, fabrica_usuario, superadmin_token,
):
    app = await fabrica_aplicacion()
    otra = await fabrica_aplicacion()
    req = await _crear(app.codigo)
    _, sin_permiso = await fabrica_usuario([app.codigo], permisos=[])
    headers = headers_con_token(sin_permiso, app.codigo)
    creado = await cliente.post(
        "/api/requerimientos", json={**DATOS_BASE, **BLOQUE}, headers=headers,
    )
    cambiado = await cliente.put(
        f"/api/requerimientos/{req.id}", json=BLOQUE, headers=headers,
    )
    assert creado.status_code == 403
    assert cambiado.status_code == 403

    _, token = await fabrica_usuario(
        [app.codigo, otra.codigo], permisos=["requerimientos.ver", "requerimientos.editar"],
    )
    for metodo in ("get", "put"):
        argumentos = {"json": BLOQUE} if metodo == "put" else {}
        respuesta = await getattr(cliente, metodo)(
            f"/api/requerimientos/{req.id}",
            headers=headers_con_token(token, otra.codigo), **argumentos,
        )
        assert respuesta.status_code == 404
    consolidado = await cliente.put(
        f"/api/requerimientos/{req.id}", json=BLOQUE,
        headers=headers_con_token(superadmin_token, "__todas__"),
    )
    assert consolidado.status_code == 409
    intacto = await Requerimiento.find_one({"aplicacion_id": app.codigo, "_id": req.id})
    assert intacto.horas_siguiente_anio is None
