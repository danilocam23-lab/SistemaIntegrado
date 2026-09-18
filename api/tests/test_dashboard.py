# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Test de `GET /api/dashboard/consolidado` (ADR-0008 F3.3, P8).

Antes hacía 3 consultas por aplicación dentro de un bucle (N+1); se reescribe
con `$group` para contar por aplicación en un solo viaje por colección. Este
test fija el resultado esperado con datos conocidos en dos aplicaciones.
"""
from app.documents.categoria import Categoria
from app.documents.persona import Persona
from tests.conftest import CONSOLIDADO, headers_con_token


async def test_consolidado_cuenta_personas_y_categorias_por_aplicacion(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app_a = await fabrica_aplicacion()
    app_b = await fabrica_aplicacion()

    await Persona(aplicacion_id=app_a.codigo, nombre="Persona A1").insert()
    await Persona(aplicacion_id=app_b.codigo, nombre="Persona B1").insert()
    await Persona(aplicacion_id=app_b.codigo, nombre="Persona B2").insert()
    await Categoria(aplicacion_id=app_a.codigo, nombre="Categoría A1").insert()

    _, token = await fabrica_usuario(
        [app_a.codigo, app_b.codigo], permisos=["consolidado.ver"]
    )
    resp = await cliente.get(
        "/api/dashboard/consolidado", headers=headers_con_token(token, CONSOLIDADO)
    )
    assert resp.status_code == 200
    datos = resp.json()
    assert datos["modo_consolidado"] is True
    assert datos["total_aplicaciones"] == 2
    por_codigo = {f["aplicacion"]: f for f in datos["aplicaciones"]}
    assert por_codigo[app_a.codigo]["personas"] == 1
    assert por_codigo[app_a.codigo]["categorias"] == 1
    assert por_codigo[app_b.codigo]["personas"] == 2
    assert por_codigo[app_b.codigo]["categorias"] == 0
