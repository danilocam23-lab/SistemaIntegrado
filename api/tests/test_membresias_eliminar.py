# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de DELETE /api/membresias/{id}: borrado físico de una membresía."""
import uuid

from app.documents.bitacora import Bitacora
from app.documents.membresia import Membresia
from app.documents.persona import Persona
from tests.conftest import headers_con_token
from tests.test_membresias import PERMISOS, _membresia


async def _escenario(fabrica_aplicacion, fabrica_usuario):
    sufijo = uuid.uuid4().hex[:6]
    a = await fabrica_aplicacion(f"EA-{sufijo}")
    b = await fabrica_aplicacion(f"EB-{sufijo}")
    _, token = await fabrica_usuario([a.codigo, b.codigo], permisos=PERMISOS)
    persona = await Persona(
        aplicacion_id=a.codigo, nombre="Elimina", squads=[a.nombre, b.nombre]
    ).insert()
    ma = await _membresia(a, persona, "2026-01-01")
    mb = await _membresia(b, persona, "2026-01-01")
    return a, b, token, persona, ma, mb


async def test_eliminar_abierta_recalcula_squads(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token, persona, ma, mb = await _escenario(fabrica_aplicacion, fabrica_usuario)
    resp = await cliente.delete(
        f"/api/membresias/{ma.id}", headers=headers_con_token(token, a.codigo)
    )
    assert resp.status_code == 200
    assert resp.json() == {"eliminada": str(ma.id), "squads": [b.nombre], "ultimo_squad": False}
    assert await Membresia.get(ma.id) is None
    assert await Membresia.get(mb.id) is not None  # la otra no se toca
    recargada = await Persona.get(persona.id)
    assert recargada.squads == [b.nombre]
    assert recargada.activo is True
    assert await Bitacora.find_one({"entidad_id": str(ma.id), "accion": "eliminar"}) is not None


async def test_eliminar_cerrada_y_ultima(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token, persona, ma, mb = await _escenario(fabrica_aplicacion, fabrica_usuario)
    cerrada = await _membresia(a, persona, "2025-01-01", "2025-06-30")
    h = headers_con_token(token, a.codigo)
    resp = await cliente.delete(f"/api/membresias/{cerrada.id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["ultimo_squad"] is False
    assert (await Persona.get(persona.id)).squads == [a.nombre, b.nombre]
    # se eliminan las dos vigentes: la última deja a la persona sin membresías
    assert (await cliente.delete(f"/api/membresias/{ma.id}", headers=h)).status_code == 200
    ultima = await cliente.delete(
        f"/api/membresias/{mb.id}", headers=headers_con_token(token, b.codigo)
    )
    assert ultima.status_code == 200
    assert ultima.json()["ultimo_squad"] is True
    assert ultima.json()["squads"] == []
    assert (await Persona.get(persona.id)).activo is True


async def test_eliminar_sin_acceso_a_la_aplicacion(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, _, _, ma, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    ajena = await fabrica_aplicacion(f"EX-{uuid.uuid4().hex[:6]}")
    _, token = await fabrica_usuario([ajena.codigo], permisos=PERMISOS)
    resp = await cliente.delete(
        f"/api/membresias/{ma.id}", headers=headers_con_token(token, ajena.codigo)
    )
    assert resp.status_code in (403, 404)
    assert await Membresia.get(ma.id) is not None


async def test_eliminar_sin_permiso(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, _, _, ma, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    _, token = await fabrica_usuario([a.codigo], permisos=["personas.ver"])
    resp = await cliente.delete(
        f"/api/membresias/{ma.id}", headers=headers_con_token(token, a.codigo)
    )
    assert resp.status_code == 403
    assert await Membresia.get(ma.id) is not None


async def test_eliminar_inexistente_o_mal_formado(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, token, _, _, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, a.codigo)
    assert (
        await cliente.delete("/api/membresias/64b7f0f0f0f0f0f0f0f0f0f0", headers=h)
    ).status_code == 404
    assert (await cliente.delete("/api/membresias/no-es-id", headers=h)).status_code == 404


async def test_eliminar_rechaza_modo_consolidado(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, token, _, ma, _ = await _escenario(fabrica_aplicacion, fabrica_usuario)
    resp = await cliente.delete(
        f"/api/membresias/{ma.id}", headers=headers_con_token(token, "__todas__")
    )
    assert resp.status_code >= 400
    assert await Membresia.get(ma.id) is not None
