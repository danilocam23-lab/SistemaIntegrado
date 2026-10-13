# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Backfill de arranque/perezoso, ``desde`` nulo y edición de fechas (ADR-0010)."""
import uuid

from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.services.membresias_backfill import backfill_al_arrancar
from app.services.vigencia import a_datetime, a_fecha_logica, squads_vigentes, vigente
from tests.conftest import headers_con_token
from tests.test_membresias import PERMISOS, _ctx, _d, _membresia


async def _apps(fabrica_aplicacion, fabrica_usuario):
    sufijo = uuid.uuid4().hex[:6]
    a = await fabrica_aplicacion(f"IA-{sufijo}")
    b = await fabrica_aplicacion(f"IB-{sufijo}")
    _, token = await fabrica_usuario([a.codigo, b.codigo], permisos=PERMISOS)
    return a, b, token


async def test_backfill_arranque_idempotente_conserva_squads(fabrica_aplicacion):
    a = await fabrica_aplicacion(f"BF-{uuid.uuid4().hex[:6]}")
    p = await Persona(
        aplicacion_id=a.codigo, nombre="Legada", squads=["Fantasma", a.nombre]
    ).insert()
    pid = str(p.id)
    await backfill_al_arrancar()
    await backfill_al_arrancar()
    ms = await Membresia.find({"persona_id": pid}).to_list()
    assert len(ms) == 1
    assert ms[0].squad_id == a.codigo and ms[0].desde is None and ms[0].hasta is None
    assert ms[0].activo is True
    # Persona.squads intacto (mismo orden, sin quitar el que no resuelve)
    assert (await Persona.get(p.id)).squads == ["Fantasma", a.nombre]


