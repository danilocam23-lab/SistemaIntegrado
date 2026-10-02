# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de `/api/asignaciones`: multi-tenant, RBAC, PUT parcial y validación."""
from app.documents.asignacion import Asignacion, Proyecto
from app.documents.categoria import Categoria
from app.documents.persona import Persona
from app.documents.requerimiento import Requerimiento, Solicitud
from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabrica
from tests.conftest import CONSOLIDADO, headers_con_token

EDITOR = ["asignaciones.ver", "asignaciones.editar"]


async def _escenario(fabrica_aplicacion, fabrica_usuario, permisos=None):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=permisos or EDITOR)
    persona = await Persona(aplicacion_id=app.codigo, nombre="Ana").insert()
    cat = await Categoria(aplicacion_id=app.codigo, nombre="Dev").insert()
    req = await Requerimiento(
        aplicacion_id=app.codigo, codigo_req="REQ-A",
        solicitud=Solicitud(codigo_sc="SC-A"), estado="ABIERTO",
    ).insert()
    return app, headers_con_token(token, app.codigo), persona, cat, req


def _cuerpo(persona, cat, **extra):
    return {"persona_id": str(persona.id), "categoria_id": str(cat.id), **extra}


async def test_listar_put_delete_aislados_por_aplicacion(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    _, h, persona, cat, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    otra = await fabrica_aplicacion()
    ajena = await Asignacion(aplicacion_id=otra.codigo, persona_id="x", categoria_id="y").insert()

    resp = await cliente.get("/api/asignaciones", headers=h)
    assert resp.status_code == 200 and resp.json() == []
    put = await cliente.put(f"/api/asignaciones/{ajena.id}", json=_cuerpo(persona, cat), headers=h)
    assert put.status_code == 404
    assert (await cliente.delete(f"/api/asignaciones/{ajena.id}", headers=h)).status_code == 404
    prio = await cliente.patch(f"/api/asignaciones/{ajena.id}/prioridad", headers=h)
    assert prio.status_code == 404
    mal = await cliente.patch("/api/asignaciones/no-es-id/prioridad", headers=h)
    assert mal.status_code == 404


async def test_prioridad_no_toca_otra_aplicacion(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona, _, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    otra = await fabrica_aplicacion()
    pid = str(persona.id)
    a1 = await Asignacion(
        aplicacion_id=app.codigo, persona_id=pid, categoria_id="c", prioridad=True
    ).insert()
    a2 = await Asignacion(aplicacion_id=app.codigo, persona_id=pid, categoria_id="c").insert()
    ajena = await Asignacion(
        aplicacion_id=otra.codigo, persona_id=pid, categoria_id="c", prioridad=True
    ).insert()

    resp = await cliente.patch(f"/api/asignaciones/{a2.id}/prioridad", headers=h)
    assert resp.status_code == 200 and resp.json()["prioridad"] is True
    assert (await Asignacion.get(a1.id)).prioridad is False
    assert (await Asignacion.get(ajena.id)).prioridad is True


async def test_consolidado_rechaza_escrituras(cliente, fabrica_aplicacion, fabrica_usuario):
    _, _, persona, cat, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    app2 = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app2.codigo, "otra-app"], permisos=EDITOR)
    h = headers_con_token(token, CONSOLIDADO)
    fake = "0" * 24
    cuerpo = _cuerpo(persona, cat)
    assert (await cliente.post("/api/asignaciones", json=cuerpo, headers=h)).status_code == 409
    put = await cliente.put(f"/api/asignaciones/{fake}", json=cuerpo, headers=h)
    assert put.status_code == 409
    assert (await cliente.delete(f"/api/asignaciones/{fake}", headers=h)).status_code == 409
    prio = await cliente.patch(f"/api/asignaciones/{fake}/prioridad", headers=h)
    assert prio.status_code == 409


