# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Reglas del router de requerimientos: máquina de estados, squad, personas,
concurrencia optimista, bitácora sin falsos cambios, entregas, paginación y
ambigüedad de ``codigo_req``."""
import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.documents.bitacora import Bitacora
from app.documents.persona import Persona
from app.documents.requerimiento import Entrega, Requerimiento, Solicitud
from tests.conftest import headers_con_token

PERMISOS = ["requerimientos.ver", "requerimientos.crear", "requerimientos.editar"]
ESTADO_INICIAL = "ESTIMACION EN CURSO POR HITSS"


@pytest.fixture
async def entorno(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=PERMISOS)
    return app, headers_con_token(token, app.codigo)


async def _persona(app_codigo: str, rol: str, activo: bool = True) -> Persona:
    return await Persona(
        aplicacion_id=app_codigo, nombre=f"P-{uuid.uuid4().hex[:6]}", rol_operativo=rol,
        activo=activo,
    ).insert()


async def _req(app_codigo: str, codigo_req: str = "REQ-1", sc: str = "SC-1", **extra):
    solicitud = extra.pop("solicitud", None) or Solicitud(codigo_sc=sc, squad_id=app_codigo)
    datos = {"estado": ESTADO_INICIAL, "total_horas_estimadas": Decimal("100")}
    datos.update(extra)
    return await Requerimiento(
        aplicacion_id=app_codigo, codigo_req=codigo_req, solicitud=solicitud, **datos
    ).insert()


def _cuerpo_crear(app_codigo: str, **extra) -> dict:
    cuerpo = {
        "codigo_req": f"REQ-{uuid.uuid4().hex[:6]}",
        "solicitud": {"codigo_sc": "SC-1", "squad_id": app_codigo},
        "estado": ESTADO_INICIAL,
    }
    cuerpo.update(extra)
    return cuerpo


# --- Crear -----------------------------------------------------------------------


async def test_crear_ok_y_recorta_codigos(cliente, entorno):
    app, h = entorno
    cuerpo = _cuerpo_crear(app.codigo, codigo_req="  REQ-ESP  ")
    cuerpo["solicitud"]["codigo_sc"] = " SC-ESP "
    resp = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert resp.status_code == 201
    assert resp.json()["codigo_req"] == "REQ-ESP"
    assert resp.json()["solicitud"]["codigo_sc"] == "SC-ESP"


@pytest.mark.parametrize("campo", ["codigo_req", "codigo_sc"])
async def test_crear_rechaza_codigos_vacios(cliente, entorno, campo):
    app, h = entorno
    cuerpo = _cuerpo_crear(app.codigo)
    if campo == "codigo_req":
        cuerpo["codigo_req"] = "   "
    else:
        cuerpo["solicitud"]["codigo_sc"] = ""
    resp = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert resp.status_code == 422


@pytest.mark.parametrize("campo", ["total_horas_estimadas", "monto_pactado"])
@pytest.mark.parametrize("valor", [-1, "NaN", "Infinity"])
async def test_crear_rechaza_numeros_invalidos(cliente, entorno, campo, valor):
    app, h = entorno
    resp = await cliente.post(
        "/api/requerimientos", json=_cuerpo_crear(app.codigo, **{campo: valor}), headers=h
    )
    assert resp.status_code == 422


async def test_crear_squad_de_otra_aplicacion_da_422(cliente, entorno):
    app, h = entorno
    cuerpo = _cuerpo_crear(app.codigo)
    cuerpo["solicitud"]["squad_id"] = "otro-squad"
    resp = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert resp.status_code == 422
    assert "reasignar-aplicacion" in resp.json()["detail"]


@pytest.mark.parametrize("vacio", [None, ""])
async def test_crear_squad_vacio_queda_con_el_de_la_aplicacion(cliente, entorno, vacio):
    # Regla squad == aplicación: un squad vacío se completa con el de la app activa
    # (antes quedaba vacío; el test se ajustó a la nueva regla M1).
    app, h = entorno
    cuerpo = _cuerpo_crear(app.codigo)
    cuerpo["solicitud"]["squad_id"] = vacio
    resp = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert resp.status_code == 201
    assert resp.json()["solicitud"]["squad_id"] == app.codigo


async def test_crear_no_valida_transicion_de_estado(cliente, entorno):
    app, h = entorno
    resp = await cliente.post(
        "/api/requerimientos",
        json=_cuerpo_crear(app.codigo, estado="REQUERIMIENTO CANCELADO"),
        headers=h,
    )
    assert resp.status_code == 201


@pytest.mark.parametrize(
    ("campo", "rol_correcto", "rol_incorrecto"),
    [
        ("lt_hitss_id", "LT_HITSS", "LT_EPM"),
        ("lt_epm_id", "LT_EPM", "LT_HITSS"),
        ("scrum_id", "SCRUM", "DEV"),
        ("analista_requerimientos_id", "AR/QA", "DEV"),
    ],
)
async def test_crear_valida_rol_de_personas(
    cliente, entorno, campo, rol_correcto, rol_incorrecto
):
    app, h = entorno
    mala = await _persona(app.codigo, rol_incorrecto)
    cuerpo = _cuerpo_crear(app.codigo)
    cuerpo["solicitud"][campo] = str(mala.id)
    resp = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert resp.status_code == 422
    assert rol_incorrecto in resp.json()["detail"]

    buena = await _persona(app.codigo, rol_correcto)
    cuerpo["solicitud"][campo] = str(buena.id)
    resp = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert resp.status_code == 201


async def test_crear_analista_acepta_scrum(cliente, entorno):
    app, h = entorno
    scrum = await _persona(app.codigo, "SCRUM")
    cuerpo = _cuerpo_crear(app.codigo)
    cuerpo["solicitud"]["analista_requerimientos_id"] = str(scrum.id)
    resp = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert resp.status_code == 201


async def test_crear_persona_inactiva_inexistente_o_de_otra_app_da_422(
    cliente, entorno, fabrica_aplicacion
):
    app, h = entorno
    inactiva = await _persona(app.codigo, "LT_HITSS", activo=False)
    otra_app = await fabrica_aplicacion()
    ajena = await _persona(otra_app.codigo, "LT_HITSS")
    for pid in (str(inactiva.id), "no-es-un-id", "a" * 24, str(ajena.id)):
        cuerpo = _cuerpo_crear(app.codigo)
        cuerpo["solicitud"]["lt_hitss_id"] = pid
        resp = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
        assert resp.status_code == 422, pid


async def test_crear_duplicado_da_409(cliente, entorno):
    app, h = entorno
    cuerpo = _cuerpo_crear(app.codigo)
    assert (await cliente.post("/api/requerimientos", json=cuerpo, headers=h)).status_code == 201
    resp = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert resp.status_code == 409


# --- Transiciones --------------------------------------------------------------


async def test_listar_transiciones(cliente, entorno):
    _, h = entorno
    resp = await cliente.get("/api/requerimientos/transiciones", headers=h)
    assert resp.status_code == 200
    mapa = resp.json()
    assert "ESTIMACION EN ESPERA DE APROBACION POR EPM" in mapa[ESTADO_INICIAL]
    assert mapa["REQUERIMIENTO CANCELADO"] == []


async def test_transiciones_exige_permiso_ver(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=[])
    resp = await cliente.get(
        "/api/requerimientos/transiciones", headers=headers_con_token(token, app.codigo)
    )
    assert resp.status_code == 403


async def test_transicion_post_permitida_y_no_permitida(cliente, entorno):
    app, h = entorno
    req = await _req(app.codigo)
    url = f"/api/requerimientos/{req.id}/transicion"
    malo = await cliente.post(url, json={"nuevo_estado": "ENTREGA CARGADA"}, headers=h)
    assert malo.status_code == 409
    assert "no permitida" in malo.json()["detail"]
    assert (await Requerimiento.get(req.id)).estado == ESTADO_INICIAL

    bueno = await cliente.post(
        url, json={"nuevo_estado": "ESTIMACION EN ESPERA DE APROBACION POR EPM"}, headers=h
    )
    assert bueno.status_code == 200
    assert bueno.json()["estado"] == "ESTIMACION EN ESPERA DE APROBACION POR EPM"


async def test_transicion_estado_fuera_del_enum_se_permite(cliente, entorno):
    app, h = entorno
    personalizado = await _req(app.codigo, "REQ-P", estado="ABIERTO")
    resp = await cliente.post(
        f"/api/requerimientos/{personalizado.id}/transicion",
        json={"nuevo_estado": "ENTREGA CARGADA"},
        headers=h,
    )
    assert resp.status_code == 200
    resp = await cliente.post(
        f"/api/requerimientos/{personalizado.id}/transicion",
        json={"nuevo_estado": "OTRO ESTADO CONFIGURADO"},
        headers=h,
    )
    assert resp.status_code == 200


async def test_put_valida_transicion_de_estado(cliente, entorno):
    app, h = entorno
    req = await _req(app.codigo)
    url = f"/api/requerimientos/{req.id}"
    malo = await cliente.put(url, json={"estado": "ENTREGA CARGADA"}, headers=h)
    assert malo.status_code == 409
    # Reenviar el mismo estado no es una transición.
    igual = await cliente.put(url, json={"estado": ESTADO_INICIAL}, headers=h)
    assert igual.status_code == 200
    bueno = await cliente.put(
        url, json={"estado": "REQUERIMIENTO DEVUELTO A EPM"}, headers=h
    )
    assert bueno.status_code == 200


# --- Actualizar ------------------------------------------------------------------


async def test_put_solicitud_conserva_campos_no_enviados(cliente, entorno):
    app, h = entorno
    sol = Solicitud(
        codigo_sc="SC-1", squad_id=app.codigo, tarifa_id="tar-1", anio_tarifa=2026,
        aplicativo_id="apl-1",
    )
    req = await _req(app.codigo, solicitud=sol)
    resp = await cliente.put(
        f"/api/requerimientos/{req.id}",
        json={"solicitud": {"codigo_sc": "SC-1", "tecnologia": "Java"}},
        headers=h,
    )
    assert resp.status_code == 200
    guardada = (await Requerimiento.get(req.id)).solicitud
    assert guardada.tecnologia == "Java"
    assert (guardada.tarifa_id, guardada.anio_tarifa, guardada.aplicativo_id) == (
        "tar-1", 2026, "apl-1",
    )
    assert guardada.squad_id == app.codigo


async def test_put_solicitud_sin_cambiar_squad_no_lo_revalida(cliente, entorno):
    app, h = entorno
    # Dato histórico con squad distinto de la aplicación: se tolera mientras no cambie.
    req = await _req(
        app.codigo, solicitud=Solicitud(codigo_sc="SC-1", squad_id="squad-historico")
    )
    resp = await cliente.put(
        f"/api/requerimientos/{req.id}",
        json={"solicitud": {"codigo_sc": "SC-1", "squad_id": "squad-historico"}},
        headers=h,
    )
    assert resp.status_code == 200


async def test_put_cambiar_squad_a_otro_da_422(cliente, entorno):
    app, h = entorno
    req = await _req(app.codigo)
    resp = await cliente.put(
        f"/api/requerimientos/{req.id}",
        json={"solicitud": {"codigo_sc": "SC-1", "squad_id": "otro"}},
        headers=h,
    )
    assert resp.status_code == 422


async def test_put_valida_persona_solo_si_cambia(cliente, entorno):
    app, h = entorno
    lt = await _persona(app.codigo, "LT_HITSS")
    req = await _req(
        app.codigo,
        solicitud=Solicitud(codigo_sc="SC-1", squad_id=app.codigo, lt_hitss_id=str(lt.id)),
    )
    lt.activo = False
    await lt.save()
    url = f"/api/requerimientos/{req.id}"
    # Mismo id (aunque ya inactivo): no se revalida.
    ok = await cliente.put(
        url, json={"solicitud": {"codigo_sc": "SC-1", "lt_hitss_id": str(lt.id)}}, headers=h
    )
    assert ok.status_code == 200
    # Otro id con rol incorrecto: 422.
    dev = await _persona(app.codigo, "DEV")
    mal = await cliente.put(
        url, json={"solicitud": {"codigo_sc": "SC-1", "lt_hitss_id": str(dev.id)}}, headers=h
    )
    assert mal.status_code == 422


async def test_patch_analista_valida_rol(cliente, entorno):
    app, h = entorno
    req = await _req(app.codigo)
    url = f"/api/requerimientos/{req.id}/analista"
    dev = await _persona(app.codigo, "DEV")
    mal = await cliente.patch(url, json={"analista_requerimientos_id": str(dev.id)}, headers=h)
    assert mal.status_code == 422
    ar = await _persona(app.codigo, "AR/QA")
    bien = await cliente.patch(url, json={"analista_requerimientos_id": str(ar.id)}, headers=h)
    assert bien.status_code == 200
    quitar = await cliente.patch(url, json={"analista_requerimientos_id": None}, headers=h)
    assert quitar.status_code == 200


async def test_put_duplicado_da_409(cliente, entorno):
    app, h = entorno
    await _req(app.codigo, "REQ-D", "SC-1")
    otro = await _req(app.codigo, "REQ-D", "SC-2")
    resp = await cliente.put(
        f"/api/requerimientos/{otro.id}",
        json={"solicitud": {"codigo_sc": "SC-1"}},
        headers=h,
    )
    assert resp.status_code == 409
    assert "Código REQ, Squad y SC" in resp.json()["detail"]


async def test_put_ignora_cantidad_entregas(cliente, entorno):
    app, h = entorno
    req = await _req(app.codigo)
    resp = await cliente.put(
        f"/api/requerimientos/{req.id}", json={"cantidad_entregas": 99}, headers=h
    )
    assert resp.status_code == 200
    assert (await Requerimiento.get(req.id)).cantidad_entregas == 0


async def test_put_rechaza_numeros_invalidos(cliente, entorno):
    app, h = entorno
    req = await _req(app.codigo)
    for cuerpo in ({"total_horas_estimadas": -5}, {"monto_pactado": "NaN"}):
        resp = await cliente.put(f"/api/requerimientos/{req.id}", json=cuerpo, headers=h)
        assert resp.status_code == 422


async def test_put_bitacora_no_registra_falsos_cambios(cliente, entorno):
    app, h = entorno
    req = await _req(
        app.codigo,
        fecha_inicio=datetime(2026, 1, 1, tzinfo=UTC),
        monto_pactado=Decimal("10"),
        nombre="Acta",
    )
    resp = await cliente.put(
        f"/api/requerimientos/{req.id}",
        json={
            "fecha_inicio": "2026-01-01T00:00:00+00:00",  # mismo instante, con zona
            "monto_pactado": "10.00",  # mismo valor numérico
            "nombre": "Acta",
        },
        headers=h,
    )
    assert resp.status_code == 200
    registro = await Bitacora.find_one(
        Bitacora.entidad_id == str(req.id), Bitacora.accion == "actualizar"
    )
    assert registro is not None
    assert registro.descripcion == f"Requerimiento {req.codigo_req} actualizado"

    # Un cambio real sí se registra.
    await cliente.put(f"/api/requerimientos/{req.id}", json={"nombre": "Otra"}, headers=h)
    registros = await Bitacora.find(
        Bitacora.entidad_id == str(req.id), Bitacora.accion == "actualizar"
    ).to_list()
    assert any("Nombre de acta" in r.descripcion for r in registros)


# --- Concurrencia optimista ---------------------------------------------------------


async def test_put_con_actualizado_en_vigente_pasa_y_obsoleto_da_409(cliente, entorno):
    app, h = entorno
    req = await _req(app.codigo)
    url = f"/api/requerimientos/{req.id}"
    leido = (await cliente.get(url, headers=h)).json()["actualizado_en"]

    primero = await cliente.put(url, json={"nombre": "A", "actualizado_en": leido}, headers=h)
    assert primero.status_code == 200
    assert primero.json()["actualizado_en"] != leido

    segundo = await cliente.put(url, json={"nombre": "B", "actualizado_en": leido}, headers=h)
    assert segundo.status_code == 409
    assert "recarga" in segundo.json()["detail"]
    assert (await Requerimiento.get(req.id)).nombre == "A"

    # Con el valor devuelto por el servidor, la siguiente edición pasa.
    vigente = primero.json()["actualizado_en"]
    tercero = await cliente.put(url, json={"nombre": "C", "actualizado_en": vigente}, headers=h)
    assert tercero.status_code == 200


async def test_put_sin_actualizado_en_mantiene_compatibilidad(cliente, entorno):
    app, h = entorno
    req = await _req(app.codigo)
    resp = await cliente.put(f"/api/requerimientos/{req.id}", json={"nombre": "X"}, headers=h)
    assert resp.status_code == 200
    assert "actualizado_en" in resp.json()


# --- Entregas --------------------------------------------------------------------


async def test_guardar_entrega_conserva_campos_ans_al_reemplazar(cliente, entorno):
    app, h = entorno
    req = await _req(
        app.codigo,
        entregas=[
            Entrega(
                numero=1, horas=Decimal("10"), fecha_comprometida=datetime(2026, 1, 1),
                se_levanto_ans=True, observaciones_ans="Se levantó por X",
            )
        ],
        cantidad_entregas=1,
    )
    resp = await cliente.post(
        f"/api/requerimientos/{req.id}/entregas",
        json={"numero": 1, "horas": 20, "fecha_comprometida": "2026-02-01T00:00:00"},
        headers=h,
    )
    assert resp.status_code == 200
    entrega = resp.json()["entregas"][0]
    assert entrega["horas"] == 20
    assert entrega["se_levanto_ans"] is True
    assert entrega["observaciones_ans"] == "Se levantó por X"


async def test_guardar_entrega_nueva_no_hereda_campos_ans(cliente, entorno):
    app, h = entorno
    req = await _req(app.codigo)
    resp = await cliente.post(
        f"/api/requerimientos/{req.id}/entregas",
        json={"numero": 1, "fecha_comprometida": "2026-02-01T00:00:00"},
        headers=h,
    )
    assert resp.status_code == 200
    entrega = resp.json()["entregas"][0]
    assert entrega["se_levanto_ans"] is None
    assert resp.json()["cantidad_entregas"] == 1


# --- Listado: paginación y resumen --------------------------------------------------


async def test_listar_sin_parametros_devuelve_lista_completa_sin_cabecera(cliente, entorno):
    app, h = entorno
    for i in range(3):
        await _req(app.codigo, f"REQ-L{i}", entregas=[
            Entrega(numero=1, fecha_comprometida=datetime(2026, 1, 1))
        ], cantidad_entregas=1)
    resp = await cliente.get("/api/requerimientos", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) == 3
    assert "x-total-count" not in resp.headers
    assert all("entregas" in r and r["entregas"] for r in resp.json())


async def test_listar_paginado_con_total(cliente, entorno):
    app, h = entorno
    for i in range(5):
        await _req(app.codigo, f"REQ-P{i}")
    pagina1 = await cliente.get("/api/requerimientos?limite=2", headers=h)
    pagina2 = await cliente.get("/api/requerimientos?limite=2&desde=2", headers=h)
    resto = await cliente.get("/api/requerimientos?desde=4", headers=h)
    assert pagina1.headers["x-total-count"] == "5"
    ids = [r["_id"] for r in pagina1.json() + pagina2.json() + resto.json()]
    assert len(ids) == 5 and len(set(ids)) == 5
    assert len(pagina1.json()) == 2 and len(pagina2.json()) == 2 and len(resto.json()) == 1


async def test_listar_limites_invalidos(cliente, entorno):
    _, h = entorno
    for q in ("limite=0", "limite=501", "desde=-1"):
        assert (await cliente.get(f"/api/requerimientos?{q}", headers=h)).status_code == 422


async def test_listar_resumen_omite_entregas(cliente, entorno):
    app, h = entorno
    await _req(
        app.codigo,
        entregas=[Entrega(numero=1, fecha_comprometida=datetime(2026, 1, 1))],
        cantidad_entregas=1,
    )
    resp = await cliente.get("/api/requerimientos?resumen=true", headers=h)
    item = resp.json()[0]
    assert "entregas" not in item
    assert item["cantidad_entregas"] == 1


async def test_listar_paginado_respeta_aislamiento(cliente, entorno, fabrica_aplicacion):
    app, h = entorno
    otra = await fabrica_aplicacion()
    await _req(app.codigo, "REQ-MIO")
    await _req(otra.codigo, "REQ-AJENO")
    resp = await cliente.get("/api/requerimientos?limite=10", headers=h)
    assert resp.headers["x-total-count"] == "1"
    assert [r["codigo_req"] for r in resp.json()] == ["REQ-MIO"]


# --- Ambigüedad de codigo_req ----------------------------------------------------


async def test_codigo_req_ambiguo_da_409_y_el_id_resuelve(cliente, entorno):
    app, h = entorno
    a = await _req(app.codigo, "REQ-DUP", "SC-1")
    await _req(app.codigo, "REQ-DUP", "SC-2")
    unico = await _req(app.codigo, "REQ-UNICO", "SC-1")

    ambiguo = await cliente.get("/api/requerimientos/REQ-DUP", headers=h)
    assert ambiguo.status_code == 409
    assert "ambiguo" in ambiguo.json()["detail"]

    por_id = await cliente.get(f"/api/requerimientos/{a.id}", headers=h)
    assert por_id.status_code == 200
    por_codigo = await cliente.get("/api/requerimientos/REQ-UNICO", headers=h)
    assert por_codigo.json()["_id"] == str(unico.id)
    assert (await cliente.get("/api/requerimientos/NO-EXISTE", headers=h)).status_code == 404
