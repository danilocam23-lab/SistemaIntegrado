# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Bloque informativo único, independiente de liquidación y ANS."""
from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from bson import Decimal128
from pydantic import ValidationError

from app.api import bitacora as bitacora_api
from app.documents.bitacora import Bitacora
from app.documents.enums import AnsResultado
from app.documents.requerimiento import Requerimiento, Solicitud
from app.schemas.requerimiento import (
    HorasSiguienteAnioUpdate,
    RequerimientoIn,
    RequerimientoUpdate,
)
from tests.conftest import headers_con_token

CAMPOS = (
    "horas_siguiente_anio",
    "fecha_entrega_comprometida_siguiente_anio",
    "fecha_real_entrega_siguiente_anio",
)
VER = "requerimientos.horas_siguiente_anio.ver"
EDITAR = "requerimientos.horas_siguiente_anio.editar"
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
        permisos=[
            "requerimientos.crear", "requerimientos.ver", "requerimientos.editar", VER, EDITAR,
        ],
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
    assert any("Horas para el siguiente año: modificado" in r.descripcion for r in registros)
    assert all(
        "12.75" not in r.descripcion and "2028-02-01" not in r.descripcion for r in registros
    )
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
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.ver", VER])
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
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar", EDITAR])
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
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar", EDITAR])
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
        [app.codigo], permisos=["requerimientos.crear", "requerimientos.editar", EDITAR],
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
        [app.codigo, otra.codigo],
        permisos=["requerimientos.ver", "requerimientos.editar", EDITAR],
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


@pytest.mark.parametrize("especiales", [[], [VER], [EDITAR], [VER, EDITAR], ["*"]])
async def test_matriz_listado_detalle_y_patch(
    cliente, fabrica_aplicacion, fabrica_usuario, especiales,
):
    app = await fabrica_aplicacion()
    req = await _crear(app.codigo, **BLOQUE)
    _, token = await fabrica_usuario(
        [app.codigo], permisos=["requerimientos.ver", *especiales],
    )
    headers = headers_con_token(token, app.codigo)
    ruta = f"/api/requerimientos/{req.id}"
    puede_ver = VER in especiales or "*" in especiales
    puede_editar = EDITAR in especiales or "*" in especiales
    for url in (ruta, "/api/requerimientos"):
        respuesta = await cliente.get(url, headers=headers)
        assert respuesta.status_code == 200
        filas = respuesta.json() if isinstance(respuesta.json(), list) else [respuesta.json()]
        assert filas
        for fila in filas:
            assert fila["_id"] == str(req.id)
            for campo in CAMPOS:
                assert (campo in fila) == puede_ver
    respuesta = await cliente.patch(
        ruta + "/horas-siguiente-anio", json={"horas_siguiente_anio": "0.125"},
        headers=headers,
    )
    assert respuesta.status_code == (200 if puede_editar else 403)
    if puede_editar:
        assert respuesta.json()["_id"] == str(req.id)
        assert all((campo in respuesta.json()) == puede_ver for campo in CAMPOS)
    persistido = await Requerimiento.find_one({"aplicacion_id": app.codigo, "_id": req.id})
    assert persistido.horas_siguiente_anio == Decimal("0.125" if puede_editar else "12.75")
    assert persistido.fecha_real_entrega_siguiente_anio == datetime(2028, 2, 1)


