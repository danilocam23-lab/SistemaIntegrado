"""Tests de construcción de la WIQL de esquema de Azure DevOps."""
from app.services.azure_devops import AzureDevOpsService


def _servicio() -> AzureDevOpsService:
    return AzureDevOpsService("https://dev.azure.com/test", "pat-test")


def test_construir_wiql_esquema_sin_tipos_no_genera_in_vacio():
    svc = _servicio()
    wiql = svc.construir_wiql_esquema("MiProyecto", [])

    assert "IN ('')" not in wiql
    assert "[System.WorkItemType] IN" not in wiql
    assert "[System.TeamProject] = 'MiProyecto'" in wiql
    assert wiql.startswith("SELECT [System.Id] FROM workitems WHERE ")


def test_construir_wiql_esquema_con_tipos_genera_in_de_siempre():
    svc = _servicio()
    wiql = svc.construir_wiql_esquema("MiProyecto", ["Epic", "Feature"])

    assert "[System.WorkItemType] IN ('Epic', 'Feature')" in wiql
    assert "[System.TeamProject] = 'MiProyecto'" in wiql
