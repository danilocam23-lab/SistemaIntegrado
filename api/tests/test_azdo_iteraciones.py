"""Tests del filtrado de esquema de Azure por iteraciones de aplicación."""
from app.api.azdo import _construir_arbol, _iteracion_habilitada
from app.documents.azdo_config import AzdoConfig
from app.services.azure_devops import AzureDevOpsService
from tests.conftest import headers_con_token

RUTA_CRM = "Proyecto\\CRM"
RUTA_BI = "Proyecto\\BI"


def test_iteracion_habilitada_permite_descendiente_y_rechaza_prefijo_inseguro():
    assert _iteracion_habilitada("Proyecto\\CRM\\Sprint 1", RUTA_CRM)
    assert not _iteracion_habilitada("Proyecto\\CRM2\\Sprint 1", RUTA_CRM)


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
