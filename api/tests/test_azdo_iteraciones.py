# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests del filtrado de esquema de Azure por iteraciones de aplicación."""
import httpx

from app.api.azdo import (
    _construir_arbol,
    _iteracion_habilitada,
    _mapear_error_esquema,
    _normalizar_iteracion_con_proyecto,
)
from app.documents.azdo_config import AzdoConfig
from app.services.azure_devops import AzureDevOpsService
from tests.conftest import headers_con_token

RUTA_CRM = "Proyecto\\CRM"
RUTA_BI = "Proyecto\\BI"


def test_iteracion_habilitada_permite_descendiente_y_rechaza_prefijo_inseguro():
    assert _iteracion_habilitada("Proyecto\\CRM\\Sprint 1", RUTA_CRM)
    assert not _iteracion_habilitada("Proyecto\\CRM2\\Sprint 1", RUTA_CRM)


def test_normalizar_iteracion_con_proyecto_completa_rutas_cortas_sin_confundir_prefijos():
    assert _normalizar_iteracion_con_proyecto("CRM", "Proyecto") == RUTA_CRM
    assert _normalizar_iteracion_con_proyecto(RUTA_CRM, "Proyecto") == RUTA_CRM
    assert _normalizar_iteracion_con_proyecto("CRM2", "Proyecto") == "Proyecto\\CRM2"
    assert not _iteracion_habilitada("Proyecto\\CRM2\\Sprint 1", RUTA_CRM)


def test_mapear_error_esquema_vs402337_devuelve_mensaje_accionable():
    error = RuntimeError(
        "Azure DevOps API 400: VS402337: The number of work items returned exceeds "
        "the size limit of 20000."
    )

    dominio = _mapear_error_esquema(error, "Proyecto")

    assert "límite de 20.000 work items" in dominio.mensaje
    assert "configurando iteraciones" in dominio.mensaje
    assert "VS402337" in dominio.mensaje


def test_mapear_error_esquema_tf51011_explica_ruta_completa():
    error = RuntimeError(
        "Azure DevOps API 400: TF51011: The specified iteration path does not exist."
    )

    dominio = _mapear_error_esquema(error, "Proyecto")

    assert "ruta de iteración configurada no existe" in dominio.mensaje
    assert "empezando por el nombre del proyecto" in dominio.mensaje
    assert "TF51011" in dominio.mensaje


def test_mapear_error_esquema_http_error_conserva_mensaje_neutro():
    dominio = _mapear_error_esquema(httpx.HTTPError("fallo de red"), "Proyecto")

    assert dominio.mensaje == "No se pudo obtener el esquema de Azure DevOps."


