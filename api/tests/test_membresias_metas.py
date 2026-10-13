# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Metas de horas por persona y squad, ``hasta`` inclusivo y ``squads_detalle`` (ADR-0010).

Las metas usan octubre de 2030 (martes 1) para no chocar con festivos globales de otros tests.
"""
import uuid
from datetime import datetime

from app.documents.festivo import Festivo
from app.documents.membresia import Membresia
from app.documents.persona import Persona
from tests.conftest import headers_con_token
from tests.test_membresias import PERMISOS, _membresia


async def _apps(fabrica_aplicacion, fabrica_usuario):
    sufijo = uuid.uuid4().hex[:6]
    a = await fabrica_aplicacion(f"MA-{sufijo}")
    b = await fabrica_aplicacion(f"MB-{sufijo}")
    _, token = await fabrica_usuario([a.codigo, b.codigo], permisos=PERMISOS)
    return a, b, token


async def _metas(cliente, token, codigo, mes=10):
    h = headers_con_token(token, codigo)
    r = await cliente.get(f"/api/membresias/metas?anio=2030&mes={mes}", headers=h)
    assert r.status_code == 200, r.text
    return r.json()


async def test_metas_caso_alejandro_hasta_inclusivo(cliente, fabrica_aplicacion, fabrica_usuario):
    crm, net, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=crm.codigo, nombre="Alejandro", squads=[]).insert()
    await _membresia(crm, p, "2030-07-01", "2030-10-13")  # CRM: último día activo = 13-oct
    await _membresia(net, p, "2030-07-01")
    filas = {
        f["squad_id"]: f
        for f in await _metas(cliente, token, "__todas__")
        if f["persona_id"] == str(p.id)
    }
    c, n = filas[crm.codigo], filas[net.codigo]
    assert (c["desde_efectivo"], c["hasta_efectivo"]) == ("2030-10-01", "2030-10-13")
    assert (c["dias_habiles"], c["horas_meta"]) == (9, 75.5)
    assert c["squad"] == crm.nombre
    # .NET abierto: meta completa del mes, sin dividir entre squads en paralelo
    assert (n["desde_efectivo"], n["hasta_efectivo"]) == ("2030-10-01", "2030-10-31")
    assert (n["dias_habiles"], n["horas_meta"]) == (23, 193.5)
    # en noviembre CRM ya no cuenta
    nov = await _metas(cliente, token, "__todas__", mes=11)
    assert crm.codigo not in {f["squad_id"] for f in nov if f["persona_id"] == str(p.id)}


async def test_metas_desde_nulo_mes_completo(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Antigua", squads=[]).insert()
    await Membresia(aplicacion_id=a.codigo, persona_id=str(p.id), squad_id=a.codigo).insert()
    fila = next(f for f in await _metas(cliente, token, a.codigo) if f["persona_id"] == str(p.id))
    assert fila["desde_efectivo"] == "2030-10-01" and fila["hasta_efectivo"] == "2030-10-31"
    assert (fila["dias_habiles"], fila["horas_meta"]) == (23, 193.5)


async def test_metas_descuenta_festivos(cliente, fabrica_aplicacion, fabrica_usuario):
    a, _, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Festivo", squads=[]).insert()
    await _membresia(a, p, "2030-07-01")
    fest = await Festivo(aplicacion_id="global", fecha=datetime(2030, 10, 7)).insert()
    try:
        fila = next(
            f for f in await _metas(cliente, token, a.codigo) if f["persona_id"] == str(p.id)
        )
        assert (fila["dias_habiles"], fila["horas_meta"]) == (22, 185.0)
    finally:
        await fest.delete()


async def test_metas_fuga_entre_aplicaciones(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Fuga", squads=[]).insert()
    await _membresia(b, p, "2030-07-01")
    assert all(f["persona_id"] != str(p.id) for f in await _metas(cliente, token, a.codigo))
    solo_a = await fabrica_aplicacion(f"SA-{uuid.uuid4().hex[:6]}")
    _, token2 = await fabrica_usuario([solo_a.codigo], permisos=PERMISOS)
    filas = await _metas(cliente, token2, solo_a.codigo)
    assert all(f["persona_id"] != str(p.id) for f in filas)


async def test_cerrar_ultimo_squad_con_hasta_inclusivo(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    a, b, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(aplicacion_id=a.codigo, nombre="Ult", squads=[]).insert()
    ma = await _membresia(a, p, "2030-07-01")
    await _membresia(b, p, "2030-07-01", "2030-10-13")
    h = headers_con_token(token, a.codigo)
    # B es activa hasta el 13 incluido: cerrar A con efecto 13 deja a la persona sin squads
    # a partir del 14; con efecto 12, B aún rige el 13.
    r = await cliente.patch(
        f"/api/membresias/{ma.id}/cerrar", json={"fecha_efecto": "2030-10-13"}, headers=h
    )
    assert r.status_code == 200 and r.json()["ultimo_squad"] is True


async def test_squads_detalle_en_persona_y_listado(cliente, fabrica_aplicacion, fabrica_usuario):
    a, b, token = await _apps(fabrica_aplicacion, fabrica_usuario)
    p = await Persona(
        aplicacion_id=a.codigo, nombre="Detalle", squads=[a.nombre, b.nombre]
    ).insert()
    await _membresia(a, p, "2026-01-01", "2026-03-01")  # cerrada en el pasado
    await _membresia(b, p, "2026-01-01")  # abierta
    h = headers_con_token(token, a.codigo)
    r = await cliente.get(f"/api/personas/{p.id}", headers=h)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["squads"] == [b.nombre]
    det = {d["squad"]: d for d in cuerpo["squads_detalle"]}
    assert det[a.nombre]["activo"] is False and det[a.nombre]["hasta"] == "2026-03-01"
    assert det[b.nombre]["activo"] is True and det[b.nombre]["hasta"] is None
    assert det[b.nombre]["squad_id"] == b.codigo and det[b.nombre]["desde"] == "2026-01-01"
    lista = await cliente.get("/api/personas", headers=h)
    fila = next(x for x in lista.json() if x["_id"] == str(p.id))
    assert {d["squad"] for d in fila["squads_detalle"]} == {a.nombre, b.nombre}


async def test_squads_detalle_respeta_acceso_por_aplicacion(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    sufijo = uuid.uuid4().hex[:6]
    a = await fabrica_aplicacion(f"DA-{sufijo}")
    b = await fabrica_aplicacion(f"DB-{sufijo}")
    _, token = await fabrica_usuario([a.codigo], permisos=PERMISOS)  # sin acceso a B
    p = await Persona(aplicacion_id=a.codigo, nombre="Parcial", squads=[]).insert()
    await _membresia(a, p, "2026-01-01")
    await _membresia(b, p, "2026-01-01")
    r = await cliente.get(f"/api/personas/{p.id}", headers=headers_con_token(token, a.codigo))
    assert [d["squad_id"] for d in r.json()["squads_detalle"]] == [a.codigo]
