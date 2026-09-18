# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests del espejo sincronizado de esquema de Azure DevOps."""
from datetime import UTC, datetime, timedelta

import pytest_asyncio

from app.documents.azdo import AzdoEsquemaItem, AzdoEsquemaSyncLog
from app.documents.azdo_config import AzdoConfig
from app.services import azdo_esquema_sync
from app.services.azdo_esquema_sync import (
    _ContadorParticiones,
    ejecutar_sincronizacion_esquema,
    preparar_corrida,
)
from app.services.azure_devops import AzureDevOpsService, normalizar_org_key
from tests.conftest import CONSOLIDADO, headers_con_token

ORG_URL = "https://dev.azure.com/HitssColombia"
ORG_KEY = normalizar_org_key(ORG_URL)
PROYECTO = "Proyecto"
RUTA_CRM = "Proyecto\\CRM"


@pytest_asyncio.fixture(autouse=True)
async def _limpiar_espejo():
    """El espejo y sus logs no llevan ``aplicacion_id``, así que comparten clave
    entre tests; se limpian antes de cada uno para aislarlos."""
    await AzdoEsquemaItem.delete_all()
    await AzdoEsquemaSyncLog.delete_all()
    yield


def _nodo(azdo_id, tipo, titulo, parent_id=None, iteration_path=RUTA_CRM, estado="Active"):
    return {
        "azdo_id": azdo_id,
        "tipo": tipo,
        "titulo": titulo,
        "estado": estado,
        "asignado_a": None,
        "original_estimate": 0,
        "completed_work": 0,
        "remaining_work": 0,
        "iteration_path": iteration_path,
        "area_path": "Proyecto",
        "tags": "",
        "url": f"https://example.test/{azdo_id}",
        "parent_id": parent_id,
        "contexto": False,
    }


# ── Normalización de org_key ──

def test_normalizar_org_key_ignora_mayusculas_y_barra_final():
    assert normalizar_org_key("https://dev.azure.com/HitssColombia") == (
        normalizar_org_key("https://dev.azure.com/hitsscolombia/")
    )
    assert normalizar_org_key("https://dev.azure.com/HitssColombia") == (
        "https://dev.azure.com/hitsscolombia"
    )


# ── Particionado por rango de id ante VS402337 ──

async def test_particionado_por_rango_converge_y_recoge_todo(monkeypatch):
    """El servicio falla con VS402337 mientras el rango es ancho y responde al
    estrecharse; se recogen todos los ítems sin superar el tope de particiones."""
    svc = AzureDevOpsService(ORG_URL, "pat")
    universo = list(range(1, 61))  # 60 ids repartidos en [1, 100]
    ancho_maximo = 30
    llamadas = {"total": 0}

    async def _ids(self, cliente, proyecto, tipos, id_min=None, id_max=None):
        llamadas["total"] += 1
        if id_min is None or id_max is None:
            raise RuntimeError("Azure DevOps API 400: VS402337: exceeds size limit")
        if (id_max - id_min) > ancho_maximo:
            raise RuntimeError("Azure DevOps API 400: VS402337: exceeds size limit")
        return [i for i in universo if id_min <= i <= id_max]

    async def _max(self, cliente, proyecto, tipos):
        return 100

    monkeypatch.setattr(AzureDevOpsService, "obtener_ids_esquema", _ids)
    monkeypatch.setattr(AzureDevOpsService, "obtener_id_maximo_esquema", _max)

    contador = _ContadorParticiones(tope=400)
    ids = await azdo_esquema_sync._recolectar_ids_tipo(
        svc, None, PROYECTO, "Task", contador
    )

    assert sorted(ids) == universo
    assert contador.total < 400
    assert llamadas["total"] == contador.total


