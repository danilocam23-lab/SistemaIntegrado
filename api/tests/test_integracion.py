# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de ``/api/integracion/*`` (ADR-0008 F2.5).

Estos 4 endpoints los consume Power Automate en producción y usan
autenticación por ``X-API-Key`` (no JWT); cada uno tiene su propia clave
(ver ``api/README.md``). Las claves de prueba se fijan en
``tests/conftest.py`` (``API_KEY``, ``API_KEY_REQUERIMIENTOS``,
``API_KEY_SOLICITUDES``).
"""
import pytest

RUTAS_Y_CLAVES = [
    ("/api/integracion/entregas", "clave-test-entregas"),
    ("/api/integracion/requerimientos", "clave-test-requerimientos"),
    ("/api/integracion/solicitudes", "clave-test-solicitudes"),
    ("/api/integracion/solicitudes-entregas", "clave-test-solicitudes"),
]


@pytest.mark.parametrize("ruta,clave", RUTAS_Y_CLAVES)
async def test_401_con_clave_incorrecta(cliente, ruta, clave):
    resp = await cliente.get(ruta, headers={"X-API-Key": "clave-equivocada"})
    assert resp.status_code == 401


@pytest.mark.parametrize("ruta,clave", RUTAS_Y_CLAVES)
async def test_200_con_clave_correcta_y_shape_de_lista(cliente, ruta, clave):
    resp = await cliente.get(ruta, headers={"X-API-Key": clave})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.parametrize("ruta,clave", RUTAS_Y_CLAVES)
async def test_422_con_aplicacion_inexistente(cliente, ruta, clave):
    """ADR-0008 E6: antes devolvía [] con 200, indistinguible de "sin datos"."""
    resp = await cliente.get(
        ruta, params={"aplicacion": "esta-aplicacion-no-existe"}, headers={"X-API-Key": clave}
    )
    assert resp.status_code == 422


async def test_503_con_clave_no_configurada(cliente, monkeypatch):
    class _SettingsSinClave:
        api_key = ""

    monkeypatch.setattr(
        "app.api.integracion.get_settings", lambda: _SettingsSinClave()
    )
    resp = await cliente.get(
        "/api/integracion/entregas", headers={"X-API-Key": "lo-que-sea"}
    )
    assert resp.status_code == 503


async def test_200_con_aplicacion_existente_filtra_por_ella(
    cliente, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    resp = await cliente.get(
        "/api/integracion/requerimientos",
        params={"aplicacion": app.codigo},
        headers={"X-API-Key": "clave-test-requerimientos"},
    )
    assert resp.status_code == 200
    assert resp.json() == []  # la aplicación existe pero no tiene requerimientos
