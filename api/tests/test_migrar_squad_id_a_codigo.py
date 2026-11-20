# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Tests de ``scripts/migrar_squad_id_a_codigo.py`` (lógica pura y migración en BD de test)."""
import importlib.util
import json
from pathlib import Path

import pytest
from pymongo import MongoClient

from app.config import get_settings
from app.documents.squad import Squad


def _cargar_script():
    ruta = Path(__file__).resolve().parents[2] / "scripts" / "migrar_squad_id_a_codigo.py"
    spec = importlib.util.spec_from_file_location("migrar_squad_id_a_codigo", ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.fixture
def db_sync():
    settings = get_settings()
    cliente = MongoClient(settings.mongo_url)
    yield cliente[settings.mongo_db]
    cliente.close()


SQUADS = {"abc123": "app-x"}
APLICACIONES = {"app-x", "app-y"}


@pytest.fixture
def limpieza(db_sync):
    """Registra documentos insertados por el test y los borra al terminar."""
    insertados: list[tuple[str, object]] = []

    def insertar(coleccion: str, doc: dict):
        _id = db_sync[coleccion].insert_one(doc).inserted_id
        insertados.append((coleccion, _id))
        return _id

    yield insertar
    for coleccion, _id in insertados:
        db_sync[coleccion].delete_one({"_id": _id})


@pytest.mark.parametrize("valor,app,esperado", [
    (None, "app-x", ("ignorar", None)),
    ("", "app-x", ("ignorar", None)),
    ("app-x", "app-x", ("correcto", None)),
    ("abc123", "app-x", ("migrar", "app-x")),
    ("abc123", "app-y", ("conflicto", None)),
    ("abc123", None, ("conflicto", None)),
])
def test_decidir_conversion(valor, app, esperado):
    assert _cargar_script().decidir_conversion(valor, app, SQUADS) == esperado


async def test_migrar_dry_run_y_aplicar(fabrica_aplicacion, db_sync, tmp_path, limpieza):
    script = _cargar_script()
    app = await fabrica_aplicacion()
    otra = await fabrica_aplicacion()
    squad = await Squad(aplicacion_id=app.codigo, nombre="S").insert()
    try:
        await _cuerpo_dry_run_y_aplicar(script, app, otra, squad, db_sync, tmp_path, limpieza)
    finally:
        await squad.delete()


async def _cuerpo_dry_run_y_aplicar(script, app, otra, squad, db_sync, tmp_path, limpieza):
    sid = str(squad.id)
    col = db_sync["requerimientos"]
    a_migrar = limpieza(
        "requerimientos",
        {"aplicacion_id": app.codigo, "codigo_req": "R1", "solicitud": {"squad_id": sid}},
    )
    conflicto = limpieza(
        "requerimientos",
        {"aplicacion_id": otra.codigo, "codigo_req": "R4", "solicitud": {"squad_id": sid}},
    )
    correcto = limpieza(
        "requerimientos",
        {"aplicacion_id": app.codigo, "codigo_req": "R2", "solicitud": {"squad_id": app.codigo}},
    )
    limpieza("requerimientos", {"aplicacion_id": app.codigo, "codigo_req": "R3", "solicitud": {}})

    seco = script.migrar(db_sync, aplicar=False, aplicacion=app.codigo)
    r = seco["colecciones"]["requerimientos"]
    assert (r["total"], r["a_migrar"], r["conflictos"], r["correctos"]) == (2, 1, 0, 1)
    assert col.find_one({"_id": a_migrar})["solicitud"]["squad_id"] == sid

    with pytest.raises(ValueError):
        script.migrar(db_sync, aplicar=True)

    res = script.migrar(db_sync, aplicar=True, respaldo=tmp_path, aplicacion=app.codigo)
    assert res["respaldo"] and json.loads(Path(res["respaldo"]).read_text("utf-8"))
    assert col.find_one({"_id": a_migrar})["solicitud"]["squad_id"] == app.codigo
    assert col.find_one({"_id": correcto})["solicitud"]["squad_id"] == app.codigo

    # El conflicto se lista sin tocarlo, y una segunda corrida ya no migra nada.
    todo = script.migrar(db_sync, aplicar=False, aplicacion=otra.codigo)
    rc = todo["colecciones"]["requerimientos"]
    assert rc["conflictos"] == 1
    assert rc["detalle_conflictos"][0]["aplicacion_del_squad"] == app.codigo
    assert col.find_one({"_id": conflicto})["solicitud"]["squad_id"] == sid
    again = script.migrar(db_sync, aplicar=False, aplicacion=app.codigo)
    assert again["colecciones"]["requerimientos"]["a_migrar"] == 0


@pytest.mark.parametrize("valor,app,esperado", [
    ("app-x", "app-x", ("correcto", None)),
    ("app-fantasma", "app-x", ("desconocido", None)),
    ("abc123", "app-x", ("migrar", "app-x")),
    ("abc123", "app-y", ("conflicto", None)),
    ("", "app-x", ("ignorar", None)),
])
def test_decidir_conversion_verifica_codigos_reales(valor, app, esperado):
    assert _cargar_script().decidir_conversion(valor, app, SQUADS, APLICACIONES) == esperado


def test_decidir_conversion_squad_sin_aplicacion_id_no_migra():
    squads = {"abc123": None}
    estado, nuevo = _cargar_script().decidir_conversion("abc123", None, squads, APLICACIONES)
    assert (estado, nuevo) == ("conflicto", None)


def test_membresias_y_azdo_config_no_se_tocan():
    assert set(_cargar_script().COLECCIONES) == {"requerimientos", "capacidades", "backlog_futuro"}


async def test_migrar_lista_desconocidos_sin_tocarlos(fabrica_aplicacion, db_sync, limpieza):
    script = _cargar_script()
    app = await fabrica_aplicacion()
    id_desconocido = limpieza(
        "capacidades", {"aplicacion_id": app.codigo, "squad_id": "squad-que-no-existe"}
    )
    # Un squad sin aplicacion_id no debe provocar KeyError.
    limpieza("squads", {"nombre": "huerfano"})

    res = script.migrar(db_sync, aplicar=False, aplicacion=app.codigo)
    r = res["colecciones"]["capacidades"]
    assert r["desconocidos"] == 1 and r["a_migrar"] == 0
    assert r["detalle_desconocidos"][0]["squad_id"] == "squad-que-no-existe"
    assert db_sync["capacidades"].find_one({"_id": id_desconocido})["squad_id"] == (
        "squad-que-no-existe"
    )


def test_update_filtra_por_el_valor_viejo_de_squad_id(tmp_path):
    """El update_one incluye el valor viejo de squad_id además del _id."""
    script = _cargar_script()
    actualizaciones: list[tuple[dict, dict]] = []

    class ColeccionFalsa:
        def __init__(self, docs):
            self.docs = docs

        def find(self, filtro=None, proyeccion=None):
            return list(self.docs)

        def update_one(self, filtro, cambio):
            actualizaciones.append((filtro, cambio))

    class BaseFalsa:
        colecciones = {
            "squads": ColeccionFalsa([{"_id": "s1", "aplicacion_id": "app-x"}]),
            "aplicaciones": ColeccionFalsa([{"_id": 1, "codigo": "app-x"}]),
            "capacidades": ColeccionFalsa(
                [{"_id": 10, "aplicacion_id": "app-x", "squad_id": "s1"}]
            ),
        }

        def __getitem__(self, nombre):
            return self.colecciones.get(nombre, ColeccionFalsa([]))

    script.migrar(BaseFalsa(), aplicar=True, respaldo=tmp_path)
    assert actualizaciones == [
        ({"_id": 10, "squad_id": "s1"}, {"$set": {"squad_id": "app-x"}})
    ]