async def test_particionado_respeta_tope_de_particiones(monkeypatch):
    svc = AzureDevOpsService(ORG_URL, "pat")

    async def _ids_siempre_falla(self, cliente, proyecto, tipos, id_min=None, id_max=None):
        raise RuntimeError("Azure DevOps API 400: VS402337: exceeds size limit")

    async def _max(self, cliente, proyecto, tipos):
        return 10_000_000

    monkeypatch.setattr(AzureDevOpsService, "obtener_ids_esquema", _ids_siempre_falla)
    monkeypatch.setattr(AzureDevOpsService, "obtener_id_maximo_esquema", _max)

    contador = _ContadorParticiones(tope=50)
    try:
        await azdo_esquema_sync._recolectar_ids_tipo(svc, None, PROYECTO, "Task", contador)
        raise AssertionError("Debió abortar por tope de particiones o profundidad")
    except RuntimeError as exc:
        assert "tope" in str(exc) or "acotar" in str(exc)


# ── Purga condicionada al éxito de la corrida ──

async def _sync_con_servicio(monkeypatch, ids_por_tipo, tipos, fallar_tipo=None):
    async def _ids(self, cliente, proyecto, tipos_arg, id_min=None, id_max=None):
        tipo = tipos_arg[0]
        if fallar_tipo is not None and tipo == fallar_tipo:
            raise RuntimeError("Azure DevOps API 500: boom")
        return list(ids_por_tipo.get(tipo, []))

    async def _lote(self, cliente, proyecto, ids):
        return [_nodo(i, "Task", f"WI {i}") for i in ids]

    monkeypatch.setattr(AzureDevOpsService, "obtener_ids_esquema", _ids)
    monkeypatch.setattr(AzureDevOpsService, "obtener_lote_esquema", _lote)

    log = await AzdoEsquemaSyncLog(
        target="hitss",
        org_key=ORG_KEY,
        proyecto=PROYECTO,
        estado="en_curso",
        particiones_totales=len(tipos),
        iniciado_en=datetime.now(UTC),
    ).insert()
    await ejecutar_sincronizacion_esquema(
        log.id, ORG_URL, "pat", "hitss", PROYECTO, tipos
    )
    return await AzdoEsquemaSyncLog.get(log.id)


async def test_corrida_limpia_purga_desaparecidos(monkeypatch):
    # Ítem viejo que Azure ya no devuelve.
    await AzdoEsquemaItem(
        target="hitss",
        org_key=ORG_KEY,
        proyecto=PROYECTO,
        azdo_id=999,
        tipo="Task",
        titulo="Fantasma",
        ultima_sync=datetime(2000, 1, 1, tzinfo=UTC),
    ).insert()

    log = await _sync_con_servicio(monkeypatch, {"Task": [1, 2]}, ["Task"])

    assert log.estado == "success"
    ids = sorted(
        d.azdo_id
        for d in await AzdoEsquemaItem.find(
            {"org_key": ORG_KEY, "proyecto": PROYECTO}
        ).to_list()
    )
    assert ids == [1, 2]  # el 999 fue purgado


async def test_corrida_con_particion_fallida_no_purga(monkeypatch):
    await AzdoEsquemaItem(
        target="hitss",
        org_key=ORG_KEY,
        proyecto=PROYECTO,
        azdo_id=999,
        tipo="Bug",
        titulo="Sobreviviente",
        ultima_sync=datetime(2000, 1, 1, tzinfo=UTC),
    ).insert()

    log = await _sync_con_servicio(
        monkeypatch,
        {"Task": [1, 2], "Bug": [3]},
        ["Task", "Bug"],
        fallar_tipo="Bug",
    )

    assert log.estado == "error"
    ids = sorted(
        d.azdo_id
        for d in await AzdoEsquemaItem.find(
            {"org_key": ORG_KEY, "proyecto": PROYECTO}
        ).to_list()
    )
    assert 999 in ids  # no se purgó porque la corrida falló


# ── Guardia de concurrencia y caducidad ──

async def test_concurrencia_bloquea_segunda_corrida():
    primera = await preparar_corrida("hitss", ORG_KEY, PROYECTO, 3)
    assert primera is not None
    segunda = await preparar_corrida("hitss", ORG_KEY, PROYECTO, 3)
    assert segunda is None