@pytest.mark.parametrize("especiales", [[], [VER]])
@pytest.mark.parametrize("campo", CAMPOS)
async def test_post_put_generales_no_saltan_permiso_especial(
    cliente, fabrica_aplicacion, fabrica_usuario, especiales, campo,
):
    app = await fabrica_aplicacion()
    req = await _crear(app.codigo, **BLOQUE)
    _, token = await fabrica_usuario(
        [app.codigo],
        permisos=["requerimientos.crear", "requerimientos.editar", *especiales],
    )
    headers = headers_con_token(token, app.codigo)
    ruta = f"/api/requerimientos/{req.id}"
    for valor in (None, BLOQUE[campo]):
        respuesta = await cliente.put(ruta, json={campo: valor}, headers=headers)
        assert respuesta.status_code == 403
        respuesta = await cliente.post(
            "/api/requerimientos",
            json={**DATOS_BASE, "codigo_req": "REQ-NUEVO", campo: valor}, headers=headers,
        )
        assert respuesta.status_code == 403
    omitido = await cliente.put(ruta, json={"nombre": "Permitido"}, headers=headers)
    assert omitido.status_code == 200
    assert all((campo in omitido.json()) == (VER in especiales) for campo in CAMPOS)
    creado = await cliente.post(
        "/api/requerimientos", json={**DATOS_BASE, "codigo_req": "REQ-NUEVO"},
        headers=headers,
    )
    assert creado.status_code == 201
    assert all((campo in creado.json()) == (VER in especiales) for campo in CAMPOS)
    persistido = await Requerimiento.find_one({"aplicacion_id": app.codigo, "_id": req.id})
    assert persistido.horas_siguiente_anio == Decimal("12.75")
    assert persistido.fecha_real_entrega_siguiente_anio == datetime(2028, 2, 1)


