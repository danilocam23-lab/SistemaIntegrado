# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""squad == aplicación en la escritura de backlog futuro y capacidades."""
from app.documents.persona import Persona
from tests.conftest import headers_con_token


async def _entorno(fabrica_aplicacion, fabrica_usuario, permisos):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=permisos)
    return app, headers_con_token(token, app.codigo)


async def test_backlog_squad_ajeno_da_422_y_vacio_se_fuerza_a_la_aplicacion(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    app, h = await _entorno(
        fabrica_aplicacion, fabrica_usuario, ["backlog_futuro.ver", "backlog_futuro.editar"]
    )
    cuerpo = {"nombre_iniciativa": "Idea", "squad_id": "otro-squad"}
    assert (await cliente.post("/api/backlog-futuro", json=cuerpo, headers=h)).status_code == 422

    creado = await cliente.post(
        "/api/backlog-futuro", json={**cuerpo, "squad_id": ""}, headers=h
    )
    assert creado.status_code == 201
    assert creado.json()["squad_id"] == app.codigo

    ok = await cliente.post(
        "/api/backlog-futuro", json={**cuerpo, "squad_id": app.codigo}, headers=h
    )
    assert ok.status_code == 201

    url = f"/api/backlog-futuro/{creado.json()['_id']}"
    assert (await cliente.put(url, json=cuerpo, headers=h)).status_code == 422
    assert (
        await cliente.put(url, json={**cuerpo, "squad_id": app.codigo}, headers=h)
    ).status_code == 200


async def test_capacidad_squad_ajeno_da_422_en_crear_y_actualizar(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    app, h = await _entorno(
        fabrica_aplicacion, fabrica_usuario, ["capacidades.ver", "capacidades.editar"]
    )
    persona = await Persona(aplicacion_id=app.codigo, nombre="Ana").insert()
    cuerpo = {"persona_id": str(persona.id), "mes": "2026-03", "horas_disponibles": 160}
    malo = await cliente.post("/api/capacidades", json={**cuerpo, "squad_id": "otro"}, headers=h)
    assert malo.status_code == 422

    creada = await cliente.post(
        "/api/capacidades", json={**cuerpo, "squad_id": app.codigo}, headers=h
    )
    assert creada.status_code == 201
    url = f"/api/capacidades/{creada.json()['_id']}"
    assert (await cliente.put(url, json={"squad_id": "otro"}, headers=h)).status_code == 422
    assert (await cliente.put(url, json={"horas_disponibles": 10}, headers=h)).status_code == 200
