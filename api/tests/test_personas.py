# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de `/api/personas`: valores bajo permiso, PUT parcial, multi-tenant,
duplicados/deduplicación aislados, correo único e impacto de eliminación."""
from app.documents.asignacion import Asignacion
from app.documents.capacidad import Capacidad
from app.documents.persona import Persona
from tests.conftest import CONSOLIDADO, headers_con_token

BASE = ["personas.ver", "personas.crear", "personas.editar", "personas.eliminar"]
CON_VALORES = [*BASE, "personas.ver_valores"]


async def _escenario(fabrica_aplicacion, fabrica_usuario, permisos):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=permisos)
    return app, headers_con_token(token, app.codigo)


async def test_sin_ver_valores_no_recibe_valores(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h = await _escenario(fabrica_aplicacion, fabrica_usuario, ["personas.ver"])
    p = await Persona(
        aplicacion_id=app.codigo, nombre="Ana", valor_persona=100, valor_perifericos=5
    ).insert()
    lista = (await cliente.get("/api/personas", headers=h)).json()
    assert len(lista) == 1 and lista[0]["nombre"] == "Ana"
    assert "valor_persona" not in lista[0] and "valor_perifericos" not in lista[0]
    uno = (await cliente.get(f"/api/personas/{p.id}", headers=h)).json()
    assert "valor_persona" not in uno and "valor_perifericos" not in uno

    _, token = await fabrica_usuario([app.codigo], permisos=CON_VALORES)
    h2 = headers_con_token(token, app.codigo)
    lista = (await cliente.get("/api/personas", headers=h2)).json()
    assert lista[0]["valor_persona"] == 100 and lista[0]["valor_perifericos"] == 5


async def test_escribir_valores_exige_permiso(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h = await _escenario(fabrica_aplicacion, fabrica_usuario, BASE)
    cuerpo = {"nombre": "Beto", "valor_persona": 999, "valor_perifericos": 9}
    resp = await cliente.post("/api/personas", json=cuerpo, headers=h)
    assert resp.status_code == 201
    assert "valor_persona" not in resp.json()
    creada = await Persona.get(resp.json()["_id"])
    assert creada.valor_persona == 0 and creada.valor_perifericos == 0

    existente = await Persona(
        aplicacion_id=app.codigo, nombre="Cris", valor_persona=50, valor_perifericos=2
    ).insert()
    put = await cliente.put(
        f"/api/personas/{existente.id}", json={"nombre": "Cris", "valor_persona": 1}, headers=h
    )
    assert put.status_code == 200
    recargada = await Persona.get(existente.id)
    assert recargada.valor_persona == 50 and recargada.valor_perifericos == 2

    _, token = await fabrica_usuario([app.codigo], permisos=CON_VALORES)
    h2 = headers_con_token(token, app.codigo)
    put = await cliente.put(
        f"/api/personas/{existente.id}", json={"nombre": "Cris", "valor_persona": 77}, headers=h2
    )
    assert put.status_code == 200 and put.json()["valor_persona"] == 77
    recargada = await Persona.get(existente.id)
    assert recargada.valor_persona == 77 and recargada.valor_perifericos == 2


async def test_put_parcial_conserva_campos(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h = await _escenario(fabrica_aplicacion, fabrica_usuario, CON_VALORES)
    p = await Persona(
        aplicacion_id=app.codigo, nombre="Dora", email="dora@x.com", squads=["Alfa", "Beta"],
        es_lider_tecnico=True, permite_sobrecarga=True, usuario_id="u1",
        valor_persona=10, valor_perifericos=3,
    ).insert()
    resp = await cliente.put(f"/api/personas/{p.id}", json={"nombre": "Dora M"}, headers=h)
    assert resp.status_code == 200
    r = await Persona.get(p.id)
    assert r.nombre == "Dora M" and r.email == "dora@x.com"
    assert r.squads == ["Alfa", "Beta"] and r.usuario_id == "u1"
    assert r.es_lider_tecnico is True and r.permite_sobrecarga is True
    assert r.valor_persona == 10 and r.valor_perifericos == 3
    assert r.aplicacion_id == app.codigo and "aplicacion_movida" not in resp.json()


async def test_put_no_mueve_a_app_sin_acceso(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h = await _escenario(fabrica_aplicacion, fabrica_usuario, BASE)
    ajena = await fabrica_aplicacion()
    p = await Persona(aplicacion_id=app.codigo, nombre="Eli", squads=["X"]).insert()
    resp = await cliente.put(
        f"/api/personas/{p.id}", json={"nombre": "Eli", "squads": [ajena.nombre]}, headers=h
    )
    assert resp.status_code == 403
    assert (await Persona.get(p.id)).aplicacion_id == app.codigo


async def test_put_mueve_y_avisa_si_hay_acceso(cliente, fabrica_aplicacion, fabrica_usuario):
    app = await fabrica_aplicacion()
    otra = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo, otra.codigo], permisos=BASE)
    h = headers_con_token(token, app.codigo)
    p = await Persona(aplicacion_id=app.codigo, nombre="Fer", squads=["X"]).insert()
    resp = await cliente.put(
        f"/api/personas/{p.id}", json={"nombre": "Fer", "squads": [otra.nombre]}, headers=h
    )
    assert resp.status_code == 200
    assert resp.json()["aplicacion_movida"] == {"desde": app.codigo, "hacia": otra.codigo}
    assert (await Persona.get(p.id)).aplicacion_id == otra.codigo


async def test_put_delete_no_tocan_persona_ajena(cliente, fabrica_aplicacion, fabrica_usuario):
    _, h = await _escenario(fabrica_aplicacion, fabrica_usuario, BASE)
    otra = await fabrica_aplicacion()
    ajena = await Persona(aplicacion_id=otra.codigo, nombre="Gus").insert()
    put = await cliente.put(f"/api/personas/{ajena.id}", json={"nombre": "Z"}, headers=h)
    assert put.status_code == 404
    assert (await cliente.delete(f"/api/personas/{ajena.id}", headers=h)).status_code == 404
    assert (await cliente.get(f"/api/personas/{ajena.id}/impacto", headers=h)).status_code == 404


async def test_get_id_mal_formado_es_404(cliente, fabrica_aplicacion, fabrica_usuario):
    _, h = await _escenario(fabrica_aplicacion, fabrica_usuario, BASE)
    assert (await cliente.get("/api/personas/no-es-id", headers=h)).status_code == 404


async def test_deduplicar_e_impacto_persona_ajena_404(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    app, h = await _escenario(fabrica_aplicacion, fabrica_usuario, [*BASE, "admin.acceso"])
    otra = await fabrica_aplicacion()
    propia = await Persona(aplicacion_id=app.codigo, nombre="Pía").insert()
    ajena = await Persona(aplicacion_id=otra.codigo, nombre="Pía").insert()
    r = await cliente.post(
        "/api/personas/deduplicar",
        json={"fusiones": [{"ganador_id": str(propia.id), "perdedor_ids": [str(ajena.id)]}]},
        headers=h,
    )
    assert r.status_code == 404
    assert await Persona.get(ajena.id) is not None
    assert (await cliente.get(f"/api/personas/{ajena.id}/impacto", headers=h)).status_code == 404


async def test_correo_unico_por_aplicacion(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h = await _escenario(fabrica_aplicacion, fabrica_usuario, BASE)
    otra = await fabrica_aplicacion()
    await Persona(aplicacion_id=otra.codigo, nombre="Otro", email="h@x.com").insert()
    p1 = (await cliente.post(
        "/api/personas", json={"nombre": "Hana", "email": "h@x.com"}, headers=h
    )).json()
    dup = await cliente.post(
        "/api/personas", json={"nombre": "Hana2", "email": "H@X.com"}, headers=h
    )
    assert dup.status_code == 409
    p2 = await Persona(aplicacion_id=app.codigo, nombre="Ivo", email="i@x.com").insert()
    put = await cliente.put(
        f"/api/personas/{p2.id}", json={"nombre": "Ivo", "email": "h@x.com"}, headers=h
    )
    assert put.status_code == 409
    # Reenviar su propio correo no choca consigo misma
    mismo = await cliente.put(
        f"/api/personas/{p1['_id']}", json={"nombre": "Hana", "email": "h@x.com"}, headers=h
    )
    assert mismo.status_code == 200


async def test_consolidado_alta_exige_app_y_valida_acceso(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    app1 = await fabrica_aplicacion()
    app2 = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app1.codigo, app2.codigo], permisos=BASE)
    h = headers_con_token(token, CONSOLIDADO)
    assert (await cliente.post("/api/personas", json={"nombre": "J"}, headers=h)).status_code == 400
    ok = await cliente.post(
        "/api/personas", json={"nombre": "J", "aplicacion_id": app2.codigo}, headers=h
    )
    assert ok.status_code == 201
    ajena = await fabrica_aplicacion()
    mal = await cliente.post(
        "/api/personas", json={"nombre": "K", "aplicacion_id": ajena.codigo}, headers=h
    )
    assert mal.status_code == 403


async def test_duplicados_y_deduplicar_aislados(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h = await _escenario(
        fabrica_aplicacion, fabrica_usuario, [*BASE, "admin.acceso"]
    )
    otra = await fabrica_aplicacion()
    a = await Persona(aplicacion_id=app.codigo, nombre="Luz Díaz", email="l@x.com").insert()
    b = await Persona(aplicacion_id=app.codigo, nombre="luz diaz").insert()
    # Duplicado en otra aplicación (inaccesible) con el mismo nombre
    ajena1 = await Persona(aplicacion_id=otra.codigo, nombre="Mia").insert()
    ajena2 = await Persona(aplicacion_id=otra.codigo, nombre="mia").insert()

    grupos = (await cliente.get("/api/personas/duplicados", headers=h)).json()
    assert [g["nombre"] for g in grupos] == ["Luz Díaz"]
    assert grupos[0]["total"] == 2

    pag = await cliente.get("/api/personas/duplicados?limite=1&omitir=1", headers=h)
    assert pag.status_code == 200 and pag.json() == []

    mal = await cliente.post(
        "/api/personas/deduplicar",
        json={"fusiones": [{"ganador_id": str(a.id), "perdedor_ids": [str(ajena1.id)]}]},
        headers=h,
    )
    assert mal.status_code == 404
    mal = await cliente.post(
        "/api/personas/deduplicar",
        json={"fusiones": [{"ganador_id": str(ajena1.id), "perdedor_ids": [str(ajena2.id)]}]},
        headers=h,
    )
    assert mal.status_code == 404
    assert await Persona.get(ajena1.id) and await Persona.get(ajena2.id)

    ok = await cliente.post(
        "/api/personas/deduplicar",
        json={"fusiones": [{"ganador_id": str(a.id), "perdedor_ids": [str(b.id)]}]},
        headers=h,
    )
    assert ok.status_code == 200 and ok.json()["fusionados"] == 1
    assert await Persona.get(b.id) is None


async def test_deduplicar_rechaza_consolidado(cliente, fabrica_aplicacion, fabrica_usuario):
    app1 = await fabrica_aplicacion()
    app2 = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app1.codigo, app2.codigo], permisos=["admin.acceso"])
    h = headers_con_token(token, CONSOLIDADO)
    resp = await cliente.post("/api/personas/deduplicar", json={"fusiones": []}, headers=h)
    assert resp.status_code == 409


async def test_impacto_eliminacion_y_delete(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h = await _escenario(fabrica_aplicacion, fabrica_usuario, BASE)
    p = await Persona(aplicacion_id=app.codigo, nombre="Nico").insert()
    pid = str(p.id)
    await Asignacion(aplicacion_id=app.codigo, persona_id=pid, categoria_id="c").insert()
    await Asignacion(aplicacion_id=app.codigo, persona_id=pid, categoria_id="d").insert()
    await Capacidad(
        aplicacion_id=app.codigo, scope="persona", persona_id=pid, mes="2026-01"
    ).insert()

    resp = await cliente.get(f"/api/personas/{pid}/impacto", headers=h)
    assert resp.status_code == 200
    datos = resp.json()
    assert datos["cascada"] == {"asignaciones": 2, "capacidades": 1, "work_items": 0}
    assert datos["referencias"] == {"requerimientos": 0, "squads": 0}
    assert datos["eliminable"] is True

    # Sin permiso de eliminar no hay impacto
    _, token = await fabrica_usuario([app.codigo], permisos=["personas.ver"])
    h2 = headers_con_token(token, app.codigo)
    assert (await cliente.get(f"/api/personas/{pid}/impacto", headers=h2)).status_code == 403

    assert (await cliente.delete(f"/api/personas/{pid}", headers=h)).status_code == 204
    assert await Persona.get(p.id) is None
    assert await Asignacion.find(Asignacion.persona_id == pid).count() == 0
