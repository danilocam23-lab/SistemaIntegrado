# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Árbol sincronizado truncado por niveles y carga perezosa de hijos (``/esquema/hijos``)."""
from datetime import UTC, datetime

import pytest_asyncio

from app.api import azdo as azdo_api
from app.documents.azdo import AzdoEsquemaItem
from app.documents.azdo_config import AzdoConfig
from app.services.azure_devops import normalizar_org_key
from tests.conftest import headers_con_token

ORG_URL = "https://dev.azure.com/HitssColombia"
ORG_KEY = normalizar_org_key(ORG_URL)
PROYECTO = "Proyecto"
RUTA_CRM = "Proyecto\\CRM"
SPRINT = "Proyecto\\CRM\\Sprint 1"


@pytest_asyncio.fixture(autouse=True)
async def _limpiar():
    await AzdoEsquemaItem.delete_all()
    await AzdoConfig.delete_all()
    yield


async def _sembrar(items):
    marca = datetime.now(UTC)
    for azdo_id, tipo, parent_id, *resto in items:
        ruta = resto[0] if resto else SPRINT
        await AzdoEsquemaItem(
            target="hitss",
            org_key=ORG_KEY,
            proyecto=PROYECTO,
            azdo_id=azdo_id,
            parent_id=parent_id,
            tipo=tipo,
            titulo=f"{tipo} {azdo_id}",
            estado="Active",
            iteration_path=ruta,
            ultima_sync=marca,
        ).insert()


async def _app(fabrica_aplicacion, fabrica_usuario, iteraciones=None):
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
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    return headers_con_token(token, app.codigo)


def _aplanar(nodos):
    for nodo in nodos:
        yield nodo
        yield from _aplanar(nodo["hijos"])


# Árbol: 1 -> (2, 3); 2 -> (4, 5); 3 -> (6); 100 raíz aparte -> (101)
ARBOL = [
    (1, "Epic", None),
    (2, "Feature", 1),
    (3, "Feature", 1),
    (4, "Task", 2),
    (5, "Bug", 2),
    (6, "Task", 3),
    (100, "Epic", None),
    (101, "Task", 100),
]


async def test_truncado_por_niveles_sin_huerfanos(cliente, fabrica_aplicacion, fabrica_usuario):
    await _sembrar(ARBOL)
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    resp = await cliente.get("/api/azdo/esquema/arbol?limite=4", headers=headers)

    assert resp.status_code == 200
    datos = resp.json()
    assert datos["total_coincidentes"] == 8
    assert datos["limite"] == 4
    assert datos["truncado"] is True
    # Raíces (1, 100) y luego hijos de nivel 1 por azdo_id (2, 3 caben hasta 4 nodos).
    assert [r["azdo_id"] for r in datos["nodos"]] == [1, 100]
    ids = {n["azdo_id"] for n in _aplanar(datos["nodos"])}
    assert ids == {1, 100, 2, 3}
    # Sin huérfanos: todo nodo no raíz cuelga de su padre real.
    for nodo in _aplanar(datos["nodos"]):
        for hijo in nodo["hijos"]:
            assert hijo["parent_id"] == nodo["azdo_id"]
    por_id = {n["azdo_id"]: n for n in _aplanar(datos["nodos"])}
    assert por_id[1]["hijos_pendientes"] == 0
    assert por_id[100]["hijos_pendientes"] == 1  # 101 no entró
    assert por_id[2]["hijos_pendientes"] == 2  # 4 y 5
    assert por_id[3]["hijos_pendientes"] == 1  # 6


