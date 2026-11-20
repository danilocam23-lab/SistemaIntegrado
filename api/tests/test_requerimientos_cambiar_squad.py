"""``POST /requerimientos/{codigo_req}/cambiar-squad``: solo administradores, desde una
aplicación concreta, con limpieza de personas ajenas al squad destino."""
import uuid
from decimal import Decimal

import pytest

from app.documents.bitacora import Bitacora
from app.documents.estimacion import Estimacion
from app.documents.persona import Persona
from app.documents.requerimiento import Requerimiento, Solicitud
from tests.conftest import headers_con_token

PERMISOS = ["requerimientos.ver", "requerimientos.crear", "requerimientos.editar"]
ESTADO = "ESTIMACION EN CURSO POR HITSS"


@pytest.fixture
async def dos_apps(fabrica_usuario, fabrica_aplicacion):
    a, b = await fabrica_aplicacion(), await fabrica_aplicacion()
    _, token = await fabrica_usuario([a.codigo, b.codigo], permisos=PERMISOS, rol="admin_app")
    return a, b, headers_con_token(token, a.codigo)


async def _persona(app_codigo: str, rol: str, **extra) -> Persona:
    return await Persona(
        aplicacion_id=app_codigo, nombre=f"P-{uuid.uuid4().hex[:6]}", rol_operativo=rol, **extra
    ).insert()


async def _req(
    app_codigo: str, codigo_req: str = "REQ-CS", sc: str = "SC-1", **sol
) -> Requerimiento:
    return await Requerimiento(
        aplicacion_id=app_codigo,
        codigo_req=codigo_req,
        estado=ESTADO,
        total_horas_estimadas=Decimal("10"),
        solicitud=Solicitud(codigo_sc=sc, squad_id=app_codigo, **sol),
    ).insert()


def _url(codigo: str) -> str:
    return f"/api/requerimientos/{codigo}/cambiar-squad"


async def test_no_admin_da_403(cliente, fabrica_usuario, fabrica_aplicacion):
    a, b = await fabrica_aplicacion(), await fabrica_aplicacion()
    _, token = await fabrica_usuario([a.codigo, b.codigo], permisos=PERMISOS)
    req = await _req(a.codigo)
    h = headers_con_token(token, a.codigo)
    resp = await cliente.post(_url(str(req.id)), json={"squad_destino": b.codigo}, headers=h)
    assert resp.status_code == 403
    assert (await Requerimiento.get(req.id)).aplicacion_id == a.codigo


async def test_admin_mueve_limpia_personas_ajenas_y_conserva_lt(cliente, dos_apps):
    a, b, h = dos_apps
    lt_h = await _persona(a.codigo, "LT_HITSS")
    lt_e = await _persona(a.codigo, "LT_EPM")
    scrum_a = await _persona(a.codigo, "SCRUM")
    scrum_b = await _persona(b.codigo, "SCRUM")  # pertenece al destino: se conserva
    ar_a = await _persona(a.codigo, "AR/QA")
    req = await _req(
        a.codigo, lt_hitss_id=str(lt_h.id), lt_epm_id=str(lt_e.id),
        scrum_id=str(scrum_a.id), analista_requerimientos_id=str(ar_a.id),
    )
    await Estimacion(aplicacion_id=a.codigo, requerimiento_id=str(req.id)).insert()
    await Bitacora(
        aplicacion_id=a.codigo, entidad_tipo="requerimiento", entidad_id=str(req.id),
        accion="crear", descripcion="x", autor="t",
    ).insert()

    resp = await cliente.post(_url(str(req.id)), json={"squad_destino": b.codigo}, headers=h)
    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["aplicacion_anterior"] == a.codigo and cuerpo["aplicacion_nueva"] == b.codigo
    assert {p["campo"] for p in cuerpo["personas_limpiadas"]} == {
        "scrum_id", "analista_requerimientos_id"
    }
    movido = await Requerimiento.get(req.id)
    assert movido.aplicacion_id == b.codigo and movido.solicitud.squad_id == b.codigo
    assert movido.solicitud.lt_hitss_id == str(lt_h.id)
    assert movido.solicitud.lt_epm_id == str(lt_e.id)
    assert movido.solicitud.scrum_id is None
    assert movido.solicitud.analista_requerimientos_id is None
    assert await Estimacion.find({"aplicacion_id": b.codigo}).count() == 1
    acciones = await Bitacora.find({"aplicacion_id": b.codigo, "entidad_id": str(req.id)}).to_list()
    assert any(x.accion == "cambiar_squad" and f"{a.codigo} → {b.codigo}" in x.descripcion
               for x in acciones)
    # Una persona del destino no se limpia.
    req2 = await _req(a.codigo, "REQ-CS2", scrum_id=str(scrum_b.id))
    resp2 = await cliente.post(_url(str(req2.id)), json={"squad_destino": b.codigo}, headers=h)
    assert resp2.json()["personas_limpiadas"] == []
    assert (await Requerimiento.get(req2.id)).solicitud.scrum_id == str(scrum_b.id)


async def test_destino_inexistente_inactivo_o_igual_da_422(cliente, dos_apps, fabrica_aplicacion):
    a, _, h = dos_apps
    inactiva = await fabrica_aplicacion()
    inactiva.activa = False
    await inactiva.save()
    req = await _req(a.codigo)
    for destino in ("no-existe-" + uuid.uuid4().hex[:6], inactiva.codigo, a.codigo):
        resp = await cliente.post(_url(str(req.id)), json={"squad_destino": destino}, headers=h)
        assert resp.status_code == 422, destino


async def test_sin_acceso_al_destino_da_403(cliente, dos_apps, fabrica_aplicacion):
    a, _, h = dos_apps
    ajena = await fabrica_aplicacion()
    req = await _req(a.codigo)
    resp = await cliente.post(_url(str(req.id)), json={"squad_destino": ajena.codigo}, headers=h)
    assert resp.status_code == 403
    assert (await Requerimiento.get(req.id)).aplicacion_id == a.codigo


async def test_duplicado_en_destino_da_409(cliente, dos_apps):
    a, b, h = dos_apps
    origen = await _req(a.codigo, "REQ-DUPS", "SC-1")
    await _req(b.codigo, "REQ-DUPS", "SC-1")
    resp = await cliente.post(_url(str(origen.id)), json={"squad_destino": b.codigo}, headers=h)
    assert resp.status_code == 409
    assert (await Requerimiento.get(origen.id)).aplicacion_id == a.codigo


async def test_requerimiento_de_otra_aplicacion_da_404(cliente, dos_apps):
    a, b, h = dos_apps
    ajeno = await _req(b.codigo, "REQ-AJENO")
    # Destino válido pero distinto de la app activa: el req ajeno no se encuentra.
    resp = await cliente.post(_url(str(ajeno.id)), json={"squad_destino": b.codigo}, headers=h)
    assert resp.status_code == 404
    assert (await Requerimiento.get(ajeno.id)).aplicacion_id == b.codigo


async def test_consolidado_rechazado(cliente, dos_apps):
    a, b, h = dos_apps
    req = await _req(a.codigo, "REQ-CONS")
    h_consolidado = {**h, "X-Aplicacion": "__todas__"}
    resp = await cliente.post(
        _url(str(req.id)), json={"squad_destino": b.codigo}, headers=h_consolidado
    )
    assert resp.status_code == 409
    assert (await Requerimiento.get(req.id)).aplicacion_id == a.codigo
