"""Tests de ``GET /api/admin/endpoints/catalogo`` (ADR-0008 F4.1/F4.2/F4.3).

Cubre lo que pide el plan de la ronda F4:

* que el catálogo se sirva y respete ``admin.endpoints.ver`` (403 sin el
  permiso, 200 con él);
* que la clasificación de riesgo (F4.3) sea correcta para una muestra
  conocida: ``seguro`` (GET idempotente), ``mutante`` (POST/PUT/PATCH que no
  está en la lista explícita) y ``destructivo`` (todo DELETE, más el caso que
  demuestra que la lista explícita gana incluso sobre un GET:
  ``GET /api/azdo/campos-requeridos``, C6 del ADR);
* que el permiso (F4.2, ``x-permiso``) y si exige ``X-Aplicacion``
  (``x-requiere-aplicacion``) salen del propio contrato OpenAPI, no de una
  lista aparte;
* que la fusión con el catálogo editable (``EndpointAdmin``) funciona,
  casando por método + ruta.
"""
from app.documents.endpoint_admin import EndpointAdmin
from tests.conftest import headers_con_token

RUTA = "/api/admin/endpoints/catalogo"


def _por_metodo_ruta(items: list[dict]) -> dict[tuple[str, str], dict]:
    return {(item["metodo"], item["ruta"]): item for item in items}


async def test_sin_admin_endpoints_ver_no_puede_ver_catalogo(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=[])
    resp = await cliente.get(RUTA, headers=headers_con_token(token))
    assert resp.status_code == 403


async def test_con_admin_endpoints_ver_devuelve_catalogo(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=["admin.endpoints.ver"])
    resp = await cliente.get(RUTA, headers=headers_con_token(token))
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    assert len(items) > 100  # el ADR documenta 145 rutas reales
    # No se limita a leer un texto aparte: todas las claves de F4.1 están presentes.
    claves_esperadas = {
        "metodo",
        "ruta",
        "operation_id",
        "modulo",
        "resumen",
        "parametros",
        "esquema_de_cuerpo",
        "permiso",
        "requiere_aplicacion",
        "riesgo",
        "enriquecimiento",
    }
    assert claves_esperadas.issubset(items[0].keys())


async def test_catalogo_no_incluye_rutas_fuera_de_api(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=["admin.endpoints.ver"])
    resp = await cliente.get(RUTA, headers=headers_con_token(token))
    items = resp.json()
    assert all(item["ruta"].startswith("/api") for item in items)


async def test_clasificacion_de_riesgo_en_muestra_conocida(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=["admin.endpoints.ver"])
    resp = await cliente.get(RUTA, headers=headers_con_token(token))
    por_ruta = _por_metodo_ruta(resp.json())

    # seguro: GET idempotente sin efectos secundarios.
    assert por_ruta[("GET", "/api/requerimientos")]["riesgo"] == "seguro"
    assert por_ruta[("GET", "/api/health")]["riesgo"] == "seguro"

    # mutante: POST/PUT/PATCH que no está en la lista explícita del ADR.
    assert por_ruta[("POST", "/api/festivos")]["riesgo"] == "mutante"
    assert por_ruta[("PUT", "/api/requerimientos/{codigo_req}")]["riesgo"] == "mutante"

    # destructivo: cualquier DELETE...
    assert por_ruta[("DELETE", "/api/festivos/{festivo_id}")]["riesgo"] == "destructivo"
    assert por_ruta[("DELETE", "/api/requerimientos/{codigo_req}")]["riesgo"] == "destructivo"

    # ...más la lista explícita del ADR, incluido el caso que demuestra que
    # gana incluso sobre un método por defecto "seguro" (GET).
    assert por_ruta[("POST", "/api/personas/deduplicar")]["riesgo"] == "destructivo"
    assert por_ruta[("POST", "/api/azdo/sync")]["riesgo"] == "destructivo"
    assert por_ruta[("GET", "/api/azdo/campos-requeridos")]["riesgo"] == "destructivo"
    assert por_ruta[("DELETE", "/api/azdo/config")]["riesgo"] == "destructivo"
    assert (
        por_ruta[("POST", "/api/soporte/solicitudes-fabrica/sincronizar")]["riesgo"]
        == "destructivo"
    )
    assert (
        por_ruta[("POST", "/api/soporte/solicitudes-fabrica/ejecutar-carga-automatica")][
            "riesgo"
        ]
        == "destructivo"
    )
    assert (
        por_ruta[("POST", "/api/requerimientos/{codigo_req}/reasignar-aplicacion")]["riesgo"]
        == "destructivo"
    )
    assert por_ruta[("POST", "/api/importacion/excel")]["riesgo"] == "destructivo"


async def test_permiso_y_requiere_aplicacion_salen_del_contrato_openapi(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=["admin.endpoints.ver"])
    resp = await cliente.get(RUTA, headers=headers_con_token(token))
    por_ruta = _por_metodo_ruta(resp.json())

    personas_ver = por_ruta[("GET", "/api/personas")]
    assert personas_ver["permiso"] == "personas.ver"
    assert personas_ver["requiere_aplicacion"] is True

    # /api/auth/login no exige permiso RBAC (es el propio login) ni X-Aplicacion.
    login = por_ruta[("POST", "/api/auth/login")]
    assert login["permiso"] is None
    assert login["requiere_aplicacion"] is False


async def test_fusiona_con_el_catalogo_editable_por_metodo_y_ruta(cliente, fabrica_usuario):
    await EndpointAdmin(
        modulo="Requerimientos (nota manual)",
        metodo="GET",
        ruta="/api/requerimientos",
        descripcion="Nota de negocio cargada a mano para probar la fusión F4.1.",
    ).insert()
    _, token = await fabrica_usuario([], permisos=["admin.endpoints.ver"])
    resp = await cliente.get(RUTA, headers=headers_con_token(token))
    por_ruta = _por_metodo_ruta(resp.json())

    item = por_ruta[("GET", "/api/requerimientos")]
    assert item["enriquecimiento"] is not None
    assert item["enriquecimiento"]["descripcion"] == (
        "Nota de negocio cargada a mano para probar la fusión F4.1."
    )

    # Una ruta sin entrada manual no debe fusionar nada.
    sin_nota = por_ruta[("GET", "/api/health")]
    assert sin_nota["enriquecimiento"] is None