async def test_sin_truncar_devuelve_todo_con_pendientes_cero(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    await _sembrar(ARBOL)
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    resp = await cliente.get("/api/azdo/esquema/arbol?limite=8", headers=headers)

    datos = resp.json()
    assert datos["truncado"] is False
    assert datos["total_coincidentes"] == 8
    nodos = list(_aplanar(datos["nodos"]))
    assert len(nodos) == 8
    assert all(n["hijos_pendientes"] == 0 for n in nodos)


async def test_hijos_pendientes_respeta_filtro_de_tipo(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    await _sembrar(ARBOL)
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    # Con tipos=Epic,Feature,Task (sin Bug): coincidentes = 7; limite 3 -> 1,100 y 2.
    resp = await cliente.get(
        "/api/azdo/esquema/arbol?limite=3&tipos=Epic,Feature,Task", headers=headers
    )

    datos = resp.json()
    assert datos["total_coincidentes"] == 7
    por_id = {n["azdo_id"]: n for n in _aplanar(datos["nodos"])}
    assert set(por_id) == {1, 100, 2}
    assert por_id[1]["hijos_pendientes"] == 1  # 3; el Bug 5 no cuenta, 2 ya está
    assert por_id[2]["hijos_pendientes"] == 1  # solo 4; el Bug 5 queda excluido por el filtro
    assert por_id[100]["hijos_pendientes"] == 1


async def test_truncado_con_filtro_toma_raices_del_conjunto_filtrado(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    # Solo Task: sus padres no cumplen el filtro, así que las Task son raíces del conjunto.
    await _sembrar(ARBOL)
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    resp = await cliente.get("/api/azdo/esquema/arbol?limite=2&tipos=Task", headers=headers)

    datos = resp.json()
    assert datos["total_coincidentes"] == 3
    assert datos["truncado"] is True
    tareas = {n["azdo_id"] for n in _aplanar(datos["nodos"]) if not n["contexto"]}
    assert tareas == {4, 6}


async def test_hijos_devuelve_directos_con_pendientes(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    await _sembrar(ARBOL)
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    resp = await cliente.get("/api/azdo/esquema/hijos?padre_id=1", headers=headers)

    assert resp.status_code == 200
    datos = resp.json()
    assert datos["padre_id"] == 1
    assert datos["total"] == 2
    assert datos["truncado"] is False
    assert [n["azdo_id"] for n in datos["nodos"]] == [2, 3]
    assert [n["hijos_pendientes"] for n in datos["nodos"]] == [2, 1]

    filtrado = await cliente.get(
        "/api/azdo/esquema/hijos?padre_id=2&tipos=Task", headers=headers
    )
    assert [n["azdo_id"] for n in filtrado.json()["nodos"]] == [4]


async def test_hijos_respeta_iteraciones_del_squad(
    cliente, fabrica_aplicacion, fabrica_usuario
):
    await _sembrar([
        (1, "Epic", None, "Proyecto"),
        (2, "Task", 1, SPRINT),
        (3, "Task", 1, "Proyecto\\BI\\Sprint 1"),
        (4, "Task", 3, "Proyecto\\BI\\Sprint 1"),
    ])
    headers = await _app(fabrica_aplicacion, fabrica_usuario, iteraciones=RUTA_CRM)

    resp = await cliente.get("/api/azdo/esquema/hijos?padre_id=1", headers=headers)
    prohibida = await cliente.get(
        "/api/azdo/esquema/hijos?padre_id=1&iteration_path=Proyecto\\BI\\Sprint%201",
        headers=headers,
    )

    assert [n["azdo_id"] for n in resp.json()["nodos"]] == [2]
    assert resp.json()["total"] == 1
    assert prohibida.status_code == 403


async def test_hijos_limite_de_500(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch
):
    monkeypatch.setattr(azdo_api, "_MAX_HIJOS_ESQUEMA", 3)
    await _sembrar([(1, "Epic", None)] + [(10 + i, "Task", 1) for i in range(5)])
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    resp = await cliente.get("/api/azdo/esquema/hijos?padre_id=1", headers=headers)

    datos = resp.json()
    assert datos["total"] == 5
    assert datos["truncado"] is True
    assert [n["azdo_id"] for n in datos["nodos"]] == [10, 11, 12]


async def test_hijos_paginacion_con_offset(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch
):
    monkeypatch.setattr(azdo_api, "_MAX_HIJOS_ESQUEMA", 3)
    await _sembrar([(1, "Epic", None)] + [(10 + i, "Task", 1) for i in range(7)])
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    vistos: list[int] = []
    offset: int | None = 0
    paginas = []
    while offset is not None:
        resp = await cliente.get(
            f"/api/azdo/esquema/hijos?padre_id=1&offset={offset}", headers=headers
        )
        datos = resp.json()
        assert datos["total"] == 7
        vistos.extend(n["azdo_id"] for n in datos["nodos"])
        paginas.append(datos)
        offset = datos["siguiente_offset"]

    assert vistos == [10, 11, 12, 13, 14, 15, 16]
    assert [p["truncado"] for p in paginas] == [True, True, False]
    assert [p["siguiente_offset"] for p in paginas] == [3, 6, None]


async def test_hijos_offset_negativo_da_422(cliente, fabrica_aplicacion, fabrica_usuario):
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    resp = await cliente.get("/api/azdo/esquema/hijos?padre_id=1&offset=-1", headers=headers)

    assert resp.status_code == 422


def test_limite_real_de_hijos_es_500():
    assert azdo_api._MAX_HIJOS_ESQUEMA == 500


async def test_hijos_origen_distinto_da_400(cliente, fabrica_aplicacion, fabrica_usuario):
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    resp = await cliente.get("/api/azdo/esquema/hijos?padre_id=1&origen=vivo", headers=headers)

    assert resp.status_code == 400


async def test_truncado_por_lotes_no_carga_todo(
    cliente, fabrica_aplicacion, fabrica_usuario, monkeypatch
):
    """Con lotes diminutos el resultado es idéntico y la selección usa consultas acotadas."""
    monkeypatch.setattr(azdo_api, "_LOTE_PARENT_IDS", 1)
    await _sembrar(ARBOL)
    headers = await _app(fabrica_aplicacion, fabrica_usuario)

    resp = await cliente.get("/api/azdo/esquema/arbol?limite=5", headers=headers)

    ids = {n["azdo_id"] for n in _aplanar(resp.json()["nodos"])}
    assert ids == {1, 100, 2, 3, 101}


async def test_plan_de_consultas_usa_indices(fabrica_aplicacion):
    """Explain mínimo: la búsqueda de hijos usa un índice y no un COLLSCAN."""
    await _sembrar(ARBOL)
    coleccion = AzdoEsquemaItem.get_pymongo_collection()

    plan = await coleccion.find(
        {"org_key": ORG_KEY, "proyecto": PROYECTO, "parent_id": {"$in": [1]}, "tipo": "Task"}
    ).explain()

    assert "COLLSCAN" not in str(plan["queryPlanner"]["winningPlan"])
