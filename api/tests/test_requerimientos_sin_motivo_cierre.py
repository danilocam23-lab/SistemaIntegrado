# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Retiro del campo ``motivo_cierre``: compatibilidad con datos y clientes antiguos y
script ``scripts/eliminar_motivo_cierre.py``."""
import importlib.util
import json
from pathlib import Path

import pytest
from pymongo import MongoClient

from app.config import get_settings
from app.documents.requerimiento import Requerimiento
from tests.test_requerimientos_reglas import (
    _cuerpo_crear,
    _req,
    entorno,  # noqa: F401  (fixture reutilizada)
)


def _cargar_script():
    ruta = Path(__file__).resolve().parents[2] / "scripts" / "eliminar_motivo_cierre.py"
    spec = importlib.util.spec_from_file_location("eliminar_motivo_cierre", ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.fixture
def db_sync():
    settings = get_settings()
    cliente = MongoClient(settings.mongo_url)
    yield cliente[settings.mongo_db]
    cliente.close()


def test_el_modelo_ya_no_declara_el_campo():
    assert "motivo_cierre" not in Requerimiento.model_fields


async def test_documento_viejo_con_motivo_cierre_sigue_cargando(entorno, db_sync):  # noqa: F811
    app, _ = entorno
    req = await _req(app.codigo, "REQ-VIEJO")
    db_sync["requerimientos"].update_one({"_id": req.id}, {"$set": {"motivo_cierre": "x"}})
    cargado = await Requerimiento.get(req.id)
    assert cargado is not None
    assert cargado.codigo_req == "REQ-VIEJO"


async def test_cliente_antiguo_que_envia_motivo_cierre_no_da_422(cliente, entorno):  # noqa: F811
    app, h = entorno
    cuerpo = _cuerpo_crear(app.codigo)
    cuerpo["motivo_cierre"] = "legado"
    creada = await cliente.post("/api/requerimientos", json=cuerpo, headers=h)
    assert creada.status_code == 201
    assert "motivo_cierre" not in creada.json()

    req = await _req(app.codigo, "REQ-PUT-MC")
    editada = await cliente.put(
        f"/api/requerimientos/{req.id}",
        json={"motivo_cierre": "legado", "seguimiento": "ok"},
        headers=h,
    )
    assert editada.status_code == 200
    assert "motivo_cierre" not in editada.json()


async def test_script_simulacion_y_aplicar_son_idempotentes(entorno, db_sync):  # noqa: F811
    script = _cargar_script()
    app, _ = entorno
    con = await _req(app.codigo, "REQ-MC-1")
    vacio = await _req(app.codigo, "REQ-MC-2")
    sin = await _req(app.codigo, "REQ-MC-3")
    coleccion = db_sync["requerimientos"]
    coleccion.update_one({"_id": con.id}, {"$set": {"motivo_cierre": "Cerrado por X"}})
    coleccion.update_one({"_id": vacio.id}, {"$set": {"motivo_cierre": "  "}})
    db_sync["configuracion"].insert_one(
        {
            "aplicacion_id": app.codigo,
            "clave": "requerimientos_columnas",
            "valor": json.dumps(["codigo", "motivoCierre", "estado"]),
        }
    )

    antes = script.analizar(db_sync, app.codigo)
    assert antes["con_campo"] == 2
    assert antes["con_valor"] == 1
    assert antes["ejemplos"] == [("REQ-MC-1", "Cerrado por X")]
    assert len(antes["config"]) == 1
    # La simulación no escribe.
    assert coleccion.count_documents({"motivo_cierre": {"$exists": True}}) >= 2

    resultado = script.eliminar(db_sync, app.codigo)
    assert resultado == {"requerimientos": 2, "config": 1}
    assert coleccion.find_one({"_id": con.id}).get("motivo_cierre") is None
    assert "motivo_cierre" not in coleccion.find_one({"_id": vacio.id})
    assert "motivo_cierre" not in coleccion.find_one({"_id": sin.id})
    conf = db_sync["configuracion"].find_one(
        {"aplicacion_id": app.codigo, "clave": "requerimientos_columnas"}
    )
    assert json.loads(conf["valor"]) == ["codigo", "estado"]

    # Idempotente.
    assert script.eliminar(db_sync, app.codigo) == {"requerimientos": 0, "config": 0}
    despues = script.analizar(db_sync, app.codigo)
    assert despues["con_campo"] == 0
    assert despues["config"] == []
