# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Correcciones de la revisión: orden de squads, backfill, lectura sin escritura, metas."""
import asyncio
import uuid
from datetime import UTC, datetime

from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.services.membresias_backfill import backfill_al_arrancar, backfill_persona
from app.services.vigencia import a_datetime, a_fecha_logica, hoy_bogota, recalcular_squads_persona
from tests.conftest import headers_con_token
from tests.test_membresias import PERMISOS, _d, _membresia


async def _apps(fabrica_aplicacion, fabrica_usuario, permisos=None):
    sufijo = uuid.uuid4().hex[:6]
    a = await fabrica_aplicacion(f"RA-{sufijo}")
    b = await fabrica_aplicacion(f"RB-{sufijo}")
    _, token = await fabrica_usuario([a.codigo, b.codigo], permisos=permisos or PERMISOS)
    return a, b, token


async def test_recalcular_no_reordena_squads(fabrica_aplicacion):
    a = await fabrica_aplicacion(f"OA-{uuid.uuid4().hex[:6]}")
    b = await fabrica_aplicacion(f"OB-{uuid.uuid4().hex[:6]}")
    p = await Persona(
        aplicacion_id=a.codigo, nombre="Orden", squads=[b.nombre, "Legado", a.nombre]
    ).insert()
    await _membresia(a, p, "2026-01-01")
    await _membresia(b, p, "2026-01-01")
    assert await recalcular_squads_persona(p) is False
    assert p.squads == [b.nombre, "Legado", a.nombre]
    # una caduca: se quita solo esa, el resto conserva el orden
    ma = await Membresia.find_one({"persona_id": str(p.id), "squad_id": a.codigo})
    ma.hasta, ma.activo = a_datetime(_d("2026-02-01")), False
    await ma.save()
    assert await recalcular_squads_persona(p) is True
    assert p.squads == [b.nombre, "Legado"]


async def test_backfill_no_reordena_ni_quita_squads(fabrica_aplicacion):
    a = await fabrica_aplicacion(f"NA-{uuid.uuid4().hex[:6]}")
    b = await fabrica_aplicacion(f"NB-{uuid.uuid4().hex[:6]}")
    orden = [b.nombre, a.nombre, "Sin Aplicacion"]
    p = await Persona(aplicacion_id=a.codigo, nombre="Intacta", squads=list(orden)).insert()
    await backfill_al_arrancar()
    await backfill_al_arrancar()
    assert (await Persona.get(p.id)).squads == orden
    assert await Membresia.find({"persona_id": str(p.id)}).count() == 2


async def test_backfill_inactivo_cierra_hasta_efecto_inclusivo(fabrica_aplicacion):
    a = await fabrica_aplicacion(f"IN-{uuid.uuid4().hex[:6]}")
    # 03:00 UTC del 14 = 22:00 del 13 en Bogotá
    p = await Persona(
        aplicacion_id=a.codigo, nombre="Baja", squads=[a.nombre], activo=False,
        fecha_desactivacion=datetime(2030, 10, 14, 3, 0, tzinfo=UTC),
    ).insert()
    await backfill_persona(p)
    m = await Membresia.find_one({"persona_id": str(p.id)})
    assert m.desde is None and m.activo is False and m.cerrada_por_cascada is True
    assert a_fecha_logica(m.hasta) == _d("2030-10-13")
    assert a_fecha_logica((await Persona.get(p.id)).fecha_efecto_desactivacion) == _d("2030-10-13")


async def test_backfill_carrera_duplicate_key(fabrica_aplicacion):
    a = await fabrica_aplicacion(f"CA-{uuid.uuid4().hex[:6]}")
    p = await Persona(aplicacion_id=a.codigo, nombre="Carrera", squads=[a.nombre]).insert()
    await asyncio.gather(backfill_persona(p), backfill_persona(p), backfill_persona(p))
    assert await Membresia.find({"persona_id": str(p.id)}).count() == 1


async def test_put_squads_readd_con_cierre_hoy_no_deja_estado_a_medias(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, b, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Readd", squads=[a.nombre]).insert()
    await _membresia(a, p, "2026-01-01")
    hoy = hoy_bogota().isoformat()
    mb = await _membresia(b, p, "2026-01-01", hoy)  # cerrada con hasta = hoy (aún vigente hoy)
    h = headers_con_token(token, a.codigo)
    r = await cliente.put(
        f"/api/personas/{p.id}", json={"nombre": p.nombre, "squads": [a.nombre, b.nombre]},
        headers=h,
    )
    assert r.status_code == 200, r.text
    g = await Membresia.get(mb.id)
    assert g.hasta is None and g.activo is True  # reabierta, sin duplicar
    assert await Membresia.find({"persona_id": str(p.id), "squad_id": b.codigo}).count() == 1
    assert set((await Persona.get(p.id)).squads) == {a.nombre, b.nombre}


async def test_get_perezoso_solo_con_personas_editar(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, _, token = await _apps(fabrica_aplicacion, fabrica_usuario, permisos=["personas.ver"])
    p = await Persona(aplicacion_id=a.codigo, nombre="SoloLee", squads=[a.nombre]).insert()
    r = await cliente.get(
        f"/api/membresias/persona/{p.id}", headers=headers_con_token(token, a.codigo)
    )
    assert r.status_code == 200 and r.json() == []
    assert await Membresia.find({"persona_id": str(p.id)}).count() == 0


async def test_metas_squads_paralelos_cuentan_meta_completa(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, b, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Paralelo", squads=[]).insert()
    await _membresia(a, p, "2030-01-01")
    await _membresia(b, p, "2030-01-01")
    r = await cliente.get(
        "/api/membresias/metas?anio=2030&mes=10", headers=headers_con_token(token, "__todas__")
    )
    filas = [f for f in r.json() if f["persona_id"] == str(p.id)]
    assert len(filas) == 2 and all(f["horas_meta"] == 193.5 for f in filas)


async def test_metas_mes_fuera_de_vigencia_devuelve_vacio(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, _, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Fuera", squads=[]).insert()
    await _membresia(a, p, "2030-01-01", "2030-09-30")
    r = await cliente.get(
        "/api/membresias/metas?anio=2030&mes=10", headers=headers_con_token(token, a.codigo)
    )
    assert r.status_code == 200
    assert all(f["persona_id"] != str(p.id) for f in r.json())
    r = await cliente.get(
        "/api/membresias/metas?anio=2030&mes=9", headers=headers_con_token(token, a.codigo)
    )
    assert any(f["persona_id"] == str(p.id) for f in r.json())


async def test_squads_detalle_vacio_con_squads_legados(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, _, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Legada", squads=["Subequipo X"]).insert()
    r = await cliente.get(f"/api/personas/{p.id}", headers=headers_con_token(token, a.codigo))
    assert r.status_code == 200
    assert r.json()["squads_detalle"] == [] and r.json()["squads"] == ["Subequipo X"]
