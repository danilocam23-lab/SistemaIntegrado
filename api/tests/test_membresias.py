# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de membresías persona-squad con vigencia (ADR-0010, fase 1)."""
import importlib.util
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.middleware.aplicacion import ContextoAplicacion
from app.services.vigencia import a_datetime, a_fecha_logica, squads_vigentes, vigente
from tests.conftest import headers_con_token

PERMISOS = ["personas.ver", "personas.editar", "personas.crear"]


def _cargar_script():
    ruta = Path(__file__).resolve().parents[2] / "scripts" / "migrar_membresias.py"
    spec = importlib.util.spec_from_file_location("migrar_membresias", ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _d(texto: str) -> date:
    return date.fromisoformat(texto)


async def _membresia(app, persona, desde, hasta=None, **extra) -> Membresia:
    return await Membresia(
        aplicacion_id=app.codigo,
        persona_id=str(persona.id),
        squad_id=app.codigo,
        desde=a_datetime(_d(desde)),
        hasta=a_datetime(_d(hasta)) if hasta else None,
        activo=hasta is None,
        **extra,
    ).insert()


async def _alejandro(fabrica_aplicacion, fabrica_usuario):
    """Alejandro: CRM y .NET desde julio; CRM cerrado el 15-sep; .NET abierto."""
    sufijo = uuid.uuid4().hex[:6]  # los nombres de squad se resuelven por nombre: únicos
    crm = await fabrica_aplicacion(f"CRM-{sufijo}")
    net = await fabrica_aplicacion(f".NET-{sufijo}")
    _, token = await fabrica_usuario([crm.codigo, net.codigo], permisos=PERMISOS)
    persona = await Persona(
        aplicacion_id=crm.codigo, nombre="Alejandro Castro Agudelo", squads=[crm.nombre, net.nombre]
    ).insert()
    m_crm = await _membresia(
        crm, persona, "2026-07-01", "2026-09-15",
        fecha_efecto_desactivacion=a_datetime(_d("2026-09-15")),
    )
    m_net = await _membresia(net, persona, "2026-07-01")
    return crm, net, token, persona, m_crm, m_net


def _ctx(*apps) -> ContextoAplicacion:
    codigos = [a.codigo for a in apps]
    return ContextoAplicacion(codigos, modo_consolidado=len(codigos) > 1)


async def test_caso_alejandro_vigencia_mensual(fabrica_aplicacion, fabrica_usuario):
    crm, net, _, persona, _, _ = await _alejandro(fabrica_aplicacion, fabrica_usuario)
    pid, ctx = str(persona.id), _ctx(crm, net)
    # CRM: cuenta en julio, agosto y septiembre (vigente del 1 al 14); no en octubre.
    assert await vigente(ctx, pid, crm.codigo, "2026-07")
    assert await vigente(ctx, pid, crm.codigo, "2026-09")
    assert not await vigente(ctx, pid, crm.codigo, "2026-10")
    assert not await vigente(ctx, pid, crm.codigo, "2026-06")
    # .NET sigue vigente y por rango de fechas
    assert await vigente(ctx, pid, net.codigo, "2026-10")
    assert await vigente(ctx, pid, crm.codigo, (_d("2026-09-14"), _d("2026-09-30")))
    assert not await vigente(ctx, pid, crm.codigo, (_d("2026-09-15"), _d("2026-09-30")))
    lote = await squads_vigentes(ctx, "2026-06", "2026-10")
    assert set(lote[pid]) == {"2026-07", "2026-08", "2026-09", "2026-10"}
    assert sorted(lote[pid]["2026-09"]) == sorted([crm.codigo, net.codigo])
    assert lote[pid]["2026-10"] == [net.codigo]


async def test_vigencia_endpoint_filtra_por_aplicacion(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    crm, net, token, persona, _, _ = await _alejandro(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, crm.codigo)
    resp = await cliente.get("/api/membresias/vigencias?desde=2026-09&hasta=2026-10", headers=h)
    assert resp.status_code == 200
    mapa = resp.json()[str(persona.id)]
    # Con X-Aplicacion=CRM solo se ve el squad CRM (la membresía de .NET no se filtra)
    assert mapa == {"2026-09": [crm.codigo]}
    assert (await cliente.get(
        "/api/membresias/vigencias?desde=2026-10&hasta=2026-09", headers=h)).status_code == 422


async def test_cerrar_squad_no_desactiva_a_la_persona(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    crm, net, token, persona, _, m_net = await _alejandro(fabrica_aplicacion, fabrica_usuario)
    # Reabrir CRM requiere una membresía nueva; aquí cerramos .NET (queda CRM cerrado => último)
    h = headers_con_token(token, net.codigo)
    resp = await cliente.patch(
        f"/api/membresias/{m_net.id}/cerrar", json={"fecha_efecto": "2026-10-20"}, headers=h
    )
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["ultimo_squad"] is True
    assert cuerpo["membresia"]["activo"] is False
    assert cuerpo["membresia"]["hasta"].startswith("2026-10-20")
    assert cuerpo["membresia"]["fecha_desactivacion"] is not None  # registro
    recargada = await Persona.get(persona.id)
    assert recargada.activo is True
    assert (await cliente.patch(
        f"/api/membresias/{m_net.id}/cerrar", json={}, headers=h)).status_code == 409


async def test_cerrar_con_otro_squad_abierto_no_es_ultimo(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    crm, net, token, persona, _, m_net = await _alejandro(fabrica_aplicacion, fabrica_usuario)
    otro = await fabrica_aplicacion(f"Otro-{uuid.uuid4().hex[:6]}")
    _, token2 = await fabrica_usuario([crm.codigo, net.codigo, otro.codigo], permisos=PERMISOS)
    h = headers_con_token(token2, net.codigo)
    alta = await cliente.post(
        f"/api/membresias/persona/{persona.id}",
        json={"squad_id": otro.codigo, "desde": "2026-08-01"}, headers=h,
    )
    assert alta.status_code == 201
    resp = await cliente.patch(
        f"/api/membresias/{m_net.id}/cerrar", json={"fecha_efecto": "2026-10-01"}, headers=h
    )
    assert resp.json()["ultimo_squad"] is False
    # El derivado refleja los squads vigentes hoy (CRM ya cerrado, .NET cerrado)
    assert (await Persona.get(persona.id)).squads == [otro.nombre]


async def test_reabrir_es_membresia_nueva_y_valida_solape(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    crm, net, token, persona, m_crm, _ = await _alejandro(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, crm.codigo)
    url = f"/api/membresias/persona/{persona.id}"
    solapada = await cliente.post(
        url, json={"squad_id": crm.codigo, "desde": "2026-09-01"}, headers=h
    )
    assert solapada.status_code == 409
    nueva = await cliente.post(
        url, json={"squad_id": crm.codigo, "desde": "2026-11-01"}, headers=h
    )
    assert nueva.status_code == 201
    assert nueva.json()["_id"] != str(m_crm.id)
    total = await Membresia.find({"persona_id": str(persona.id), "squad_id": crm.codigo}).count()
    assert total == 2


async def test_fuga_entre_aplicaciones(cliente, fabrica_aplicacion, fabrica_usuario):
    crm, net, _, persona, m_crm, m_net = await _alejandro(fabrica_aplicacion, fabrica_usuario)
    # Usuario que solo tiene acceso a CRM
    _, token = await fabrica_usuario([crm.codigo], permisos=PERMISOS)
    h = headers_con_token(token, crm.codigo)
    listado = await cliente.get(f"/api/membresias/persona/{persona.id}", headers=h)
    assert listado.status_code == 200
    assert [m["aplicacion_id"] for m in listado.json()] == [crm.codigo]
    # No puede cerrar la membresía de .NET (404) ni abrir una en .NET (403)
    cierre = await cliente.patch(
        f"/api/membresias/{m_net.id}/cerrar", json={"fecha_efecto": "2026-10-20"}, headers=h
    )
    assert cierre.status_code == 404
    assert (await Membresia.get(m_net.id)).activo is True
    alta = await cliente.post(
        f"/api/membresias/persona/{persona.id}",
        json={"squad_id": net.codigo, "desde": "2026-11-01"}, headers=h,
    )
    assert alta.status_code == 403
    # Sin permiso de edición tampoco puede escribir en su propia aplicación
    _, solo_ver = await fabrica_usuario([crm.codigo], permisos=["personas.ver"])
    sv = headers_con_token(solo_ver, crm.codigo)
    assert (await cliente.patch(
        f"/api/membresias/{m_crm.id}/cerrar", json={}, headers=sv)).status_code == 403


async def test_desactivar_persona_cierra_en_cascada_y_propaga_fecha(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    crm, net, token, persona, m_crm, m_net = await _alejandro(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, crm.codigo)
    resp = await cliente.put(
        f"/api/personas/{persona.id}",
        json={
            "nombre": persona.nombre, "activo": False,
            "fecha_efecto_desactivacion": "2026-10-10",
        },
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["fecha_efecto_desactivacion"].startswith("2026-10-10")
    assert cuerpo["fecha_desactivacion"] is not None  # registro con ahora()
    net_cerrada = await Membresia.get(m_net.id)
    crm_previa = await Membresia.get(m_crm.id)
    assert net_cerrada.cerrada_por_cascada is True and net_cerrada.activo is False
    assert a_fecha_logica(net_cerrada.hasta) == _d("2026-10-10")
    assert crm_previa.cerrada_por_cascada is False  # ya estaba cerrada por separado
    assert a_fecha_logica(crm_previa.hasta) == _d("2026-09-15")
    # Editar después la fecha de efecto solo afecta a las cerradas por cascada
    resp = await cliente.put(
        f"/api/personas/{persona.id}",
        json={
            "nombre": persona.nombre, "activo": False,
            "fecha_efecto_desactivacion": "2026-10-05",
        },
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    assert a_fecha_logica((await Membresia.get(m_net.id)).hasta) == _d("2026-10-05")
    assert a_fecha_logica((await Membresia.get(m_crm.id)).hasta) == _d("2026-09-15")
    # Reactivar no reabre y limpia ambas fechas
    resp = await cliente.put(
        f"/api/personas/{persona.id}", json={"nombre": persona.nombre, "activo": True}, headers=h
    )
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["fecha_desactivacion"] is None
    assert cuerpo["fecha_efecto_desactivacion"] is None
    assert (await Membresia.get(m_net.id)).activo is False
    assert await Membresia.find({"persona_id": str(persona.id), "activo": True}).count() == 0


async def test_desactivar_persona_sin_fecha_usa_hoy(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    from app.services.vigencia import hoy_bogota

    crm, _, token, persona, _, m_net = await _alejandro(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, crm.codigo)
    resp = await cliente.put(
        f"/api/personas/{persona.id}", json={"nombre": persona.nombre, "activo": False}, headers=h
    )
    assert resp.status_code == 200
    assert a_fecha_logica((await Membresia.get(m_net.id)).hasta) == hoy_bogota()


async def test_squads_en_put_no_muda_la_aplicacion(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    crm, net, token, persona, _, _ = await _alejandro(fabrica_aplicacion, fabrica_usuario)
    h = headers_con_token(token, crm.codigo)
    resp = await cliente.put(
        f"/api/personas/{persona.id}",
        json={"nombre": persona.nombre, "squads": [net.nombre, "Subequipo legado"]},
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["aplicacion_id"] == crm.codigo  # ya no depende de squads[0]
    assert "aplicacion_movida" not in cuerpo
    assert net.nombre in cuerpo["squads"]


async def test_migracion_idempotente_y_dry_run(fabrica_aplicacion):
    ruta = Path(__file__).resolve().parents[2] / "scripts" / "migrar_membresias.py"
    spec = importlib.util.spec_from_file_location("migrar_membresias", ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)

    crm, net = await fabrica_aplicacion(f"CRM-{uuid.uuid4().hex[:6]}"), await fabrica_aplicacion(
        f"NET-{uuid.uuid4().hex[:6]}"
    )
    activa = await Persona(
        aplicacion_id=crm.codigo, nombre="Activa", squads=[crm.nombre, net.nombre, "Fantasma"]
    ).insert()
    inactiva = await Persona(
        aplicacion_id=crm.codigo, nombre="Inactiva", squads=[crm.nombre], activo=False,
        fecha_desactivacion=datetime(2026, 9, 15, 17, 0, tzinfo=UTC),  # 12:00 en Bogotá
    ).insert()

    en_seco = await modulo.migrar(dry_run=True)
    assert en_seco["creadas"] >= 3
    assert await Membresia.find({"persona_id": str(activa.id)}).count() == 0
    assert ("Activa", "Fantasma") in en_seco["sin_resolver"]

    await modulo.migrar(dry_run=False)
    segunda = await modulo.migrar(dry_run=False)
    assert segunda["creadas"] == 0
    assert await Membresia.find({"persona_id": str(activa.id)}).count() == 2
    m = await Membresia.find_one({"persona_id": str(inactiva.id)})
    assert m.activo is False and m.cerrada_por_cascada is True
    assert a_fecha_logica(m.hasta) == _d("2026-09-15")
    efecto = (await Persona.get(inactiva.id)).fecha_efecto_desactivacion
    assert a_fecha_logica(efecto) == _d("2026-09-15")
