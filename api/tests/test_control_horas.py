"""Test de `PUT /api/control-horas/todos` (ADR-0008 F3.3, P6).

Antes hacía un `find_one` + `save` por registro dentro del bucle; se reescribe
como un único `bulk_write` con upsert. Este test verifica que sigue creando
registros nuevos, actualizando los existentes (sin duplicarlos, gracias al
índice único) y que el resultado no cambia entre aplicaciones.
"""
from app.documents.control_horas import ControlHoras
from tests.conftest import headers_con_token


async def test_guardar_todos_crea_y_actualiza_sin_duplicar(
    cliente, fabrica_usuario, fabrica_aplicacion
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["control_horas_facturable.editar"])
    headers = headers_con_token(token, app.codigo)

    payload = {
        "registros": [
            {"persona_id": "p1", "squad": "squad-1", "horas_desarrollo": 10},
            {"persona_id": "p2", "squad": "squad-1", "horas_soporte": 5},
        ]
    }
    resp = await cliente.put(
        "/api/control-horas/todos", json=payload, params={"anio": 2101, "mes": 1}, headers=headers
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "guardados": 2}

    docs = await ControlHoras.find(
        {"aplicacion_id": app.codigo, "anio": 2101, "mes": 1}
    ).to_list()
    assert len(docs) == 2
    por_persona = {d.persona_id: d for d in docs}
    assert por_persona["p1"].horas_desarrollo == 10
    assert por_persona["p2"].horas_soporte == 5

    # Segunda pasada: actualiza p1, agrega p3. No debe duplicar p1 ni p2.
    payload2 = {
        "registros": [
            {"persona_id": "p1", "squad": "squad-1", "horas_desarrollo": 20},
            {"persona_id": "p3", "squad": "squad-1", "horas_desarrollo": 3},
        ]
    }
    resp2 = await cliente.put(
        "/api/control-horas/todos", json=payload2, params={"anio": 2101, "mes": 1}, headers=headers
    )
    assert resp2.status_code == 200
    assert resp2.json() == {"ok": True, "guardados": 2}

    docs2 = await ControlHoras.find(
        {"aplicacion_id": app.codigo, "anio": 2101, "mes": 1}
    ).to_list()
    assert len(docs2) == 3  # p1 (actualizado), p2 (intacto), p3 (nuevo)
    por_persona2 = {d.persona_id: d for d in docs2}
    assert por_persona2["p1"].horas_desarrollo == 20
    assert por_persona2["p2"].horas_soporte == 5
    assert por_persona2["p3"].horas_desarrollo == 3


async def test_guardar_todos_sin_registros_no_falla(cliente, fabrica_usuario, fabrica_aplicacion):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([app.codigo], permisos=["control_horas_facturable.editar"])
    resp = await cliente.put(
        "/api/control-horas/todos",
        json={"registros": []},
        headers=headers_con_token(token, app.codigo),
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "guardados": 0}