async def test_solo_lectura_no_escribe(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona, cat, _ = await _escenario(
        fabrica_aplicacion, fabrica_usuario, permisos=["asignaciones.ver"]
    )
    a = await Asignacion(
        aplicacion_id=app.codigo, persona_id=str(persona.id), categoria_id=str(cat.id)
    ).insert()
    cuerpo = _cuerpo(persona, cat)
    assert (await cliente.get("/api/asignaciones", headers=h)).status_code == 200
    assert (await cliente.post("/api/asignaciones", json=cuerpo, headers=h)).status_code == 403
    put = await cliente.put(f"/api/asignaciones/{a.id}", json=cuerpo, headers=h)
    assert put.status_code == 403
    assert (await cliente.delete(f"/api/asignaciones/{a.id}", headers=h)).status_code == 403
    prio = await cliente.patch(f"/api/asignaciones/{a.id}/prioridad", headers=h)
    assert prio.status_code == 403


async def test_put_conserva_prioridad_y_proyectos(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona, cat, req = await _escenario(fabrica_aplicacion, fabrica_usuario)
    a = await Asignacion(
        aplicacion_id=app.codigo,
        persona_id=str(persona.id),
        categoria_id=str(cat.id),
        prioridad=True,
        proyectos=[Proyecto(nombre="P1", requerimiento_id=str(req.id))],
    ).insert()
    resp = await cliente.put(
        f"/api/asignaciones/{a.id}", json=_cuerpo(persona, cat, total_porcentaje=40), headers=h
    )
    assert resp.status_code == 200
    guardada = await Asignacion.get(a.id)
    assert guardada.total_porcentaje == 40
    assert guardada.prioridad is True
    assert [p.nombre for p in guardada.proyectos] == ["P1"]

    resp = await cliente.put(
        f"/api/asignaciones/{a.id}", json=_cuerpo(persona, cat, proyectos=[]), headers=h
    )
    assert resp.status_code == 200
    assert (await Asignacion.get(a.id)).proyectos == []


async def test_validacion_rango_e_ids_ajenos(cliente, fabrica_aplicacion, fabrica_usuario):
    _, h, persona, cat, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    for valor in (-1, 101):
        resp = await cliente.post(
            "/api/asignaciones", json=_cuerpo(persona, cat, total_porcentaje=valor), headers=h
        )
        assert resp.status_code == 422

    otra = await fabrica_aplicacion()
    p_ajena = await Persona(aplicacion_id=otra.codigo, nombre="X").insert()
    c_ajena = await Categoria(aplicacion_id=otra.codigo, nombre="X").insert()
    r_ajeno = await Requerimiento(
        aplicacion_id=otra.codigo, codigo_req="R-X",
        solicitud=Solicitud(codigo_sc="S-X"), estado="ABIERTO",
    ).insert()
    r = await cliente.post("/api/asignaciones", json=_cuerpo(p_ajena, cat), headers=h)
    assert r.status_code == 404
    r = await cliente.post("/api/asignaciones", json=_cuerpo(persona, c_ajena), headers=h)
    assert r.status_code == 404
    cuerpo = _cuerpo(persona, cat, proyectos=[{"nombre": "P", "requerimiento_id": str(r_ajeno.id)}])
    assert (await cliente.post("/api/asignaciones", json=cuerpo, headers=h)).status_code == 404
    mal = {**_cuerpo(persona, cat), "persona_id": "mal"}
    assert (await cliente.post("/api/asignaciones", json=mal, headers=h)).status_code == 422


async def test_duplicado_persona_requerimiento(cliente, fabrica_aplicacion, fabrica_usuario):
    app, h, persona, cat, req = await _escenario(fabrica_aplicacion, fabrica_usuario)
    proy = [{"nombre": "P", "requerimiento_id": str(req.id)}]
    r1 = await cliente.post(
        "/api/asignaciones", json=_cuerpo(persona, cat, proyectos=proy), headers=h
    )
    assert r1.status_code == 201
    r2 = await cliente.post(
        "/api/asignaciones", json=_cuerpo(persona, cat, proyectos=proy), headers=h
    )
    assert r2.status_code == 409

    # Mover en PUT un requerimiento a otra asignación de la misma persona también choca.
    otra = await Asignacion(
        aplicacion_id=app.codigo, persona_id=str(persona.id), categoria_id=str(cat.id)
    ).insert()
    resp = await cliente.put(
        f"/api/asignaciones/{otra.id}", json=_cuerpo(persona, cat, proyectos=proy), headers=h
    )
    assert resp.status_code == 409


async def test_wo_por_persona_permiso_y_nulos(cliente, fabrica_aplicacion, fabrica_usuario):
    app = await fabrica_aplicacion()
    _, sin = await fabrica_usuario([app.codigo], permisos=[])
    _, con = await fabrica_usuario([app.codigo], permisos=["asignaciones.ver"])
    datos = [
        {"Work Order ID": "W1", "Assigned To": "Ana", "Status WO": "Abierta"},
        {"Work Order ID": "W2", "Assigned To": None, "Status WO": "Abierta"},
        {"Work Order ID": "W3", "Assigned To": "Ana", "Status WO": "Cerrado"},
        {"Work Order ID": "W4", "Assigned To": "Ana", "Status WO": None},
    ]
    docs = [
        {"aplicacion_id": app.codigo, "fila_origen": i + 1, "lider": "L", "squad": "S", "datos": d}
        for i, d in enumerate(datos)
    ]
    await SoporteSolicitudFabrica.get_pymongo_collection().insert_many(docs)
    url = "/api/soporte/solicitudes-fabrica/wo-por-persona"
    assert (await cliente.get(url, headers=headers_con_token(sin, app.codigo))).status_code == 403
    resp = await cliente.get(url, headers=headers_con_token(con, app.codigo))
    assert resp.status_code == 200
    assert sorted(w["wo_id"] for w in resp.json()) == ["W1", "W4"]
