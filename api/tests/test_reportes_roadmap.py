# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de `GET /api/reportes/roadmap`: forma de la respuesta, RBAC, multi-tenant
y ausencia de datos económicos."""
from datetime import datetime
from decimal import Decimal

from app.documents.asignacion import Asignacion, Proyecto
from app.documents.categoria import Categoria
from app.documents.persona import Persona
from app.documents.requerimiento import Entrega, Requerimiento, Solicitud
from tests.conftest import CONSOLIDADO, headers_con_token

URL = "/api/reportes/roadmap"


async def _sembrar(codigo: str, sufijo: str = "") -> dict:
    persona = await Persona(
        aplicacion_id=codigo, nombre=f"Ana{sufijo}", valor_persona=1000, valor_perifericos=50
    ).insert()
    categoria = await Categoria(
        aplicacion_id=codigo, nombre=f"Cat{sufijo}", color="#123456"
    ).insert()
    req = await Requerimiento(
        aplicacion_id=codigo,
        codigo_req=f"REQ-{sufijo or '1'}",
        nombre="Demo",
        solicitud=Solicitud(codigo_sc="SC-1", lt_hitss_id=str(persona.id)),
        estado="En ejecución",
        monto_pactado=Decimal("999"),
        total_horas_estimadas=Decimal("40"),
        categoria_id=str(categoria.id),
        developers_asignados=[str(persona.id)],
        fecha_inicio=datetime(2026, 1, 1),
        entregas=[
            Entrega(
                numero=1, horas=Decimal("8"), fecha_comprometida=datetime(2026, 2, 1),
                estado="APROBADA", observaciones="secreto",
            )
        ],
    ).insert()
    asig = await Asignacion(
        aplicacion_id=codigo, persona_id=str(persona.id), categoria_id=str(categoria.id),
        total_porcentaje=50,
        proyectos=[Proyecto(nombre="P", requerimiento_id=str(req.id))],
    ).insert()
    return {"persona": persona, "categoria": categoria, "req": req, "asig": asig}


async def test_forma_y_sin_valores_economicos(cliente, fabrica_aplicacion, fabrica_usuario):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["roadmap.ver"])
    h = headers_con_token(token, app.codigo)
    datos = await _sembrar(app.codigo)
    resp = await cliente.get(URL, headers=h)
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["total_proyectos"] == 1 and len(cuerpo["roadmap"]) == 1

    (req,) = cuerpo["requerimientos"]
    assert req["_id"] == str(datos["req"].id) and req["codigo_req"] == "REQ-1"
    assert req["solicitud"] == {"lt_hitss_id": str(datos["persona"].id)}
    assert req["developers_asignados"] == [str(datos["persona"].id)]
    assert req["categoria_id"] == str(datos["categoria"].id)
    assert req["entregas"][0]["numero"] == 1 and req["entregas"][0]["estado"] == "APROBADA"
    assert "fecha_comprometida" in req["entregas"][0]

    (persona,) = cuerpo["personas"]
    assert set(persona) == {"_id", "nombre", "activo", "rol_operativo"}
    (cat,) = cuerpo["categorias"]
    assert set(cat) == {"_id", "nombre", "color"}
    (asig,) = cuerpo["asignaciones"]
    assert asig["persona_id"] == str(datos["persona"].id) and asig["total_porcentaje"] == 50
    assert asig["proyectos"] == [{"requerimiento_id": str(datos["req"].id)}]

    texto = resp.text
    for prohibido in ("valor_persona", "valor_perifericos", "monto_pactado", "horas", "secreto"):
        assert prohibido not in texto


async def test_sin_permiso_403(cliente, fabrica_aplicacion, fabrica_usuario):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario(
        [app.codigo], permisos=["requerimientos.ver", "personas.ver", "asignaciones.ver"]
    )
    h = headers_con_token(token, app.codigo)
    assert (await cliente.get(URL, headers=h)).status_code == 403


async def test_aislamiento_y_consolidado(cliente, fabrica_aplicacion, fabrica_usuario):
    app = await fabrica_aplicacion()
    otra = await fabrica_aplicacion()
    await _sembrar(app.codigo, "A")
    await _sembrar(otra.codigo, "B")
    _, token = await fabrica_usuario([app.codigo], permisos=["roadmap.ver"])
    cuerpo = (await cliente.get(URL, headers=headers_con_token(token, app.codigo))).json()
    for clave in ("requerimientos", "personas", "categorias", "asignaciones", "roadmap"):
        assert len(cuerpo[clave]) == 1
    assert [p["nombre"] for p in cuerpo["personas"]] == ["AnaA"]

    _, token2 = await fabrica_usuario([app.codigo, otra.codigo], permisos=["roadmap.ver"])
    cons = (await cliente.get(URL, headers=headers_con_token(token2, CONSOLIDADO))).json()
    assert {p["nombre"] for p in cons["personas"]} == {"AnaA", "AnaB"}
    assert len(cons["requerimientos"]) == 2
