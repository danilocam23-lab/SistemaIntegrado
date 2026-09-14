"""Tests del invariante multi-tenant (ADR-0008 F2.3).

Cubre, para un conjunto representativo de rutas operativas —``/api/squads``
(lectura + escritura con permiso, ``ctx.filtro()``/``ctx.codigo``) y
``GET /api/requerimientos`` (lectura simple)—: 401 sin token, 400 sin
``X-Aplicacion``, 403 con una aplicación no autorizada, 409 al escribir en
modo consolidado, y que un recurso de la aplicación A no es visible ni
editable desde B. Es la plantilla que hubiera detectado S4-S8 del ADR.

No es un barrido de las 145 rutas del backend: cubrir cada ruta operativa
exigiría replicar esta misma plantilla router por router, y queda como
trabajo pendiente explícito (ver el reporte de la sesión F2). Esto demuestra
el patrón y ya protege dos de los routers con más superficie multi-tenant.
"""
from app.documents.squad import Squad
from tests.conftest import CONSOLIDADO, headers_con_token

# ── /api/squads ──────────────────────────────────────────────────────────


async def test_401_sin_token(cliente):
    resp = await cliente.get("/api/squads", headers={"X-Aplicacion": "no-importa"})
    assert resp.status_code == 401


async def test_400_sin_x_aplicacion(cliente, fabrica_usuario):
    _, token = await fabrica_usuario(["app-cualquiera"])
    resp = await cliente.get("/api/squads", headers=headers_con_token(token))
    assert resp.status_code == 400


async def test_403_con_aplicacion_no_autorizada(cliente, fabrica_usuario, fabrica_aplicacion):
    autorizada = await fabrica_aplicacion()
    otra = await fabrica_aplicacion()
    _, token = await fabrica_usuario([autorizada.codigo])
    resp = await cliente.get("/api/squads", headers=headers_con_token(token, otra.codigo))
    assert resp.status_code == 403


async def test_409_al_escribir_en_modo_consolidado(cliente, fabrica_usuario, fabrica_aplicacion):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app_a.codigo, app_b.codigo], permisos=["squads.editar"])
    resp = await cliente.post(
        "/api/squads",
        json={"nombre": "Equipo consolidado"},
        headers=headers_con_token(token, CONSOLIDADO),
    )
    assert resp.status_code == 409


async def test_recurso_de_a_no_es_visible_desde_b(cliente, fabrica_usuario, fabrica_aplicacion):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    await Squad(aplicacion_id=app_a.codigo, nombre="Solo en A").insert()

    _, token_a = await fabrica_usuario([app_a.codigo])
    _, token_b = await fabrica_usuario([app_b.codigo])

    resp_a = await cliente.get("/api/squads", headers=headers_con_token(token_a, app_a.codigo))
    resp_b = await cliente.get("/api/squads", headers=headers_con_token(token_b, app_b.codigo))

    assert resp_a.status_code == resp_b.status_code == 200
    assert any(s["nombre"] == "Solo en A" for s in resp_a.json())
    assert all(s["nombre"] != "Solo en A" for s in resp_b.json())


async def test_recurso_de_a_no_es_editable_desde_b(cliente, fabrica_usuario, fabrica_aplicacion):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    squad_a = await Squad(aplicacion_id=app_a.codigo, nombre="Editable solo en A").insert()

    _, token_b = await fabrica_usuario([app_b.codigo], permisos=["squads.editar"])
    resp = await cliente.put(
        f"/api/squads/{squad_a.id}",
        json={"nombre": "hackeado desde B"},
        headers=headers_con_token(token_b, app_b.codigo),
    )
    # 404, no 403: para el usuario de B el squad de A simplemente no existe.
    assert resp.status_code == 404

    intacto = await Squad.get(squad_a.id)
    assert intacto.nombre == "Editable solo en A"


# ── GET /api/requerimientos (lectura simple, sin permiso declarado) ────────


async def test_requerimientos_401_sin_token(cliente):
    resp = await cliente.get("/api/requerimientos", headers={"X-Aplicacion": "no-importa"})
    assert resp.status_code == 401


async def test_requerimientos_403_con_aplicacion_no_autorizada(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    autorizada = await fabrica_aplicacion()
    otra = await fabrica_aplicacion()
    _, token = await fabrica_usuario([autorizada.codigo])
    resp = await cliente.get(
        "/api/requerimientos", headers=headers_con_token(token, otra.codigo)
    )
    assert resp.status_code == 403
