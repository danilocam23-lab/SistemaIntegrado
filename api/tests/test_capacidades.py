# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de `/api/capacidades`: multi-tenant, RBAC, PUT parcial, validación y bulk."""
from app.documents.capacidad import Capacidad
from app.documents.persona import Persona
from tests.conftest import CONSOLIDADO, headers_con_token

EDITOR = ["capacidades.ver", "capacidades.editar"]
URL = "/api/capacidades"


async def _escenario(fabrica_aplicacion, fabrica_usuario, permisos=None):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=permisos or EDITOR)
    persona = await Persona(aplicacion_id=app.codigo, nombre="Ana").insert()
    return app, headers_con_token(token, app.codigo), persona


def _cuerpo(persona, **extra):
    return {"persona_id": str(persona.id), "mes": "2026-03", "horas_disponibles": 160, **extra}


async def test_aislamiento_por_aplicacion(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    otra = await fabrica_aplicacion()
    ajena = await Capacidad(aplicacion_id=otra.codigo, persona_id="x", mes="2026-03").insert()
    propia = await Capacidad(
        aplicacion_id=app.codigo, persona_id=str(persona.id), mes="2026-03"
    ).insert()
    resp = await cliente.get(URL, headers=h)
    assert [c["_id"] for c in resp.json()] == [str(propia.id)]
    put = await cliente.put(f"{URL}/{ajena.id}", json={"horas_disponibles": 1}, headers=h)
    assert put.status_code == 404
    assert (await cliente.delete(f"{URL}/{ajena.id}", headers=h)).status_code == 404
    assert (await cliente.delete(f"{URL}/mal-id", headers=h)).status_code == 404
    assert (await cliente.put(f"{URL}/mal-id", json={}, headers=h)).status_code == 404


async def test_consolidado_rechaza_escrituras(cliente, fabrica_aplicacion, fabrica_usuario):
    app, _, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    _, token = await fabrica_usuario([app.codigo, "otra-app"], permisos=EDITOR)
    h = headers_con_token(token, CONSOLIDADO)
    fake = "0" * 24
    assert (await cliente.post(URL, json=_cuerpo(persona), headers=h)).status_code == 409
    assert (await cliente.put(f"{URL}/{fake}", json={}, headers=h)).status_code == 409
    bulk = {"filas": [_cuerpo(persona)]}
    assert (await cliente.put(f"{URL}/bulk", json=bulk, headers=h)).status_code == 409
    assert (await cliente.delete(f"{URL}/{fake}", headers=h)).status_code == 409


async def test_solo_lectura_no_escribe(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona = await _escenario(
        fabrica_aplicacion, fabrica_usuario, permisos=["capacidades.ver"]
    )
    c = await Capacidad(
        aplicacion_id=app.codigo, persona_id=str(persona.id), mes="2026-03"
    ).insert()
    bulk = {"filas": [_cuerpo(persona)]}
    assert (await cliente.get(URL, headers=h)).status_code == 200
    assert (await cliente.post(URL, json=_cuerpo(persona), headers=h)).status_code == 403
    assert (await cliente.put(f"{URL}/{c.id}", json={}, headers=h)).status_code == 403
    assert (await cliente.put(f"{URL}/bulk", json=bulk, headers=h)).status_code == 403
    assert (await cliente.delete(f"{URL}/{c.id}", headers=h)).status_code == 403


async def test_put_parcial_conserva_notas_y_personas(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    c = await Capacidad(
        aplicacion_id=app.codigo, persona_id=str(persona.id), mes="2026-03",
        notas="vacaciones", personas=3, squad_id="sq",
    ).insert()
    resp = await cliente.put(f"{URL}/{c.id}", json={"horas_disponibles": 100}, headers=h)
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["horas_disponibles"] == 100
    assert cuerpo["notas"] == "vacaciones" and cuerpo["personas"] == 3
    assert cuerpo["squad_id"] == "sq" and cuerpo["mes"] == "2026-03"


async def test_validacion(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    otra = await fabrica_aplicacion()
    ajena = await Persona(aplicacion_id=otra.codigo, nombre="Ajena").insert()

    async def post(**extra):
        return (await cliente.post(URL, json=_cuerpo(persona, **extra), headers=h)).status_code

    for mes in ("2026-13", "2026-3", "26-03", "2026-00"):
        assert await post(mes=mes) == 422
    for horas in (-1, 745):
        assert await post(horas_disponibles=horas) == 422
    assert await post(scope="otro") == 422
    assert await post(persona_id=None) == 422
    assert await post(persona_id="zzz") == 422
    assert await post(persona_id=str(ajena.id)) == 404
    assert await post(horas_disponibles=744) == 201
    assert await Capacidad.find({"aplicacion_id": otra.codigo}).count() == 0


async def test_duplicado_persona_mes_409(cliente, fabrica_aplicacion, fabrica_usuario):
    _, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    assert (await cliente.post(URL, json=_cuerpo(persona), headers=h)).status_code == 201
    assert (await cliente.post(URL, json=_cuerpo(persona), headers=h)).status_code == 409
    abril = await cliente.post(URL, json=_cuerpo(persona, mes="2026-04"), headers=h)
    assert abril.status_code == 201
    # Mover el de abril a marzo colisiona; editar horas no.
    url = f"{URL}/{abril.json()['_id']}"
    assert (await cliente.put(url, json={"mes": "2026-03"}, headers=h)).status_code == 409
    assert (await cliente.put(url, json={"horas_disponibles": 90}, headers=h)).status_code == 200


async def test_listar_por_mes_y_anio(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    for mes in ("2025-12", "2026-01", "2026-06"):
        await Capacidad(aplicacion_id=app.codigo, persona_id=str(persona.id), mes=mes).insert()
    por_mes = await cliente.get(URL, params={"mes": "2026-01"}, headers=h)
    assert [c["mes"] for c in por_mes.json()] == ["2026-01"]
    por_anio = await cliente.get(URL, params={"anio": 2026}, headers=h)
    assert [c["mes"] for c in por_anio.json()] == ["2026-01", "2026-06"]
    rango = await cliente.get(URL, params={"desde": "2026-02", "hasta": "2026-12"}, headers=h)
    assert [c["mes"] for c in rango.json()] == ["2026-06"]
    assert (await cliente.get(URL, params={"mes": "xx"}, headers=h)).status_code == 422


async def test_bulk_upsert(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    pid = str(persona.id)
    existente = await Capacidad(
        aplicacion_id=app.codigo, persona_id=pid, mes="2026-01", notas="n", horas_disponibles=10
    ).insert()
    filas = [
        {"persona_id": pid, "mes": "2026-01", "horas_disponibles": 150},
        {"persona_id": pid, "mes": "2026-02", "horas_disponibles": 160},
    ]
    resp = await cliente.put(f"{URL}/bulk", json={"filas": filas}, headers=h)
    assert resp.status_code == 200
    assert resp.json() == {"total": 2, "creadas": 1, "actualizadas": 1}
    ref = await Capacidad.get(existente.id)
    assert ref is not None and ref.horas_disponibles == 150 and ref.notas == "n"
    assert await Capacidad.find({"aplicacion_id": app.codigo}).count() == 2
    again = await cliente.put(f"{URL}/bulk", json={"filas": filas}, headers=h)
    assert again.json()["creadas"] == 0


async def test_bulk_validaciones(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    otra = await fabrica_aplicacion()
    ajena = await Persona(aplicacion_id=otra.codigo, nombre="Ajena").insert()
    buena = {"persona_id": str(persona.id), "mes": "2026-01", "horas_disponibles": 1}

    async def put(filas):
        return (await cliente.put(f"{URL}/bulk", json={"filas": filas}, headers=h)).status_code

    assert await put([]) == 422
    assert await put([buena, buena]) == 422
    assert await put([{**buena, "horas_disponibles": 800}]) == 422
    assert await put([buena, {**buena, "persona_id": str(ajena.id), "mes": "2026-02"}]) == 404
    assert await Capacidad.find({"aplicacion_id": app.codigo}).count() == 0
    assert await put([buena]) == 200
    muchas = [{**buena, "mes": f"{2000 + i // 12}-{i % 12 + 1:02d}"} for i in range(501)]
    assert await put(muchas) == 422
    assert await Capacidad.find({"aplicacion_id": app.codigo}).count() == 1
