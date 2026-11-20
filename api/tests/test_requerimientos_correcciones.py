# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Correcciones del router de requerimientos: personas por membresía, squad no
borrable, concurrencia atómica, estados normalizados y reasignar/diagnóstico."""
import asyncio
import uuid

import pytest

from app.documents.persona import Persona
from app.documents.requerimiento import Requerimiento
from tests.conftest import headers_con_token
from tests.test_requerimientos_reglas import (
    ESTADO_INICIAL,
    PERMISOS,
    _cuerpo_crear,
    _req,
    entorno,  # noqa: F401  (fixture reutilizada)
)

# --- Squad: no se puede borrar ------------------------------------------------------


@pytest.mark.parametrize("vacio", [None, ""])
async def test_put_no_permite_borrar_squad_id(cliente, entorno, vacio):  # noqa: F811
    app, h = entorno
    req = await _req(app.codigo)
    resp = await cliente.put(
        f"/api/requerimientos/{req.id}",
        json={"solicitud": {"codigo_sc": "SC-1", "squad_id": vacio}},
        headers=h,
    )
    assert resp.status_code == 422
    assert (await Requerimiento.get(req.id)).solicitud.squad_id == app.codigo


# --- Personas por membresía (mismo criterio que GET /personas) ----------------------

CAMPOS_PERSONA = [
    ("lt_hitss_id", "LT_HITSS"),
    ("lt_epm_id", "LT_EPM"),
    ("scrum_id", "SCRUM"),
    ("analista_requerimientos_id", "AR/QA"),
]


async def _persona_cruzada(app, otra, rol: str, con_membresia: bool) -> Persona:
    return await Persona(
        aplicacion_id=otra.codigo,
        nombre=f"X-{uuid.uuid4().hex[:6]}",
        rol_operativo=rol,
        squads=[app.nombre] if con_membresia else [],
    ).insert()


@pytest.mark.parametrize(("campo", "rol"), CAMPOS_PERSONA)
async def test_persona_cross_squad_por_membresia_aceptada_en_post_put_y_patch(
    cliente, entorno, fabrica_aplicacion, campo, rol  # noqa: F811
):
    app, h = entorno
    otra = await fabrica_aplicacion()
    cruzada = await _persona_cruzada(app, otra, rol, con_membresia=True)

    cuerpo = _cuerpo_crear(app.codigo)
    cuerpo["solicitud"][campo] = str(cruzada.id)
    creada = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert creada.status_code == 201

    req = await _req(app.codigo, "REQ-CRUZ")
    editada = await cliente.put(
        f"/api/requerimientos/{req.id}",
        json={"solicitud": {"codigo_sc": "SC-1", campo: str(cruzada.id)}},
        headers=h,
    )
    assert editada.status_code == 200
    if campo == "analista_requerimientos_id":
        req2 = await _req(app.codigo, "REQ-CRUZ2")
        parcheada = await cliente.patch(
            f"/api/requerimientos/{req2.id}/analista",
            json={"analista_requerimientos_id": str(cruzada.id)},
            headers=h,
        )
        assert parcheada.status_code == 200


@pytest.mark.parametrize(("campo", "rol"), CAMPOS_PERSONA)
async def test_persona_de_otra_app_sin_membresia_da_422_en_post_put_y_patch(
    cliente, entorno, fabrica_aplicacion, campo, rol  # noqa: F811
):
    app, h = entorno
    otra = await fabrica_aplicacion()
    ajena = await _persona_cruzada(app, otra, rol, con_membresia=False)

    cuerpo = _cuerpo_crear(app.codigo)
    cuerpo["solicitud"][campo] = str(ajena.id)
    assert (await cliente.post("/api/requerimientos", json=cuerpo, headers=h)).status_code == 422

    req = await _req(app.codigo, "REQ-AJENA")
    editada = await cliente.put(
        f"/api/requerimientos/{req.id}",
        json={"solicitud": {"codigo_sc": "SC-1", campo: str(ajena.id)}},
        headers=h,
    )
    assert editada.status_code == 422
    if campo == "analista_requerimientos_id":
        parcheada = await cliente.patch(
            f"/api/requerimientos/{req.id}/analista",
            json={"analista_requerimientos_id": str(ajena.id)},
            headers=h,
        )
        assert parcheada.status_code == 422


# --- Concurrencia atómica ------------------------------------------------------------


async def test_put_concurrentes_con_la_misma_marca_solo_uno_gana(cliente, entorno):  # noqa: F811
    app, h = entorno
    req = await _req(app.codigo)
    url = f"/api/requerimientos/{req.id}"
    leido = (await cliente.get(url, headers=h)).json()["actualizado_en"]

    respuestas = await asyncio.gather(
        cliente.put(url, json={"nombre": "A", "actualizado_en": leido}, headers=h),
        cliente.put(url, json={"nombre": "B", "actualizado_en": leido}, headers=h),
    )
    assert sorted(r.status_code for r in respuestas) == [200, 409]
    perdedora = next(r for r in respuestas if r.status_code == 409)
    assert "recarga" in perdedora.json()["detail"]
    ganadora = next(r for r in respuestas if r.status_code == 200)
    assert (await Requerimiento.get(req.id)).nombre == ganadora.json()["nombre"]


# --- Estados: normalización y vacío --------------------------------------------------


@pytest.mark.parametrize("estado", ["entrega cargada", " ENTREGA CARGADA ", "Entrega Cargada"])
async def test_put_estado_con_otra_forma_no_elude_la_maquina_de_estados(
    cliente, entorno, estado  # noqa: F811
):
    app, h = entorno
    req = await _req(app.codigo)
    resp = await cliente.put(f"/api/requerimientos/{req.id}", json={"estado": estado}, headers=h)
    assert resp.status_code == 409
    assert (await Requerimiento.get(req.id)).estado == ESTADO_INICIAL


async def test_post_transicion_con_otra_forma_tambien_se_valida(cliente, entorno):  # noqa: F811
    app, h = entorno
    req = await _req(app.codigo)
    resp = await cliente.post(
        f"/api/requerimientos/{req.id}/transicion",
        json={"nuevo_estado": " entrega cargada"},
        headers=h,
    )
    assert resp.status_code == 409


@pytest.mark.parametrize("estado", [None, "", "   "])
async def test_put_estado_nulo_o_vacio_da_422(cliente, entorno, estado):  # noqa: F811
    app, h = entorno
    req = await _req(app.codigo)
    resp = await cliente.put(f"/api/requerimientos/{req.id}", json={"estado": estado}, headers=h)
    assert resp.status_code == 422
    assert (await Requerimiento.get(req.id)).estado == ESTADO_INICIAL


# --- Reasignar aplicación / diagnóstico ---------------------------------------------


@pytest.fixture
async def dos_apps(cliente, fabrica_usuario, fabrica_aplicacion):
    """Usuario con dos squads activos y permiso de edición: puede usar el consolidado."""
    a, b = await fabrica_aplicacion(), await fabrica_aplicacion()
    _, token = await fabrica_usuario([a.codigo, b.codigo], permisos=PERMISOS, rol="admin_app")
    return a, b, headers_con_token(token, "__todas__")


def _url_reasignar(codigo: str, destino: str) -> str:
    return f"/api/requerimientos/{codigo}/reasignar-aplicacion?nueva_aplicacion={destino}"


async def test_reasignar_actualiza_aplicacion_y_squad_id(cliente, dos_apps):
    a, b, h = dos_apps
    req = await _req(a.codigo, "REQ-RE")
    resp = await cliente.post(_url_reasignar("REQ-RE", b.codigo), headers=h)
    assert resp.status_code == 200
    movido = await Requerimiento.get(req.id)
    assert movido.aplicacion_id == b.codigo
    assert movido.solicitud.squad_id == b.codigo


async def test_reasignar_a_destino_no_autorizado_da_403(cliente, dos_apps, fabrica_aplicacion):
    a, _, h = dos_apps
    ajena = await fabrica_aplicacion()
    req = await _req(a.codigo, "REQ-NA")
    resp = await cliente.post(_url_reasignar("REQ-NA", ajena.codigo), headers=h)
    assert resp.status_code == 403
    assert (await Requerimiento.get(req.id)).aplicacion_id == a.codigo


async def test_reasignar_a_destino_inactivo_o_inexistente_da_422(
    cliente, dos_apps, fabrica_aplicacion
):
    a, _, h = dos_apps
    inactiva = await fabrica_aplicacion()
    inactiva.activa = False
    await inactiva.save()
    await _req(a.codigo, "REQ-IN")
    for destino in (inactiva.codigo, "no-existe-" + uuid.uuid4().hex[:6]):
        resp = await cliente.post(_url_reasignar("REQ-IN", destino), headers=h)
        assert resp.status_code == 422, destino


async def test_reasignar_codigo_ambiguo_da_409_y_el_id_resuelve(cliente, dos_apps):
    a, b, h = dos_apps
    uno = await _req(a.codigo, "REQ-AMB", "SC-1")
    await _req(a.codigo, "REQ-AMB", "SC-2")
    ambiguo = await cliente.post(_url_reasignar("REQ-AMB", b.codigo), headers=h)
    assert ambiguo.status_code == 409
    por_id = await cliente.post(_url_reasignar(str(uno.id), b.codigo), headers=h)
    assert por_id.status_code == 200
    assert (await Requerimiento.get(uno.id)).aplicacion_id == b.codigo


async def test_reasignar_duplicado_en_destino_da_409(cliente, dos_apps):
    a, b, h = dos_apps
    origen = await _req(a.codigo, "REQ-DUP2", "SC-1")
    await _req(b.codigo, "REQ-DUP2", "SC-1")
    resp = await cliente.post(_url_reasignar("REQ-DUP2", b.codigo), headers=h)
    assert resp.status_code == 409
    assert (await Requerimiento.get(origen.id)).aplicacion_id == a.codigo


async def test_diagnostico_codigo_ambiguo_da_409(cliente, dos_apps):
    a, _, h = dos_apps
    await _req(a.codigo, "REQ-DIA", "SC-1")
    await _req(a.codigo, "REQ-DIA", "SC-2")
    resp = await cliente.get("/api/requerimientos/REQ-DIA/diagnostico", headers=h)
    assert resp.status_code == 409
    unico = await _req(a.codigo, "REQ-DIA-U", "SC-1")
    ok = await cliente.get("/api/requerimientos/REQ-DIA-U/diagnostico", headers=h)
    assert ok.status_code == 200
    assert ok.json()["_id"] == str(unico.id)
