"""Tests de RBAC (ADR-0008 F2.4).

Por cada permiso de este subconjunto representativo del catálogo
(``app/security/rbac.py::PERMISOS_CATALOGO``), una ruta que lo exige
devuelve 403 sin el permiso y 2xx con él. No cubre los 55 permisos del
catálogo contra cada ruta que los declara (ver Pendiente en el reporte de la
sesión F2): estos tres pares (``admin.configuracion.editar``,
``squads.editar``, ``personas.ver``) demuestran el patrón sobre tres estilos
distintos de router (sin ``X-Aplicacion``, con escritura multi-tenant, y con
lectura multi-tenant), y ya sirven de regresión para F1.8/F1.1/F1.2.
"""
from tests.conftest import headers_con_token


async def test_sin_admin_configuracion_editar_no_puede_crear_festivo(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=[])
    resp = await cliente.post(
        "/api/festivos",
        json={"fecha": "2030-01-01T00:00:00"},
        headers=headers_con_token(token),
    )
    assert resp.status_code == 403


async def test_con_admin_configuracion_editar_si_puede_crear_festivo(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=["admin.configuracion.editar"])
    resp = await cliente.post(
        "/api/festivos",
        json={"fecha": "2030-01-01T00:00:00"},
        headers=headers_con_token(token),
    )
    assert resp.status_code == 201


async def test_sin_squads_editar_no_puede_crear_squad(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=[])
    resp = await cliente.post(
        "/api/squads",
        json={"nombre": "Equipo sin permiso"},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 403


async def test_con_squads_editar_si_puede_crear_squad(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["squads.editar"])
    resp = await cliente.post(
        "/api/squads",
        json={"nombre": "Equipo con permiso"},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 201


async def test_sin_personas_ver_no_puede_listar_personas(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=[])
    resp = await cliente.get("/api/personas", headers=headers_con_token(token, app.codigo))
    assert resp.status_code == 403


async def test_con_personas_ver_si_puede_listar_personas(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["personas.ver"])
    resp = await cliente.get("/api/personas", headers=headers_con_token(token, app.codigo))
    assert resp.status_code == 200