@pytest.mark.parametrize("especiales", [[EDITAR], [VER, EDITAR], ["*"]])
async def test_post_put_con_edicion_respetan_lectura_independiente(
    cliente, fabrica_aplicacion, fabrica_usuario, especiales,
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario(
        [app.codigo],
        permisos=["requerimientos.crear", "requerimientos.editar", *especiales],
    )
    headers = headers_con_token(token, app.codigo)
    creado = await cliente.post(
        "/api/requerimientos", json={**DATOS_BASE, **BLOQUE}, headers=headers,
    )
    assert creado.status_code == 201
    puede_ver = VER in especiales or "*" in especiales
    assert all((campo in creado.json()) == puede_ver for campo in CAMPOS)
    cambiado = await cliente.put(
        f"/api/requerimientos/{creado.json()['_id']}",
        json={"horas_siguiente_anio": "0.5"}, headers=headers,
    )
    assert cambiado.status_code == 200
    assert all((campo in cambiado.json()) == puede_ver for campo in CAMPOS)
    persistido = await Requerimiento.find_one({
        "aplicacion_id": app.codigo, "codigo_req": DATOS_BASE["codigo_req"],
    })
    assert persistido.horas_siguiente_anio == Decimal("0.5")
    assert persistido.fecha_real_entrega_siguiente_anio == datetime(2028, 2, 1)
    registros = await Bitacora.find({
        "aplicacion_id": app.codigo, "entidad_id": str(persistido.id),
    }).to_list()
    assert all(
        "12.75" not in r.descripcion and "2028-02-01" not in r.descripcion for r in registros
    )


@pytest.mark.parametrize("horas", [None, "0", "0.125"])
async def test_patch_null_cero_fraccion_omitidos_e_invariancia(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch, horas,
):
    app = await fabrica_aplicacion()
    limite = datetime(2026, 4, 10)
    req = await _crear(
        app.codigo, **BLOQUE, fecha_limite=limite, ans_acta=AnsResultado.NO_CUMPLE,
        fecha_solicitud_acta=datetime(2026, 4, 1),
    )
    calcular = AsyncMock(side_effect=AssertionError("No debe recalcular"))
    monkeypatch.setattr("app.services.fecha_limite.calcular_fecha_limite", calcular)
    _, token = await fabrica_usuario([app.codigo], permisos=[EDITAR])
    headers = headers_con_token(token, app.codigo)
    ruta = f"/api/requerimientos/{req.id}/horas-siguiente-anio"
    respuesta = await cliente.patch(ruta, json={"horas_siguiente_anio": horas}, headers=headers)
    assert respuesta.status_code == 200
    assert all(campo not in respuesta.json() for campo in CAMPOS)
    vacio = await cliente.patch(ruta, json={}, headers=headers)
    assert vacio.status_code == 200
    persistido = await Requerimiento.find_one({"aplicacion_id": app.codigo, "_id": req.id})
    assert persistido.horas_siguiente_anio == (Decimal(horas) if horas is not None else None)
    assert persistido.fecha_real_entrega_siguiente_anio == datetime(2028, 2, 1)
    assert persistido.fecha_entrega_comprometida_siguiente_anio == datetime(2024, 6, 1)
    assert persistido.fecha_limite == limite
    assert persistido.ans_acta == AnsResultado.NO_CUMPLE
    assert persistido.total_horas_estimadas == Decimal("10")
    assert persistido.entregas == []
    calcular.assert_not_awaited()
    limpiado = await cliente.patch(ruta, json=dict.fromkeys(CAMPOS), headers=headers)
    assert limpiado.status_code == 200
    persistido = await Requerimiento.find_one({"aplicacion_id": app.codigo, "_id": req.id})
    assert all(getattr(persistido, campo) is None for campo in CAMPOS)


@pytest.mark.parametrize("extra", [
    {"nombre": "No permitido"}, {"ans_acta": "CUMPLE"}, {"fecha_limite": None},
    {"total_horas_estimadas": 50}, {"entregas": []},
])
async def test_patch_rechaza_campos_ajenos(
    cliente, fabrica_aplicacion, fabrica_usuario, extra,
):
    app = await fabrica_aplicacion()
    req = await _crear(app.codigo)
    _, token = await fabrica_usuario([app.codigo], permisos=[EDITAR])
    respuesta = await cliente.patch(
        f"/api/requerimientos/{req.id}/horas-siguiente-anio",
        json={"horas_siguiente_anio": 10, **extra},
        headers=headers_con_token(token, app.codigo),
    )
    assert respuesta.status_code == 422
    persistido = await Requerimiento.find_one({"aplicacion_id": app.codigo, "_id": req.id})
    assert persistido.horas_siguiente_anio is None


@pytest.mark.parametrize("horas", ["-1", "NaN", "sNaN", "Infinity", "-Infinity"])
async def test_patch_rechaza_horas_invalidas(
    cliente, fabrica_aplicacion, fabrica_usuario, horas,
):
    app = await fabrica_aplicacion()
    req = await _crear(app.codigo)
    _, token = await fabrica_usuario([app.codigo], permisos=[EDITAR])
    respuesta = await cliente.patch(
        f"/api/requerimientos/{req.id}/horas-siguiente-anio",
        json={"horas_siguiente_anio": horas}, headers=headers_con_token(token, app.codigo),
    )
    assert respuesta.status_code == 422


async def test_patch_aislamiento_consolidado_y_sin_edicion_general(
    cliente, fabrica_aplicacion, fabrica_usuario, superadmin_token,
):
    app = await fabrica_aplicacion()
    otra = await fabrica_aplicacion()
    req = await _crear(app.codigo)
    _, token = await fabrica_usuario([app.codigo, otra.codigo], permisos=[EDITAR])
    ruta = f"/api/requerimientos/{req.id}"
    ajeno = await cliente.patch(
        ruta + "/horas-siguiente-anio", json=BLOQUE,
        headers=headers_con_token(token, otra.codigo),
    )
    assert ajeno.status_code == 404
    consolidado = await cliente.patch(
        ruta + "/horas-siguiente-anio", json=BLOQUE,
        headers=headers_con_token(superadmin_token, "__todas__"),
    )
    assert consolidado.status_code == 409
    general = await cliente.put(ruta, json=BLOQUE, headers=headers_con_token(token, app.codigo))
    assert general.status_code == 403
    correcto = await cliente.patch(
        ruta + "/horas-siguiente-anio", json=BLOQUE, headers=headers_con_token(token, app.codigo),
    )
    assert correcto.status_code == 200
    assert all(campo not in correcto.json() for campo in CAMPOS)
    leido = await cliente.get(
        ruta, headers=headers_con_token(superadmin_token, app.codigo),
    )
    assert leido.json()["horas_siguiente_anio"] == 12.75


@pytest.mark.parametrize("metodo,sufijo,cuerpo", [
    ("patch", "/analista", {"analista_requerimientos_id": "analista-sintetico"}),
    ("patch", "/analista", {"analista_requerimientos_id": None}),
    ("patch", "/id-azure-hitss", {"id_azure_hitss": 123}),
    ("patch", "/id-azure-hitss", {"id_azure_hitss": None}),
    ("post", "/transicion", {"nuevo_estado": "EN PROCESO"}),
    ("post", "/entregas", {"numero": 1, "fecha_comprometida": "2027-01-01T00:00:00"}),
    ("delete", "/entregas/1", None),
    ("put", "", {"nombre": "Cambio general"}),
])
async def test_mutaciones_no_filtran_bloque_en_respuesta(
    cliente, fabrica_aplicacion, fabrica_usuario, metodo, sufijo, cuerpo,
):
    from app.documents.persona import Persona
    from app.documents.requerimiento import Entrega

    app = await fabrica_aplicacion()
    analista = await Persona(
        aplicacion_id=app.codigo, nombre="Analista", rol_operativo="AR/QA"
    ).insert()
    if cuerpo and cuerpo.get("analista_requerimientos_id") == "analista-sintetico":
        cuerpo = {"analista_requerimientos_id": str(analista.id)}
    req = await _crear(app.codigo, **BLOQUE, entregas=[Entrega(numero=1)])
    _, token = await fabrica_usuario([app.codigo], permisos=["requerimientos.editar"])
    argumentos = {"json": cuerpo} if cuerpo is not None else {}
    respuesta = await getattr(cliente, metodo)(
        f"/api/requerimientos/{req.id}{sufijo}",
        headers=headers_con_token(token, app.codigo), **argumentos,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["_id"] == str(req.id)
    assert all(campo not in respuesta.json() for campo in CAMPOS)
    persistido = await Requerimiento.find_one({"aplicacion_id": app.codigo, "_id": req.id})
    assert persistido.horas_siguiente_anio == Decimal("12.75")


async def test_bitacora_nueva_registra_campos_sin_valores(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    app = await fabrica_aplicacion()
    req = await _crear(app.codigo)
    _, editor = await fabrica_usuario(
        [app.codigo], permisos=["requerimientos.editar", EDITAR],
    )
    ruta = f"/api/requerimientos/{req.id}"
    headers = headers_con_token(editor, app.codigo)
    assert (await cliente.put(ruta, json=BLOQUE, headers=headers)).status_code == 200
    assert (await cliente.patch(
        ruta + "/horas-siguiente-anio", json=dict.fromkeys(CAMPOS), headers=headers,
    )).status_code == 200
    _, lector = await fabrica_usuario([app.codigo], permisos=["requerimientos.ver"])
    respuesta = await cliente.get(
        "/api/bitacora", params={"entidad_id": str(req.id)},
        headers=headers_con_token(lector, app.codigo),
    )
    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 2
    assert "12.75" not in respuesta.text
    assert "2024-06-01" not in respuesta.text
    assert "2028-02-01" not in respuesta.text
    assert all(
        fila["descripcion"] == "Detalle restringido de horas para el siguiente año"
        for fila in respuesta.json()
    )


@pytest.mark.parametrize("especiales", [[], [EDITAR], [VER]])
async def test_bitacora_historica_restringe_solo_descripcion_sin_mutar(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch, especiales,
):
    app = await fabrica_aplicacion()
    usuario, token = await fabrica_usuario(
        [app.codigo], permisos=["requerimientos.ver", *especiales],
    )
    nombres = (
        "Horas para el siguiente año",
        "Fecha entrega comprometida siguiente año",
        "Fecha real entrega siguiente año",
        *CAMPOS,
    )
    restringidos = set()
    for nombre in nombres:
        evento = await Bitacora(
            aplicacion_id=app.codigo,
            entidad_tipo="requerimiento",
            entidad_id="req-historico",
            accion="actualizar",
            descripcion=f"Nombre: anterior → nuevo; {nombre}: 12.75 → 2028-02-01",
            autor="Autor histórico",
            datos_antes={"nombre": "anterior"},
            datos_despues={"nombre": "nuevo"},
        ).insert()
        restringidos.add(str(evento.id))
    for entidad_tipo, descripcion in (
        ("requerimiento", "Nombre: anterior → nuevo; horas estimadas: 10 → 20"),
        ("requerimiento", ""),
        ("entrega", "Horas para el siguiente año: texto de otra entidad"),
    ):
        await Bitacora(
            aplicacion_id=app.codigo,
            entidad_tipo=entidad_tipo,
            entidad_id="req-historico",
            accion="actualizar",
            descripcion=descripcion,
        ).insert()

    col = Bitacora.get_pymongo_collection()
    filtro = {"aplicacion_id": app.codigo, "entidad_id": "req-historico"}
    antes = await col.find(filtro).sort("_id", 1).limit(20).to_list(None)
    comprobar_permiso = AsyncMock(wraps=bitacora_api.tiene_permiso)
    monkeypatch.setattr(bitacora_api, "tiene_permiso", comprobar_permiso)
    respuesta = await cliente.get(
        "/api/bitacora", params={"entidad_id": "req-historico"},
        headers=headers_con_token(token, app.codigo),
    )
    assert respuesta.status_code == 200
    comprobar_permiso.assert_awaited_once()
    assert comprobar_permiso.await_args.args[0].id == usuario.id
    assert comprobar_permiso.await_args.args[1] == VER
    recibidos = {fila["id"]: fila for fila in respuesta.json()}
    assert len(recibidos) == len(antes)
    for doc in antes:
        # La llamada sin booleano conserva el contrato anterior del serializador.
        esperado = bitacora_api._serializar_evento(doc)
        if VER not in especiales and esperado["id"] in restringidos:
            esperado["descripcion"] = "Detalle restringido de horas para el siguiente año"
        assert recibidos[esperado["id"]] == esperado
    despues = await col.find(filtro).sort("_id", 1).limit(20).to_list(None)
    assert despues == antes


def test_esquema_patch_rechaza_extras():
    with pytest.raises(ValidationError):
        HorasSiguienteAnioUpdate.model_validate({"estado": "CERRADO"})


async def test_admin_app_puede_guardar_sin_edicion_general(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    from app.documents.rol import Rol

    app = await fabrica_aplicacion()
    req = await _crear(app.codigo)
    rol = await Rol.find_one(Rol.clave == "admin_app")
    assert rol is not None
    assert EDITAR in rol.permisos and VER in rol.permisos
    assert "requerimientos.editar" not in rol.permisos
    usuario, token = await fabrica_usuario([app.codigo], rol="admin_app")
    usuario.rol_id = str(rol.id)
    await usuario.save()
    headers = headers_con_token(token, app.codigo)
    ruta = f"/api/requerimientos/{req.id}"
    general = await cliente.put(ruta, json=BLOQUE, headers=headers)
    assert general.status_code == 403
    independiente = await cliente.patch(
        ruta + "/horas-siguiente-anio", json=BLOQUE, headers=headers,
    )
    assert independiente.status_code == 200
    assert independiente.json()["horas_siguiente_anio"] == 12.75
    assert independiente.json()["fecha_real_entrega_siguiente_anio"].startswith("2028-02-01")
    assert independiente.json()["fecha_entrega_comprometida_siguiente_anio"].startswith(
        "2024-06-01"
    )


async def test_consolidado_respeta_lectura_especial(
    cliente, fabrica_aplicacion, fabrica_usuario,
):
    app = await fabrica_aplicacion()
    otra = await fabrica_aplicacion()
    req = await _crear(app.codigo, **BLOQUE)
    await _crear(otra.codigo, **BLOQUE)
    for especiales in ([], [VER]):
        _, token = await fabrica_usuario(
            [app.codigo, otra.codigo],
            permisos=["requerimientos.ver", "consolidado.ver", *especiales],
        )
        headers = headers_con_token(token, "__todas__")
        for ruta in ("/api/requerimientos", f"/api/requerimientos/{req.id}"):
            respuesta = await cliente.get(ruta, headers=headers)
            assert respuesta.status_code == 200
            filas = respuesta.json() if isinstance(respuesta.json(), list) else [respuesta.json()]
            assert filas
            assert all(
                (campo in fila) == (VER in especiales) for fila in filas for campo in CAMPOS
            )
