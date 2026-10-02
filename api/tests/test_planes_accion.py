# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de `/api/planes-accion`: multi-tenant, RBAC, PUT parcial y validación."""
from app.documents.persona import Persona
from app.documents.plan_accion import PlanAccion
from tests.conftest import CONSOLIDADO, headers_con_token

EDITOR = ["planes_accion.ver", "planes_accion.editar"]
URL = "/api/planes-accion"
X = {"titulo": "x"}


async def _escenario(fabrica_aplicacion, fabrica_usuario, permisos=None):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=permisos or EDITOR)
    persona = await Persona(aplicacion_id=app.codigo, nombre="Ana").insert()
    return app, headers_con_token(token, app.codigo), persona


async def test_aislamiento_por_aplicacion(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    otra = await fabrica_aplicacion()
    propia = await PlanAccion(aplicacion_id=app.codigo, titulo="mio").insert()
    ajena = await PlanAccion(aplicacion_id=otra.codigo, titulo="ajeno").insert()

    lista = (await cliente.get(URL, headers=h)).json()
    assert [p["titulo"] for p in lista] == ["mio"]
    assert (await cliente.put(f"{URL}/{ajena.id}", json=X, headers=h)).status_code == 404
    assert (await cliente.delete(f"{URL}/{ajena.id}", headers=h)).status_code == 404
    assert (await PlanAccion.get(ajena.id)).titulo == "ajeno"
    assert (await cliente.delete(f"{URL}/{propia.id}", headers=h)).status_code == 204


async def test_id_mal_formado_es_404(cliente, fabrica_aplicacion, fabrica_usuario):
    _, h, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    assert (await cliente.put(f"{URL}/no-es-id", json=X, headers=h)).status_code == 404
    assert (await cliente.delete(f"{URL}/no-es-id", headers=h)).status_code == 404


async def test_responsable_ajeno_o_mal_formado(cliente, fabrica_aplicacion, fabrica_usuario):
    _, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    otra = await fabrica_aplicacion()
    ajena = await Persona(aplicacion_id=otra.codigo, nombre="X").insert()

    ok = await cliente.post(URL, json={"titulo": "t", "responsable_id": str(persona.id)}, headers=h)
    assert ok.status_code == 201
    r = await cliente.post(URL, json={"titulo": "t", "responsable_id": str(ajena.id)}, headers=h)
    assert r.status_code == 404
    r = await cliente.post(URL, json={"titulo": "t", "responsable_id": "mal"}, headers=h)
    assert r.status_code == 422
    pid = ok.json()["_id"] if "_id" in ok.json() else ok.json()["id"]
    r = await cliente.put(f"{URL}/{pid}", json={"responsable_id": str(ajena.id)}, headers=h)
    assert r.status_code == 404


async def test_consolidado_rechaza_escrituras(cliente, fabrica_aplicacion, fabrica_usuario):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo, "otra-app"], permisos=EDITOR)
    h = headers_con_token(token, CONSOLIDADO)
    fake = "0" * 24
    assert (await cliente.post(URL, json={"titulo": "t"}, headers=h)).status_code == 409
    assert (await cliente.put(f"{URL}/{fake}", json={"titulo": "t"}, headers=h)).status_code == 409
    assert (await cliente.delete(f"{URL}/{fake}", headers=h)).status_code == 409


async def test_solo_lectura_no_escribe(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, _ = await _escenario(
        fabrica_aplicacion, fabrica_usuario, permisos=["planes_accion.ver"]
    )
    plan = await PlanAccion(aplicacion_id=app.codigo, titulo="t").insert()
    assert (await cliente.get(URL, headers=h)).status_code == 200
    assert (await cliente.post(URL, json={"titulo": "t"}, headers=h)).status_code == 403
    assert (await cliente.put(f"{URL}/{plan.id}", json=X, headers=h)).status_code == 403
    assert (await cliente.delete(f"{URL}/{plan.id}", headers=h)).status_code == 403


async def test_sin_permiso_ver_no_lista(cliente, fabrica_aplicacion, fabrica_usuario):
    _, h, _ = await _escenario(fabrica_aplicacion, fabrica_usuario, permisos=["otro.ver"])
    assert (await cliente.get(URL, headers=h)).status_code == 403


async def test_put_parcial_conserva_estado_y_campos(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    plan = await PlanAccion(
        aplicacion_id=app.codigo, titulo="t", descripcion="d",
        responsable_id=str(persona.id), fecha_limite="2026-12-31", estado="EN_PROGRESO",
    ).insert()
    resp = await cliente.put(f"{URL}/{plan.id}", json={"titulo": "nuevo"}, headers=h)
    assert resp.status_code == 200
    g = await PlanAccion.get(plan.id)
    assert (g.titulo, g.descripcion, g.estado) == ("nuevo", "d", "EN_PROGRESO")
    assert g.responsable_id == str(persona.id) and g.fecha_limite == "2026-12-31"

    # Cuerpo completo (contrato actual) y null explícito para limpiar.
    resp = await cliente.put(
        f"{URL}/{plan.id}",
        json={"titulo": "n2", "descripcion": None, "responsable_id": None,
              "fecha_limite": None, "estado": "COMPLETADO"},
        headers=h,
    )
    assert resp.status_code == 200
    g = await PlanAccion.get(plan.id)
    assert g.estado == "COMPLETADO" and g.descripcion is None and g.responsable_id is None


async def test_put_titulo_null_es_422(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    plan = await PlanAccion(aplicacion_id=app.codigo, titulo="t").insert()
    r = await cliente.put(f"{URL}/{plan.id}", json={"titulo": None}, headers=h)
    assert r.status_code == 422
    assert (await PlanAccion.get(plan.id)).titulo == "t"


async def test_put_solo_estado_conserva_campos(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona = await _escenario(fabrica_aplicacion, fabrica_usuario)
    plan = await PlanAccion(
        aplicacion_id=app.codigo, titulo="t", descripcion="d",
        responsable_id=str(persona.id), fecha_limite="2026-12-31",
    ).insert()
    r = await cliente.put(f"{URL}/{plan.id}", json={"estado": "COMPLETADO"}, headers=h)
    assert r.status_code == 200
    g = await PlanAccion.get(plan.id)
    assert (g.titulo, g.descripcion, g.estado) == ("t", "d", "COMPLETADO")
    assert g.responsable_id == str(persona.id) and g.fecha_limite == "2026-12-31"


async def test_validaciones_de_dominio(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    plan = await PlanAccion(aplicacion_id=app.codigo, titulo="t").insert()
    malos = [
        {"titulo": "   "},
        {"titulo": "x" * 201},
        {"titulo": "t", "estado": "hola"},
        {"titulo": "t", "fecha_limite": "31/12/2026"},
        {"titulo": "t", "fecha_limite": "2026-02-30"},
        {"titulo": "t", "descripcion": "d" * 2001},
    ]
    for cuerpo in malos:
        assert (await cliente.post(URL, json=cuerpo, headers=h)).status_code == 422, cuerpo
    for cuerpo in ({"titulo": None}, {"estado": None}, {"estado": "hola"}, {"fecha_limite": "x"}):
        r = await cliente.put(f"{URL}/{plan.id}", json=cuerpo, headers=h)
        assert r.status_code == 422, cuerpo
    assert (await cliente.get(f"{URL}?estado=hola", headers=h)).status_code == 422
    assert (await cliente.get(f"{URL}?estado=PENDIENTE", headers=h)).status_code == 200
