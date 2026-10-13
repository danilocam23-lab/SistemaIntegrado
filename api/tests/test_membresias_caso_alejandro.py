# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Caso real: Alejandro, CRM hasta 2026-10-09 (último día activo) y .NET Julio desde 2026-10-13.

«Hoy» simulado = 2026-10-13.
"""
import uuid
from datetime import date, datetime

import pytest

from app.documents.festivo import Festivo
from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.services.membresias_backfill import backfill_persona
from app.services.vigencia import a_datetime, recalcular_squads_persona
from tests.conftest import headers_con_token
from tests.test_membresias import PERMISOS, _d

HOY = date(2026, 10, 13)


@pytest.fixture
def hoy_simulado(monkeypatch):
    monkeypatch.setattr("app.services.vigencia.hoy_bogota", lambda: HOY)


async def _escenario(fabrica_aplicacion, fabrica_usuario):
    sufijo = uuid.uuid4().hex[:6]
    crm = await fabrica_aplicacion(f"CRM-{sufijo}")
    net = await fabrica_aplicacion(f".NET Julio-{sufijo}")
    _, token = await fabrica_usuario([crm.codigo, net.codigo], permisos=PERMISOS)
    p = await Persona(
        aplicacion_id=crm.codigo, nombre="Alejandro Castro Agudelo", squads=[crm.nombre, net.nombre]
    ).insert()
    m_crm = await Membresia(
        aplicacion_id=crm.codigo, persona_id=str(p.id), squad_id=crm.codigo,
        hasta=a_datetime(_d("2026-10-09")), activo=False,
    ).insert()
    m_net = await Membresia(
        aplicacion_id=net.codigo, persona_id=str(p.id), squad_id=net.codigo,
        desde=a_datetime(_d("2026-10-13")),
    ).insert()
    return crm, net, token, p, m_crm, m_net


async def test_metas_octubre_crm_y_net(
    cliente, fabrica_aplicacion, fabrica_usuario, hoy_simulado
):
    crm, net, token, p, _, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    festivo = await Festivo(aplicacion_id="global", fecha=datetime(2026, 10, 12)).insert()
    try:
        r = await cliente.get(
            "/api/membresias/metas?anio=2026&mes=10", headers=headers_con_token(token, "__todas__")
        )
    finally:
        await festivo.delete()
    assert r.status_code == 200, r.text
    filas = {f["squad_id"]: f for f in r.json() if f["persona_id"] == str(p.id)}
    c, n = filas[crm.codigo], filas[net.codigo]
    assert (c["desde_efectivo"], c["hasta_efectivo"]) == ("2026-10-01", "2026-10-09")
    assert (c["dias_habiles"], c["horas_meta"]) == (7, 58.5)
    assert (n["desde_efectivo"], n["hasta_efectivo"]) == ("2026-10-13", "2026-10-31")
    assert (n["dias_habiles"], n["horas_meta"]) == (14, 117.5)
    # ninguna cubre del 10 al 12
    for f in (c, n):
        assert not (f["desde_efectivo"] <= "2026-10-12" <= f["hasta_efectivo"])


async def test_squads_detalle_y_derivado(
    cliente, fabrica_aplicacion, fabrica_usuario, hoy_simulado
):
    crm, net, token, p, _, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, crm.codigo)
    lista = await cliente.get("/api/personas", headers=h)
    fila = next(x for x in lista.json() if x["_id"] == str(p.id))
    det = {d["squad_id"]: d for d in fila["squads_detalle"]}
    assert det[crm.codigo]["activo"] is False and det[crm.codigo]["hasta"] == "2026-10-09"
    assert det[crm.codigo]["desde"] is None
    assert det[net.codigo]["activo"] is True and det[net.codigo]["desde"] == "2026-10-13"
    persona = await Persona.get(p.id)
    await recalcular_squads_persona(persona)
    assert persona.squads == [net.nombre]


async def test_vigencias_octubre_devuelve_ambos(
    cliente, fabrica_aplicacion, fabrica_usuario, hoy_simulado
):
    crm, net, token, p, _, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    r = await cliente.get(
        "/api/membresias/vigencias?desde=2026-10&hasta=2026-10",
        headers=headers_con_token(token, "__todas__"),
    )
    assert r.status_code == 200
    assert sorted(r.json()[str(p.id)]["2026-10"]) == sorted([crm.codigo, net.codigo])


async def test_patch_hasta_sobre_crm_abierta_no_deja_otra_abierta(
    cliente, fabrica_aplicacion, fabrica_usuario, hoy_simulado
):
    crm = await fabrica_aplicacion(f"CRM-{uuid.uuid4().hex[:6]}")
    _, token = await fabrica_usuario([crm.codigo], permisos=PERMISOS)
    p = await Persona(aplicacion_id=crm.codigo, nombre="Alejandro", squads=[crm.nombre]).insert()
    m = await Membresia(
        aplicacion_id=crm.codigo, persona_id=str(p.id), squad_id=crm.codigo
    ).insert()
    h = headers_con_token(token, crm.codigo)
    r = await cliente.patch(f"/api/membresias/{m.id}", json={"hasta": "2026-10-09"}, headers=h)
    assert r.status_code == 200, r.text
    ms = await Membresia.find({"persona_id": str(p.id), "squad_id": crm.codigo}).to_list()
    assert len(ms) == 1 and ms[0].hasta is not None and ms[0].activo is False
    abiertas = await Membresia.find(
        {"persona_id": str(p.id), "squad_id": crm.codigo, "hasta": None}
    ).count()
    assert abiertas == 0
    assert (await Persona.get(p.id)).squads == []


async def test_duplicado_crm_abierta_mas_cerrada_documentado(
    cliente, fabrica_aplicacion, fabrica_usuario, hoy_simulado
):
    """Escenario defectuoso (solo insertable directo en BD): la abierta cuenta como activa y
    ningún camino de la API crea, reabre ni regenera el duplicado."""
    crm = await fabrica_aplicacion(f"CRM-{uuid.uuid4().hex[:6]}")
    _, token = await fabrica_usuario([crm.codigo], permisos=PERMISOS)
    p = await Persona(aplicacion_id=crm.codigo, nombre="Doble", squads=[crm.nombre]).insert()
    pid = str(p.id)
    await Membresia(aplicacion_id=crm.codigo, persona_id=pid, squad_id=crm.codigo).insert()
    cerrada = await Membresia(
        aplicacion_id=crm.codigo, persona_id=pid, squad_id=crm.codigo,
        desde=a_datetime(_d("2026-01-01")), hasta=a_datetime(_d("2026-02-01")), activo=False,
    ).insert()
    h = headers_con_token(token, crm.codigo)
    det = (await cliente.get(f"/api/personas/{pid}", headers=h)).json()["squads_detalle"]
    assert sorted(d["activo"] for d in det) == [False, True]  # la abierta cuenta como activa
    assert (await Persona.get(p.id)).squads == [crm.nombre]
    # abrir otra: 409 por solape
    r = await cliente.post(
        f"/api/membresias/persona/{pid}", json={"squad_id": crm.codigo, "desde": "2026-12-01"},
        headers=h,
    )
    assert r.status_code == 409
    # reabrir la cerrada: 409 por solape con la abierta
    r = await cliente.patch(f"/api/membresias/{cerrada.id}", json={"hasta": None}, headers=h)
    assert r.status_code == 409
    # el backfill no añade nada (el squad ya está cubierto)
    assert await backfill_persona(p) == 0
    assert await Membresia.find({"persona_id": pid}).count() == 2


async def test_backfill_no_resucita_squad_cerrado_a_mano(fabrica_aplicacion, hoy_simulado):
    """Persona.squads aún contiene el squad pero ya hay historial cerrado: no se recrea."""
    crm = await fabrica_aplicacion(f"CRM-{uuid.uuid4().hex[:6]}")
    p = await Persona(aplicacion_id=crm.codigo, nombre="Cerrado", squads=[crm.nombre]).insert()
    await Membresia(
        aplicacion_id=crm.codigo, persona_id=str(p.id), squad_id=crm.codigo,
        hasta=a_datetime(_d("2026-10-09")), activo=False,
    ).insert()
    assert await backfill_persona(p) == 0
    ms = await Membresia.find({"persona_id": str(p.id)}).to_list()
    assert len(ms) == 1 and ms[0].hasta is not None
