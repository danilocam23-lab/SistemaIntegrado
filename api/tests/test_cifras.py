"""Tests de `/api/cifras` (ADR-0008 F3.1).

Los cuatro endpoints se reescribieron de "traer la colección completa y agregar
en Python" a un pipeline `aggregate` de Mongo. Estos tests fijan el resultado
esperado con datos conocidos: verifican que la reescritura no cambió ni un
número, solo la forma de calcularlo. Incluyen además un caso de aislamiento
multi-tenant (un requerimiento de otra aplicación no debe sumar en las cifras).
"""
from decimal import Decimal

from app.documents.enums import AnsResultado
from app.documents.requerimiento import Entrega, Requerimiento, Solicitud
from app.documents.squad import Squad
from tests.conftest import headers_con_token


async def _preparar(fabrica_aplicacion):
    app = await fabrica_aplicacion()
    squad = await Squad(aplicacion_id=app.codigo, nombre="Squad Uno").insert()

    await Requerimiento(
        aplicacion_id=app.codigo,
        codigo_req="REQ-1",
        solicitud=Solicitud(codigo_sc="SC-1", squad_id=str(squad.id)),
        estado="ABIERTO",
        total_horas_estimadas=Decimal("10"),
        ans_estimacion=AnsResultado.CUMPLE,
        monto_pactado=Decimal("1000"),
        entregas=[
            Entrega(numero=1, ans_entrega=AnsResultado.CUMPLE),
            Entrega(numero=2, ans_entrega=AnsResultado.NO_CUMPLE),
        ],
    ).insert()
    await Requerimiento(
        aplicacion_id=app.codigo,
        codigo_req="REQ-2",
        solicitud=Solicitud(codigo_sc="SC-2"),
        estado="ABIERTO",
        total_horas_estimadas=Decimal("5"),
    ).insert()
    await Requerimiento(
        aplicacion_id=app.codigo,
        codigo_req="REQ-3",
        solicitud=Solicitud(codigo_sc="SC-3", squad_id=str(squad.id)),
        estado="CERRADO",
        total_horas_estimadas=Decimal("20"),
        ans_estimacion=AnsResultado.NO_CUMPLE,
        monto_pactado=Decimal("0"),
        entregas=[Entrega(numero=1)],
    ).insert()

    # Requerimiento de OTRA aplicación: no debe sumar en ninguna cifra de `app`.
    otra = await fabrica_aplicacion()
    await Requerimiento(
        aplicacion_id=otra.codigo,
        codigo_req="REQ-OTRA",
        solicitud=Solicitud(codigo_sc="SC-OTRA"),
        estado="ABIERTO",
        total_horas_estimadas=Decimal("999"),
    ).insert()

    return app, squad


async def test_por_estado(cliente, fabrica_usuario, fabrica_aplicacion):
    app, _ = await _preparar(fabrica_aplicacion)
    _, token = await fabrica_usuario([app.codigo])

    resp = await cliente.get("/api/cifras/estado", headers=headers_con_token(token, app.codigo))
    assert resp.status_code == 200
    cifras = {f["estado"]: f for f in resp.json()["cifras"]}
    assert cifras["ABIERTO"] == {"estado": "ABIERTO", "cantidad": 2, "horas": 15.0}
    assert cifras["CERRADO"] == {"estado": "CERRADO", "cantidad": 1, "horas": 20.0}
    # Orden: cantidad descendente.
    assert [f["estado"] for f in resp.json()["cifras"]] == ["ABIERTO", "CERRADO"]


async def test_por_squad(cliente, fabrica_usuario, fabrica_aplicacion):
    app, squad = await _preparar(fabrica_aplicacion)
    _, token = await fabrica_usuario([app.codigo])

    resp = await cliente.get("/api/cifras/squad", headers=headers_con_token(token, app.codigo))
    assert resp.status_code == 200
    cifras = {f["squad"]: f for f in resp.json()["cifras"]}
    assert cifras["Squad Uno"] == {"squad": "Squad Uno", "cantidad": 2, "horas": 30.0}
    assert cifras["Sin squad"] == {"squad": "Sin squad", "cantidad": 1, "horas": 5.0}


async def test_por_ans(cliente, fabrica_usuario, fabrica_aplicacion):
    app, _ = await _preparar(fabrica_aplicacion)
    _, token = await fabrica_usuario([app.codigo])

    resp = await cliente.get("/api/cifras/ans", headers=headers_con_token(token, app.codigo))
    assert resp.status_code == 200
    datos = resp.json()
    assert datos["estimacion"] == {"CUMPLE": 1, "NO_CUMPLE": 1, "SIN_ANS": 1}
    # 2 entregas de REQ-1 (CUMPLE, NO_CUMPLE) + 1 de REQ-3 (sin ans -> SIN_ANS);
    # REQ-2 no tiene entregas y no debe aportar ninguna fila.
    assert datos["entrega"] == {"CUMPLE": 1, "NO_CUMPLE": 1, "SIN_ANS": 1}


async def test_por_liquidacion(cliente, fabrica_usuario, fabrica_aplicacion):
    app, _ = await _preparar(fabrica_aplicacion)
    _, token = await fabrica_usuario([app.codigo])

    resp = await cliente.get(
        "/api/cifras/liquidacion", headers=headers_con_token(token, app.codigo)
    )
    assert resp.status_code == 200
    datos = resp.json()
    assert datos["total_monto"] == 1000.0
    assert datos["total_horas"] == 35.0
    assert datos["total_reqs"] == 3
    assert datos["con_monto"] == 1  # REQ-3 tiene monto_pactado=0: no cuenta.
    assert datos["total_entregas"] == 3
    por_squad = {f["squad"]: f for f in datos["por_squad"]}
    assert por_squad["Squad Uno"] == {
        "squad": "Squad Uno", "monto": 1000.0, "horas": 30.0, "cantidad": 2
    }
    assert por_squad["Sin squad"] == {
        "squad": "Sin squad", "monto": 0.0, "horas": 5.0, "cantidad": 1
    }
