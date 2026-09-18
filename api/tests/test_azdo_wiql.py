# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

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


def test_construir_wiql_esquema_con_dos_iteraciones_genera_or_entre_parentesis():
    svc = _servicio()
    wiql = svc.construir_wiql_esquema(
        "MiProyecto",
        ["Task"],
        iteration_paths=["Proyecto\\CRM", "Proyecto\\BI"],
    )

    assert (
        "AND ([System.IterationPath] UNDER 'Proyecto\\CRM' "
        "OR [System.IterationPath] UNDER 'Proyecto\\BI')"
    ) in wiql


def test_construir_wiql_esquema_con_una_iteracion_genera_condicion_simple():
    svc = _servicio()
    wiql = svc.construir_wiql_esquema(
        "MiProyecto",
        ["Task"],
        iteration_paths=["Proyecto\\CRM"],
    )

    assert "AND [System.IterationPath] UNDER 'Proyecto\\CRM'" in wiql
    assert "OR [System.IterationPath]" not in wiql


def test_construir_wiql_esquema_sin_iteraciones_no_filtra_iteration_path():
    svc = _servicio()
    wiql = svc.construir_wiql_esquema("MiProyecto", ["Task"], iteration_paths=[])

    assert "System.IterationPath" not in wiql


def test_construir_wiql_esquema_escapa_comilla_simple_en_iteracion():
    svc = _servicio()
    wiql = svc.construir_wiql_esquema(
        "MiProyecto",
        ["Task"],
        iteration_paths=["Proyecto\\CRM\\Sprint O'Brian"],
    )

    assert "[System.IterationPath] UNDER 'Proyecto\\CRM\\Sprint O''Brian'" in wiql