async def test_corrida_en_curso_caducada_no_bloquea():
    vieja = await AzdoEsquemaSyncLog(
        target="hitss",
        org_key=ORG_KEY,
        proyecto=PROYECTO,
        estado="en_curso",
        particiones_totales=3,
        iniciado_en=datetime.now(UTC) - timedelta(minutes=45),
    ).insert()

    nueva = await preparar_corrida("hitss", ORG_KEY, PROYECTO, 3)

    assert nueva is not None
    vieja_actualizada = await AzdoEsquemaSyncLog.get(vieja.id)
    assert vieja_actualizada.estado == "error"
    assert "muerta" in (vieja_actualizada.error or "")


# ── Lectura del árbol desde Mongo ──

async def _sembrar_espejo(items):
    marca = datetime.now(UTC)
    for it in items:
        await AzdoEsquemaItem(
            target="hitss",
            org_key=ORG_KEY,
            proyecto=PROYECTO,
            azdo_id=it["azdo_id"],
            parent_id=it.get("parent_id"),
            tipo=it["tipo"],
            titulo=it["titulo"],
            estado=it.get("estado", "Active"),
            iteration_path=it.get("iteration_path", RUTA_CRM),
            ultima_sync=marca,
        ).insert()


async def _app_con_config(fabrica_aplicacion, iteraciones=None):
    app = await fabrica_aplicacion()
    if iteraciones is not None:
        app.iteraciones = iteraciones
        await app.save()
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url=ORG_URL,
        pat="pat-test",
        default_project=PROYECTO,
    ).insert()
    return app