async def test_backfill_perezoso_en_get(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Pepe", squads=[a.nombre, b.nombre]).insert()
    assert await Membresia.find({"persona_id": str(p.id)}).count() == 0
    h = headers_con_token(token, a.codigo)
    r = await cliente.get(f"/api/membresias/persona/{p.id}", headers=h)
    assert r.status_code == 200
    cuerpo = r.json()
    assert {m["squad_id"] for m in cuerpo} == {a.codigo, b.codigo}
    assert all(m["desde"] is None and m["hasta"] is None for m in cuerpo)
    r2 = await cliente.get(f"/api/membresias/persona/{p.id}", headers=h)
    assert len(r2.json()) == 2
    assert (await Persona.get(p.id)).squads == [a.nombre, b.nombre]


async def test_desde_nulo_vigente_en_cualquier_mes_anterior(fabrica_aplicacion):
    a = await fabrica_aplicacion(f"DN-{uuid.uuid4().hex[:6]}")
    p = await Persona(aplicacion_id=a.codigo, nombre="Antigua", squads=[a.nombre]).insert()
    await Membresia(aplicacion_id=a.codigo, persona_id=str(p.id), squad_id=a.codigo).insert()
    ctx, pid = _ctx(a), str(p.id)
    assert await vigente(ctx, pid, a.codigo, "2020-01")
    assert await vigente(ctx, pid, a.codigo, "2026-10")
    lote = await squads_vigentes(ctx, "2019-11", "2020-02")
    assert set(lote[pid]) == {"2019-11", "2019-12", "2020-01", "2020-02"}


async def test_desde_nulo_cerrada_vigente_hasta_el_cierre(fabrica_aplicacion):
    a = await fabrica_aplicacion(f"DC-{uuid.uuid4().hex[:6]}")
    p = await Persona(aplicacion_id=a.codigo, nombre="Cerrada", squads=[a.nombre]).insert()
    await Membresia(
        aplicacion_id=a.codigo, persona_id=str(p.id), squad_id=a.codigo,
        hasta=a_datetime(_d("2026-03-15")), activo=False,
    ).insert()
    ctx, pid = _ctx(a), str(p.id)
    assert await vigente(ctx, pid, a.codigo, "2026-03")
    assert not await vigente(ctx, pid, a.codigo, "2026-04")
    assert await vigente(ctx, pid, a.codigo, "2018-06")


async def test_post_sin_desde_es_desde_el_inicio(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Nuevo", squads=[]).insert()
    h = headers_con_token(token, a.codigo)
    r = await cliente.post(
        f"/api/membresias/persona/{p.id}", json={"squad_id": b.codigo}, headers=h
    )
    assert r.status_code == 201, r.text
    assert r.json()["desde"] is None


async def test_patch_editar_desde_y_hasta(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Edita", squads=[a.nombre]).insert()
    m = await _membresia(a, p, "2026-07-01")
    h = headers_con_token(token, a.codigo)
    url = f"/api/membresias/{m.id}"
    r = await cliente.patch(url, json={"desde": "2026-06-01"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["desde"].startswith("2026-06-01") and r.json()["hasta"] is None
    r = await cliente.patch(url, json={"hasta": "2026-09-15"}, headers=h)
    assert r.status_code == 200
    g = await Membresia.get(m.id)
    assert g.activo is False and a_fecha_logica(g.hasta) == _d("2026-09-15")
    assert a_fecha_logica(g.fecha_efecto_desactivacion) == _d("2026-09-15")
    assert g.fecha_desactivacion is not None
    # desde = null (inicio del proyecto) conserva hasta
    r = await cliente.patch(url, json={"desde": None}, headers=h)
    assert r.status_code == 200 and r.json()["desde"] is None
    assert a_fecha_logica((await Membresia.get(m.id)).hasta) == _d("2026-09-15")
    # validaciones
    assert (await cliente.patch(url, json={}, headers=h)).status_code == 422
    r = await cliente.patch(url, json={"desde": "2026-09-15"}, headers=h)
    assert r.status_code == 200  # hasta == desde: dura 1 día
    r = await cliente.patch(url, json={"desde": "2026-09-16"}, headers=h)
    assert r.status_code == 422  # hasta < desde


async def test_patch_reabrir_con_hasta_nulo(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Reabre", squads=[]).insert()
    m = await _membresia(
        a, p, "2026-07-01", "2026-09-15", cerrada_por_cascada=True,
        fecha_efecto_desactivacion=a_datetime(_d("2026-09-15")),
    )
    h = headers_con_token(token, a.codigo)
    r = await cliente.patch(f"/api/membresias/{m.id}", json={"hasta": None}, headers=h)
    assert r.status_code == 200, r.text
    g = await Membresia.get(m.id)
    assert g.activo is True and g.hasta is None
    assert g.fecha_efecto_desactivacion is None and g.cerrada_por_cascada is False
    assert a.nombre in (await Persona.get(p.id)).squads  # derivado recalculado


async def test_patch_reabrir_persona_inactiva_409(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Baja", squads=[], activo=False).insert()
    m = await _membresia(a, p, "2026-07-01", "2026-09-15")
    h = headers_con_token(token, a.codigo)
    r = await cliente.patch(f"/api/membresias/{m.id}", json={"hasta": None}, headers=h)
    assert r.status_code == 409


async def test_patch_solape_409(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Solapa", squads=[]).insert()
    primera = await _membresia(a, p, "2026-01-01", "2026-03-01")
    segunda = await _membresia(a, p, "2026-05-01", "2026-06-01")
    h = headers_con_token(token, a.codigo)
    # extender la primera hasta mayo-15 pisa a la segunda
    r = await cliente.patch(
        f"/api/membresias/{primera.id}", json={"hasta": "2026-05-15"}, headers=h
    )
    assert r.status_code == 409
    # reabrir la primera (abierta) también la pisa
    r = await cliente.patch(f"/api/membresias/{primera.id}", json={"hasta": None}, headers=h)
    assert r.status_code == 409
    # adelantar el desde de la segunda sobre la primera
    r = await cliente.patch(
        f"/api/membresias/{segunda.id}", json={"desde": "2026-02-01"}, headers=h
    )
    assert r.status_code == 409
    # hasta es inclusivo: terminar el día del desde de la segunda ya la pisa
    r = await cliente.patch(
        f"/api/membresias/{primera.id}", json={"hasta": "2026-05-01"}, headers=h
    )
    assert r.status_code == 409
    r = await cliente.patch(
        f"/api/membresias/{primera.id}", json={"hasta": "2026-04-30"}, headers=h
    )
    assert r.status_code == 200


async def test_patch_fuga_entre_aplicaciones(cliente, fabrica_aplicacion, fabrica_usuario):
    sufijo = uuid.uuid4().hex[:6]
    a = await fabrica_aplicacion(f"FA-{sufijo}")
    b = await fabrica_aplicacion(f"FB-{sufijo}")
    _, token = await fabrica_usuario([a.codigo], permisos=PERMISOS)  # sin acceso a b
    p = await Persona(aplicacion_id=a.codigo, nombre="Fuga", squads=[]).insert()
    m_b = await _membresia(b, p, "2026-07-01")
    h = headers_con_token(token, a.codigo)
    r = await cliente.patch(f"/api/membresias/{m_b.id}", json={"hasta": "2026-09-01"}, headers=h)
    assert r.status_code == 404
    assert (await Membresia.get(m_b.id)).hasta is None
    # el GET perezoso tampoco devuelve membresías de aplicaciones no autorizadas
    r = await cliente.get(f"/api/membresias/persona/{p.id}", headers=h)
    assert all(m["aplicacion_id"] == a.codigo for m in r.json())
