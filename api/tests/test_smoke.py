# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Humo: la app arranca contra Mongo de pruebas y responde (ADR-0008 F2.1)."""


async def test_health_responde_200(cliente):
    resp = await cliente.get("/api/health")
    assert resp.status_code == 200


async def test_ruta_api_inexistente_devuelve_404_json(cliente):
    """Regresión de F0.6/S12: un 404 de la API nunca debe caer en el SPA."""
    resp = await cliente.get("/api/esto-no-existe")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Ruta de API no encontrada"
