# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de las correcciones de la revisión de la fase 1 del ADR-0010."""
import uuid
from datetime import UTC, datetime

from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.services.vigencia import (
    a_datetime,
    a_fecha_logica,
    rango_periodo,
    recalcular_squads_todas,
    solapa,
    vigente,
)
from tests.conftest import headers_con_token
from tests.test_membresias import PERMISOS, _cargar_script, _ctx, _d, _membresia


async def _dos_apps(fabrica_aplicacion, fabrica_usuario, permisos=None):
    sufijo = uuid.uuid4().hex[:6]
    a = await fabrica_aplicacion(f"A-{sufijo}")
    b = await fabrica_aplicacion(f"B-{sufijo}")
    _, token = await fabrica_usuario([a.codigo, b.codigo], permisos=permisos or PERMISOS)
    persona = await Persona(aplicacion_id=a.codigo, nombre="Pepe", squads=[a.nombre]).insert()
    return a, b, token, persona


def _efecto(nombre, fecha, activo=False):
    return {"nombre": nombre, "activo": activo, "fecha_efecto_desactivacion": fecha}


async def test_editar_efecto_tras_reactivar_no_toca_cascada_anterior(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, b, token, persona = await _dos_apps(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, a.codigo)
    url = f"/api/personas/{persona.id}"
    viejo = await _membresia(a, persona, "2026-07-01")
    r = await cliente.put(url, json=_efecto(persona.nombre, "2026-10-10"), headers=h)
    assert r.status_code == 200
    r = await cliente.put(url, json={"nombre": persona.nombre, "activo": True}, headers=h)
    assert r.status_code == 200
    assert (await Membresia.get(viejo.id)).cerrada_por_cascada is False
    nueva = await cliente.post(
        f"/api/membresias/persona/{persona.id}",
        json={"squad_id": b.codigo, "desde": "2026-10-20"}, headers=h,
    )
    assert nueva.status_code == 201
    r = await cliente.put(url, json=_efecto(persona.nombre, "2026-11-05"), headers=h)
    assert r.status_code == 200
    r = await cliente.put(
        url, json={"nombre": persona.nombre, "fecha_efecto_desactivacion": "2026-11-10"}, headers=h
    )
    assert r.status_code == 200
    assert a_fecha_logica((await Membresia.get(viejo.id)).hasta) == _d("2026-10-10")
    segunda = await Membresia.get(nueva.json()["_id"])
    assert a_fecha_logica(segunda.hasta) == _d("2026-11-10")


async def test_desactivar_con_efecto_anterior_a_desde_no_pierde_historia(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, _, token, persona = await _dos_apps(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, a.codigo)
    m = await _membresia(a, persona, "2026-10-01")
    resp = await cliente.put(
        f"/api/personas/{persona.id}", json=_efecto(persona.nombre, "2026-09-01"), headers=h
    )
    assert resp.status_code == 200, resp.text
    m = await Membresia.get(m.id)  # sigue existiendo, acotada a 1 día (hasta == desde)
    assert m is not None and m.activo is False
    assert a_fecha_logica(m.hasta) == a_fecha_logica(m.desde) == _d("2026-10-01")
    assert await vigente(_ctx(a), str(persona.id), a.codigo, (_d("2026-10-01"), _d("2026-10-01")))
    oct2 = (_d("2026-10-02"), _d("2026-10-31"))
    assert not await vigente(_ctx(a), str(persona.id), a.codigo, oct2)
    # Cierre manual: hasta == desde se permite; anterior a desde da 422
    q = await Persona(aplicacion_id=a.codigo, nombre="Q").insert()
    otra = await _membresia(a, q, "2026-10-01")
    url = f"/api/membresias/{otra.id}/cerrar"
    anterior = await cliente.patch(url, json={"fecha_efecto": "2026-09-30"}, headers=h)
    igual = await cliente.patch(url, json={"fecha_efecto": "2026-10-01"}, headers=h)
    assert anterior.status_code == 422 and igual.status_code == 200


async def test_cierre_futuro_y_ultimo_squad(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token, persona = await _dos_apps(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, a.codigo)
    ma = await _membresia(a, persona, "2026-07-01")
    mb = await _membresia(b, persona, "2026-07-01")
    r1 = await cliente.patch(
        f"/api/membresias/{ma.id}/cerrar", json={"fecha_efecto": "2026-12-01"}, headers=h
    )
    assert r1.json()["ultimo_squad"] is False  # B sigue abierta
    # B se cierra antes de que termine A (cierre futuro): A aún rige en esa fecha
    r2 = await cliente.patch(
        f"/api/membresias/{mb.id}/cerrar", json={"fecha_efecto": "2026-11-01"}, headers=h
    )
    assert r2.json()["ultimo_squad"] is False
    # Única membresía, cerrada a futuro: es el último squad en su fecha de efecto
    p2 = await Persona(aplicacion_id=a.codigo, nombre="Solo").insert()
    unica = await _membresia(a, p2, "2026-07-01")
    r3 = await cliente.patch(
        f"/api/membresias/{unica.id}/cerrar", json={"fecha_efecto": "2026-12-01"}, headers=h
    )
    assert r3.json()["ultimo_squad"] is True


async def test_cascada_acota_cerradas_posteriores_y_cruza_aplicaciones(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, b, _, persona = await _dos_apps(fabrica_aplicacion, fabrica_usuario)
    # Caracterización: un usuario SIN acceso a B cierra igualmente la membresía de B
    # al desactivar a la persona (la desactivación general alcanza todos sus squads).
    _, token = await fabrica_usuario([a.codigo], permisos=PERMISOS)
    h = headers_con_token(token, a.codigo)
    en_b = await _membresia(b, persona, "2026-07-01")
    posterior = await _membresia(a, persona, "2026-07-01", "2026-12-31")
    resp = await cliente.put(
        f"/api/personas/{persona.id}", json=_efecto(persona.nombre, "2026-10-10"), headers=h
    )
    assert resp.status_code == 200, resp.text
    assert a_fecha_logica((await Membresia.get(en_b.id)).hasta) == _d("2026-10-10")
    assert a_fecha_logica((await Membresia.get(posterior.id)).hasta) == _d("2026-10-10")


async def test_put_persona_modo_consolidado_rechazado(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, _, token, persona = await _dos_apps(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, "__todas__")
    put = await cliente.put(f"/api/personas/{persona.id}", json={"nombre": "X"}, headers=h)
    assert put.status_code == 409


async def test_alta_duplicada_mismo_desde_devuelve_409(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, _, token, persona = await _dos_apps(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, a.codigo)
    # Previa de 0 días: no solapa, pero el índice único (persona, squad, desde) la frena
    await _membresia(a, persona, "2026-10-01", "2026-10-01")
    resp = await cliente.post(
        f"/api/membresias/persona/{persona.id}",
        json={"squad_id": a.codigo, "desde": "2026-10-01"}, headers=h,
    )
    assert resp.status_code == 409


async def test_vigencia_bordes_de_mes():
    def m(desde, hasta=None):
        return Membresia(
            aplicacion_id="x", persona_id="p", squad_id="x", desde=a_datetime(_d(desde)),
            hasta=a_datetime(_d(hasta)) if hasta else None,
        )

    def cuenta(mem, mes):
        return solapa(mem, *rango_periodo(mes))

    assert cuenta(m("2026-07-01", "2026-09-01"), "2026-09")  # hasta = día 1: incluido, cuenta
    assert not cuenta(m("2026-07-01", "2026-08-31"), "2026-09")  # último día = fin de agosto
    assert cuenta(m("2026-07-01", "2026-09-01"), "2026-08")
    assert cuenta(m("2026-09-30"), "2026-09")  # desde = último día: cuenta
    assert not cuenta(m("2026-09-30"), "2026-08")
    assert cuenta(m("2026-12-31"), "2026-12") and not cuenta(m("2026-12-31"), "2026-11")
    assert cuenta(m("2026-12-31"), "2027-01")  # diciembre -> enero
    assert cuenta(m("2026-07-01", "2027-01-01"), "2027-01")
    assert not cuenta(m("2026-07-01", "2026-12-31"), "2027-01")
    assert cuenta(m("2026-09-10", "2026-09-10"), "2026-09")  # hasta == desde: 1 día


async def test_eliminar_persona_borra_membresias(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token, persona = await _dos_apps(
        fabrica_aplicacion, fabrica_usuario, permisos=[*PERMISOS, "personas.eliminar"]
    )
    await _membresia(a, persona, "2026-07-01")
    await _membresia(b, persona, "2026-07-01")
    resp = await cliente.delete(
        f"/api/personas/{persona.id}", headers=headers_con_token(token, a.codigo)
    )
    assert resp.status_code == 204
    assert await Membresia.find({"persona_id": str(persona.id)}).count() == 0


async def test_deduplicar_mueve_membresias(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token, ganador = await _dos_apps(
        fabrica_aplicacion, fabrica_usuario, permisos=[*PERMISOS, "admin.acceso"]
    )
    perdedor = await Persona(aplicacion_id=a.codigo, nombre="Pepe").insert()
    await _membresia(a, ganador, "2026-08-01")
    await _membresia(a, perdedor, "2026-07-01", "2026-09-01")  # solapa: gana el más amplio
    await _membresia(b, perdedor, "2026-07-01")  # sin equivalente: se mueve
    resp = await cliente.post(
        "/api/personas/deduplicar",
        json={"fusiones": [{"ganador_id": str(ganador.id), "perdedor_ids": [str(perdedor.id)]}]},
        headers=headers_con_token(token, a.codigo),
    )
    assert resp.status_code == 200, resp.text
    assert await Membresia.find({"persona_id": str(perdedor.id)}).count() == 0
    en_a = await Membresia.find_one({"persona_id": str(ganador.id), "squad_id": a.codigo})
    assert a_fecha_logica(en_a.desde) == _d("2026-07-01") and en_a.hasta is None
    en_b = await Membresia.find_one({"persona_id": str(ganador.id), "squad_id": b.codigo})
    assert en_b is not None
    assert sorted((await Persona.get(ganador.id)).squads) == sorted([a.nombre, b.nombre])


async def test_recalcular_squads_diario_y_al_leer(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token, persona = await _dos_apps(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, a.codigo)
    await _membresia(a, persona, "2026-07-01")
    await _membresia(b, persona, "2026-07-01", "2026-08-01")  # ya caducó, el derivado no
    coleccion = Persona.get_pymongo_collection()
    await coleccion.update_one({"_id": persona.id}, {"$set": {"squads": [a.nombre, b.nombre]}})
    resp = await cliente.get(f"/api/personas/{persona.id}", headers=h)
    assert resp.json()["squads"] == [a.nombre]
    await coleccion.update_one({"_id": persona.id}, {"$set": {"squads": [a.nombre, b.nombre]}})
    assert await recalcular_squads_todas() >= 1
    assert (await Persona.get(persona.id)).squads == [a.nombre]


async def test_migracion_fecha_utc_a_bogota(fabrica_aplicacion):
    modulo = _cargar_script()
    app = await fabrica_aplicacion(f"UTC-{uuid.uuid4().hex[:6]}")
    p = await Persona(
        aplicacion_id=app.codigo, nombre="Tarde", squads=[app.nombre], activo=False,
        fecha_desactivacion=datetime(2026, 9, 16, 1, 0, tzinfo=UTC),  # 20:00 del 15 en Bogotá
    ).insert()
    await modulo.migrar(dry_run=False)
    m = await Membresia.find_one({"persona_id": str(p.id)})
    assert a_fecha_logica(m.hasta) == _d("2026-09-15")
    efecto = (await Persona.get(p.id)).fecha_efecto_desactivacion
    assert a_fecha_logica(efecto) == _d("2026-09-15")


async def test_migracion_inactivo_sin_fechas(fabrica_aplicacion):
    modulo = _cargar_script()
    app = await fabrica_aplicacion(f"SF-{uuid.uuid4().hex[:6]}")
    p = await Persona(
        aplicacion_id=app.codigo, nombre="SinFechas", squads=[app.nombre], activo=False
    ).insert()
    informe = await modulo.migrar(dry_run=False)
    assert "SinFechas" in [n for n, _ in informe["efecto_respaldo"]]
    m = await Membresia.find_one({"persona_id": str(p.id)})
    assert m.activo is False and m.hasta is not None and m.cerrada_por_cascada is True
    assert (await Persona.get(p.id)).fecha_efecto_desactivacion is not None
