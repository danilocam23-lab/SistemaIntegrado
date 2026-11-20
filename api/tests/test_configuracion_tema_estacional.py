# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests del parámetro global ``tema_estacional`` (semilla y validación del PUT)."""
from app.bootstrap import sembrar_tema_estacional
from app.documents.configuracion import Configuracion
from tests.conftest import headers_con_token

RUTA = "/api/configuracion/tema_estacional"


async def test_valor_valido_se_guarda_normalizado(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=["admin.configuracion.editar"])
    resp = await cliente.put(
        RUTA, json={"valor": "  NAVIDAD ", "grupo": "apariencia"}, headers=headers_con_token(token)
    )
    assert resp.status_code == 200
    assert resp.json()["valor"] == "navidad"
    config = await Configuracion.find_one(Configuracion.clave == "tema_estacional")
    assert config is not None and config.valor == "navidad"
    await cliente.put(RUTA, json={"valor": "auto", "grupo": "apariencia"},
                      headers=headers_con_token(token))


async def test_valor_invalido_da_400(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=["admin.configuracion.editar"])
    resp = await cliente.put(
        RUTA, json={"valor": "pascua", "grupo": "apariencia"}, headers=headers_con_token(token)
    )
    assert resp.status_code == 400
    assert "halloween" in resp.json()["detail"]


async def test_semilla_no_pisa_valor_existente():
    config = await Configuracion.find_one(Configuracion.clave == "tema_estacional")
    assert config is not None  # sembrada por bootstrap()
    anterior = config.valor
    config.valor = "halloween"
    await config.save()
    try:
        assert await sembrar_tema_estacional() is False
        config = await Configuracion.find_one(Configuracion.clave == "tema_estacional")
        assert config is not None and config.valor == "halloween"
    finally:
        config.valor = anterior
        await config.save()