async def test_arbol_sincronizado_recupera_ancestros_fuera_de_iteracion(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    # Épica y Feature fuera del sprint; solo la tarea está en CRM.
    await _sembrar_espejo([
        {"azdo_id": 1, "tipo": "Epic", "titulo": "Epica", "iteration_path": "Proyecto"},
        {"azdo_id": 2, "tipo": "Feature", "titulo": "Feature", "parent_id": 1,
         "iteration_path": "Proyecto"},
        {"azdo_id": 3, "tipo": "User Story", "titulo": "Historia", "parent_id": 2,
         "iteration_path": "Proyecto\\Backlog"},
        {"azdo_id": 4, "tipo": "Task", "titulo": "Tarea", "parent_id": 3,
         "iteration_path": "Proyecto\\CRM\\Sprint 1"},
    ])
    app = await _app_con_config(fabrica_aplicacion, iteraciones=RUTA_CRM)
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])

    resp = await cliente.get(
        "/api/azdo/esquema/arbol?tipos=Task",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    datos = resp.json()
    assert datos["origen"] == "sincronizado"
    assert datos["sin_sincronizar"] is False
    assert [raiz["azdo_id"] for raiz in datos["nodos"]] == [1]
    feature = datos["nodos"][0]["hijos"][0]
    historia = feature["hijos"][0]
    tarea = historia["hijos"][0]
    assert (feature["azdo_id"], historia["azdo_id"], tarea["azdo_id"]) == (2, 3, 4)
    assert tarea["contexto"] is False
    assert feature["contexto"] is True


async def test_arbol_sincronizado_no_mezcla_crm2(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    await _sembrar_espejo([
        {"azdo_id": 10, "tipo": "Task", "titulo": "Tarea CRM",
         "iteration_path": "Proyecto\\CRM\\Sprint 1"},
        {"azdo_id": 20, "tipo": "Task", "titulo": "Tarea CRM2",
         "iteration_path": "Proyecto\\CRM2\\Sprint 1"},
    ])
    app = await _app_con_config(fabrica_aplicacion, iteraciones=RUTA_CRM)
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])

    resp = await cliente.get(
        "/api/azdo/esquema/arbol?tipos=Task",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    ids = [raiz["azdo_id"] for raiz in resp.json()["nodos"]]
    assert ids == [10]


async def test_arbol_sincronizado_iteracion_no_permitida_da_403(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    await _sembrar_espejo([
        {"azdo_id": 10, "tipo": "Task", "titulo": "Tarea CRM",
         "iteration_path": "Proyecto\\CRM\\Sprint 1"},
    ])
    app = await _app_con_config(fabrica_aplicacion, iteraciones=RUTA_CRM)
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])

    resp = await cliente.get(
        "/api/azdo/esquema/arbol?tipos=Task&iteration_path=Proyecto\\BI\\Sprint%201",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 403
    assert "no está habilitada para el squad" in resp.json()["detail"]


async def test_arbol_sincronizado_sin_sincronizar_true_y_luego_false(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    app = await _app_con_config(fabrica_aplicacion)
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])

    resp_vacio = await cliente.get(
        "/api/azdo/esquema/arbol?tipos=Task",
        headers=headers_con_token(token, app.codigo),
    )
    await _sembrar_espejo([{"azdo_id": 1, "tipo": "Task", "titulo": "T"}])
    resp_lleno = await cliente.get(
        "/api/azdo/esquema/arbol?tipos=Task",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp_vacio.status_code == 200
    assert resp_vacio.json()["sin_sincronizar"] is True
    assert resp_vacio.json()["ultima_sync"] is None
    assert resp_lleno.status_code == 200
    assert resp_lleno.json()["sin_sincronizar"] is False
    assert resp_lleno.json()["ultima_sync"] is not None


async def test_arbol_origen_invalido_da_400(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    app = await _app_con_config(fabrica_aplicacion)
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])

    resp = await cliente.get(
        "/api/azdo/esquema/arbol?origen=otro",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 400


# ── Endpoints de sincronización ──

async def test_esquema_sync_en_consolidado_no_devuelve_409(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch
):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()
    await AzdoConfig(
        aplicacion_id=app_a.codigo,
        scope="app",
        org_url=ORG_URL,
        pat="pat-test",
        default_project=PROYECTO,
        tipos_esquema_activos=["Task"],
    ).insert()

    lanzados = {"n": 0}

    async def _ejecutar(*args, **kwargs):
        lanzados["n"] += 1

    monkeypatch.setattr(azdo_esquema_sync, "ejecutar_sincronizacion_esquema", _ejecutar)
    # El router importó la función por nombre; parchear también allí.
    import app.api.azdo as azdo_router
    monkeypatch.setattr(azdo_router, "ejecutar_sincronizacion_esquema", _ejecutar)

    _, token = await fabrica_usuario(
        [app_a.codigo, app_b.codigo],
        permisos=["azure_devops.editar", "consolidado.ver"],
    )
    resp = await cliente.post(
        "/api/azdo/esquema/sync",
        headers=headers_con_token(token, CONSOLIDADO),
    )

    assert resp.status_code == 200
    assert resp.json()["estado"] == "en_curso"
    assert resp.json()["proyecto"] == PROYECTO


async def test_esquema_sync_guardia_concurrencia_da_409(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch
):
    app = await _app_con_config(fabrica_aplicacion)
    cfg = await AzdoConfig.find_one(AzdoConfig.aplicacion_id == app.codigo)
    cfg.tipos_esquema_activos = ["Task"]
    await cfg.save()

    async def _ejecutar(*args, **kwargs):
        return None

    import app.api.azdo as azdo_router
    monkeypatch.setattr(azdo_router, "ejecutar_sincronizacion_esquema", _ejecutar)

    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.editar"])

    resp1 = await cliente.post(
        "/api/azdo/esquema/sync",
        headers=headers_con_token(token, app.codigo),
    )
    resp2 = await cliente.post(
        "/api/azdo/esquema/sync",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp1.status_code == 200
    assert resp2.status_code == 409


async def test_esquema_sync_estado_nunca_devuelve_200(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    app = await _app_con_config(fabrica_aplicacion)
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])

    resp = await cliente.get(
        "/api/azdo/esquema/sync/estado",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    assert resp.json()["estado"] == "nunca"