async def test_esquema_arbol_squad_con_iteraciones_filtra_y_rechaza_ajena(
    cliente,
    fabrica_aplicacion,
    fabrica_usuario,
    monkeypatch,
):
    app = await fabrica_aplicacion()
    app.iteraciones = RUTA_CRM
    await app.save()
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url="https://dev.azure.com/test",
        pat="pat-test",
        default_project="Proyecto",
    ).insert()
    iteraciones_recibidas: list[list[str] | None] = []

    async def _arbol(self, *args, **kwargs):
        iteraciones_recibidas.append(kwargs["iteration_paths"])
        return (
            [
                {
                    "azdo_id": 1,
                    "tipo": "Task",
                    "titulo": "Tarea CRM",
                    "estado": "Active",
                    "parent_id": None,
                    "contexto": False,
                }
            ],
            False,
        )

    monkeypatch.setattr(AzureDevOpsService, "obtener_work_items_esquema", _arbol)

    resp = await cliente.get(
        "/api/azdo/esquema/arbol?tipos=Task",
        headers=headers_con_token(token, app.codigo),
    )
    resp_ajena = await cliente.get(
        "/api/azdo/esquema/arbol?tipos=Task&iteration_path=Proyecto\\BI\\Sprint%201",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    datos = resp.json()
    assert iteraciones_recibidas == [[RUTA_CRM]]
    assert datos["iteraciones_aplicadas"] == [RUTA_CRM]
    assert datos["filtrado_por_squad"] is True
    assert resp_ajena.status_code == 403
    assert "no está habilitada para el squad" in resp_ajena.json()["detail"]


async def test_esquema_arbol_acepta_iteration_path_completa_con_configuracion_corta(
    cliente,
    fabrica_aplicacion,
    fabrica_usuario,
    monkeypatch,
):
    app = await fabrica_aplicacion()
    app.iteraciones = "CRM"
    await app.save()
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url="https://dev.azure.com/test",
        pat="pat-test",
        default_project="Proyecto",
    ).insert()
    iteraciones_recibidas: list[list[str] | None] = []

    async def _arbol(self, *args, **kwargs):
        iteraciones_recibidas.append(kwargs["iteration_paths"])
        return ([], False)

    monkeypatch.setattr(AzureDevOpsService, "obtener_work_items_esquema", _arbol)

    resp = await cliente.get(
        "/api/azdo/esquema/arbol?tipos=Task&iteration_path=Proyecto\\CRM\\Sprint%201",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    assert iteraciones_recibidas == [["Proyecto\\CRM\\Sprint 1"]]
    assert resp.json()["iteraciones_aplicadas"] == ["Proyecto\\CRM\\Sprint 1"]


async def test_esquema_arbol_squad_sin_iteraciones_no_filtra(
    cliente,
    fabrica_aplicacion,
    fabrica_usuario,
    monkeypatch,
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["azure_devops.ver"])
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url="https://dev.azure.com/test",
        pat="pat-test",
        default_project="Proyecto",
    ).insert()
    iteraciones_recibidas: list[list[str] | None] = []

    async def _arbol(self, *args, **kwargs):
        iteraciones_recibidas.append(kwargs["iteration_paths"])
        return (
            [
                {
                    "azdo_id": 1,
                    "tipo": "Task",
                    "titulo": "Tarea sin filtro",
                    "estado": "Active",
                    "parent_id": None,
                    "contexto": False,
                }
            ],
            False,
        )

    monkeypatch.setattr(AzureDevOpsService, "obtener_work_items_esquema", _arbol)

    resp = await cliente.get(
        "/api/azdo/esquema/arbol?tipos=Task",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp.status_code == 200
    datos = resp.json()
    assert iteraciones_recibidas == [None]
    assert datos["iteraciones_aplicadas"] == []
    assert datos["filtrado_por_squad"] is False


async def test_esquema_iteraciones_permitidas_devuelve_normalizadas_y_vacias(
    cliente,
    fabrica_aplicacion,
    fabrica_usuario,
):
    app_con_iteraciones = await fabrica_aplicacion()
    app_con_iteraciones.iteraciones = "CRM;Proyecto\\BI"
    await app_con_iteraciones.save()
    app_sin_iteraciones = await fabrica_aplicacion()
    _, token = await fabrica_usuario(
        [app_con_iteraciones.codigo, app_sin_iteraciones.codigo],
        permisos=["azure_devops.ver"],
    )
    for app in (app_con_iteraciones, app_sin_iteraciones):
        await AzdoConfig(
            aplicacion_id=app.codigo,
            scope="app",
            org_url="https://dev.azure.com/test",
            pat="pat-test",
            default_project="Proyecto",
        ).insert()

    resp_con_iteraciones = await cliente.get(
        "/api/azdo/esquema/iteraciones-permitidas",
        headers=headers_con_token(token, app_con_iteraciones.codigo),
    )
    resp_sin_iteraciones = await cliente.get(
        "/api/azdo/esquema/iteraciones-permitidas",
        headers=headers_con_token(token, app_sin_iteraciones.codigo),
    )

    assert resp_con_iteraciones.status_code == 200
    assert resp_con_iteraciones.json() == {
        "proyecto": "Proyecto",
        "iteraciones": [RUTA_CRM, RUTA_BI],
    }
    assert resp_sin_iteraciones.status_code == 200
    assert resp_sin_iteraciones.json() == {"proyecto": "Proyecto", "iteraciones": []}


async def test_esquema_tipos_config_guarda_recupera_y_usa_default(
    cliente,
    fabrica_aplicacion,
    fabrica_usuario,
    monkeypatch,
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario(
        [app.codigo],
        permisos=["azure_devops.ver", "azure_devops.editar"],
    )
    await AzdoConfig(
        aplicacion_id=app.codigo,
        scope="app",
        org_url="https://dev.azure.com/test",
        pat="pat-test",
        default_project="Proyecto",
    ).insert()

    async def _tipos_proceso(self, proyecto):
        return [
            {"nombre": "Epic", "referencia": "Epic"},
            {"nombre": "Feature", "referencia": "Feature"},
            {"nombre": "Task", "referencia": "Task"},
        ]

    async def _jerarquia(self, proyecto):
        return [{"nombre": "Backlog", "rango": 1, "tipos": ["Epic", "Feature"]}]

    monkeypatch.setattr(AzureDevOpsService, "obtener_tipos_proceso", _tipos_proceso)
    monkeypatch.setattr(AzureDevOpsService, "obtener_jerarquia_backlog", _jerarquia)

    resp_default = await cliente.get(
        "/api/azdo/esquema/tipos-config",
        headers=headers_con_token(token, app.codigo),
    )
    resp_guardar = await cliente.put(
        "/api/azdo/esquema/tipos-config",
        json={"activos": ["Task", "Feature", "Task", " "]},
        headers=headers_con_token(token, app.codigo),
    )
    resp_guardado = await cliente.get(
        "/api/azdo/esquema/tipos-config",
        headers=headers_con_token(token, app.codigo),
    )
    tipos_recibidos: list[list[str]] = []

    async def _arbol(self, proyecto, tipos, **kwargs):
        tipos_recibidos.append(tipos)
        return ([], False)

    monkeypatch.setattr(AzureDevOpsService, "obtener_work_items_esquema", _arbol)
    resp_arbol = await cliente.get(
        "/api/azdo/esquema/arbol",
        headers=headers_con_token(token, app.codigo),
    )

    assert resp_default.status_code == 200
    assert resp_default.json()["activos"] == ["Epic", "Feature"]
    assert resp_default.json()["disponibles"][0]["nombre"] == "Epic"
    assert resp_guardar.status_code == 200
    assert resp_guardar.json()["activos"] == ["Task", "Feature"]
    assert resp_guardado.status_code == 200
    assert resp_guardado.json()["activos"] == ["Task", "Feature"]
    assert resp_arbol.status_code == 200
    assert tipos_recibidos == [["Task", "Feature"]]


async def test_obtener_work_items_esquema_recupera_ancestros_y_conserva_arbol(monkeypatch):
    svc = AzureDevOpsService("https://dev.azure.com/test", "pat-test")

    async def _fetch(self, cliente, url, metodo="GET", cuerpo=None):
        if cuerpo and "query" in cuerpo:
            return {"workItems": [{"id": 3}]}
        ids = cuerpo["ids"]
        if ids == [3]:
            return {"value": [_work_item(3, "Task", "Tarea", parent_id=2)]}
        if ids == [2]:
            return {"value": [_work_item(2, "User Story", "Historia", parent_id=1)]}
        if ids == [1]:
            return {"value": [_work_item(1, "Feature", "Feature")]}
        return {"value": []}

    monkeypatch.setattr(AzureDevOpsService, "_fetch", _fetch)

    items, truncado = await svc.obtener_work_items_esquema(
        "Proyecto",
        ["Task"],
        iteration_paths=[RUTA_CRM],
    )
    arbol = _construir_arbol(items)
    por_id = {item["azdo_id"]: item for item in items}

    assert truncado is False
    assert por_id[3]["contexto"] is False
    assert por_id[2]["contexto"] is True
    assert por_id[1]["contexto"] is True
    assert [raiz["azdo_id"] for raiz in arbol] == [1]
    assert arbol[0]["hijos"][0]["azdo_id"] == 2
    assert arbol[0]["hijos"][0]["hijos"][0]["azdo_id"] == 3


def _work_item(azdo_id: int, tipo: str, titulo: str, parent_id: int | None = None) -> dict:
    fields = {
        "System.Id": azdo_id,
        "System.WorkItemType": tipo,
        "System.Title": titulo,
        "System.State": "Active",
        "System.IterationPath": RUTA_CRM,
        "System.AreaPath": "Proyecto",
    }
    if parent_id is not None:
        fields["System.Parent"] = parent_id
    return {"id": azdo_id, "url": f"https://example.test/{azdo_id}", "fields": fields}
