# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Convierte los ``squad_id`` que son ``_id`` de un documento ``Squad`` en código de aplicación.

Squad == Aplicacion. Algunos registros guardan en ``squad_id`` el código de la aplicación
(registros manuales) y otros el ``_id`` de un documento de la colección ``squads``
(importados). Este script unifica al código de aplicación.

Campos revisados (colección -> campo):

    requerimientos -> solicitud.squad_id      capacidades -> squad_id
    backlog_futuro -> squad_id

``membresias.squad_id`` ya es código de aplicación y ``azdo_config.squad_id`` es una clave de
resolución (y su respaldo incluiría el PAT en claro): ambas quedan fuera.

Regla por documento (``decidir_conversion``):

  * ``squad_id`` vacío: se ignora (no cuenta en el total).
  * ``squad_id`` no es el ``_id`` de un Squad: si coincide con el código de una aplicación
    real se considera correcto; si no existe como aplicación es DESCONOCIDO (se lista, no se
    toca).
  * ``squad_id`` es el ``_id`` de un Squad: se migra al ``aplicacion_id`` de ese Squad SOLO si
    el ``aplicacion_id`` del documento coincide con él; si no, es CONFLICTO y no se toca.

Por defecto es DRY-RUN. Con ``--aplicar --respaldo <carpeta>`` escribe antes un respaldo JSON
de los documentos a modificar y luego actualiza solo ``squad_id`` (filtrando también por
el valor viejo, para no pisar un cambio concurrente). Idempotente: tras migrar,
los valores ya son códigos y una segunda corrida no encuentra nada que migrar. NO borra la
colección ``squads``. ``--aplicacion`` limita la corrida a una aplicación.

Uso (MONGO_URL / MONGO_DB se leen del entorno o de ``api/.env``):
    python scripts/migrar_squad_id_a_codigo.py                         # dry-run
    python scripts/migrar_squad_id_a_codigo.py --aplicar --respaldo ./respaldos
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

# colección -> ruta (con puntos) del campo squad_id
COLECCIONES: dict[str, str] = {
    "requerimientos": "solicitud.squad_id",
    "capacidades": "squad_id",
    "backlog_futuro": "squad_id",
}

IGNORAR = "ignorar"
CORRECTO = "correcto"
MIGRAR = "migrar"
CONFLICTO = "conflicto"
DESCONOCIDO = "desconocido"


def _leer_env() -> dict[str, str]:
    """Lee MONGO_URL / MONGO_DB: variables de entorno primero, luego ``api/.env``."""
    valores = {"MONGO_URL": "mongodb://localhost:27017", "MONGO_DB": "tecnoinsights_unificado"}
    ruta = Path(__file__).resolve().parent.parent / "api" / ".env"
    if ruta.is_file():
        for linea in ruta.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, _, valor = linea.partition("=")
            if clave.strip() in valores:
                valores[clave.strip()] = valor.strip().strip('"').strip("'")
    for clave in valores:
        if os.environ.get(clave):
            valores[clave] = os.environ[clave]
    return valores


def decidir_conversion(
    squad_id: Any,
    aplicacion_id: str | None,
    squads: dict[str, str | None],
    aplicaciones: set[str] | None = None,
) -> tuple[str, str | None]:
    """Decide qué hacer con un ``squad_id``. Función pura.

    ``squads`` mapea ``str(_id)`` de cada documento Squad a su ``aplicacion_id``.
    ``aplicaciones`` son los códigos reales de la colección ``aplicaciones``: si se pasa,
    un valor que no es ``_id`` de Squad ni código de aplicación es ``desconocido``.
    Devuelve ``(estado, nuevo_valor)``: ``nuevo_valor`` solo es no nulo en ``migrar``.
    """
    if squad_id is None or str(squad_id).strip() == "":
        return IGNORAR, None
    valor = str(squad_id)
    if valor not in squads:
        if aplicaciones is not None and valor not in aplicaciones:
            return DESCONOCIDO, None
        return CORRECTO, None
    codigo = squads[valor]
    if codigo is not None and aplicacion_id is not None and aplicacion_id == codigo:
        return MIGRAR, codigo
    return CONFLICTO, None


def _valor_en(doc: dict[str, Any], ruta: str) -> Any:
    actual: Any = doc
    for parte in ruta.split("."):
        if not isinstance(actual, dict):
            return None
        actual = actual.get(parte)
    return actual


def migrar(
    db: Database,
    aplicar: bool = False,
    respaldo: str | Path | None = None,
    aplicacion: str | None = None,
) -> dict[str, Any]:
    """Revisa (y con ``aplicar`` migra) los ``squad_id``. Devuelve el resumen.

    Resumen: ``aplicado``, ``colecciones`` ({nombre: {total, a_migrar, conflictos, correctos,
    desconocidos, detalle_conflictos, detalle_desconocidos, duplicados}}), ``respaldo``
    (ruta o None).
    """
    if aplicar and not respaldo:
        raise ValueError("--aplicar exige indicar --respaldo (directorio del respaldo).")

    squads = {str(s["_id"]): s.get("aplicacion_id") for s in db["squads"].find({})}
    aplicaciones = {
        a["codigo"] for a in db["aplicaciones"].find({}, {"codigo": 1}) if a.get("codigo")
    }
    colecciones: dict[str, dict[str, Any]] = {}
    a_modificar: dict[str, list[tuple[Any, str, Any]]] = {}
    for nombre, campo in COLECCIONES.items():
        filtro: dict[str, Any] = {campo: {"$nin": [None, ""]}}
        if aplicacion:
            filtro["aplicacion_id"] = aplicacion
        res: dict[str, Any] = {
            "total": 0, "a_migrar": 0, "conflictos": 0, "correctos": 0, "desconocidos": 0,
            "detalle_conflictos": [], "detalle_desconocidos": [], "duplicados": [],
        }
        cambios: list[tuple[Any, str, Any]] = []
        for doc in db[nombre].find(filtro, {"aplicacion_id": 1, campo: 1}):
            valor = _valor_en(doc, campo)
            estado, nuevo = decidir_conversion(
                valor, doc.get("aplicacion_id"), squads, aplicaciones
            )
            if estado == IGNORAR:
                continue
            res["total"] += 1
            if estado == MIGRAR and nuevo is not None:
                res["a_migrar"] += 1
                cambios.append((doc["_id"], nuevo, valor))
            elif estado == CONFLICTO:
                res["conflictos"] += 1
                res["detalle_conflictos"].append(
                    {
                        "_id": str(doc["_id"]),
                        "aplicacion_id": doc.get("aplicacion_id"),
                        "squad_id": str(valor),
                        "aplicacion_del_squad": squads[str(valor)],
                    }
                )
            elif estado == DESCONOCIDO:
                res["desconocidos"] += 1
                res["detalle_desconocidos"].append(
                    {
                        "_id": str(doc["_id"]),
                        "aplicacion_id": doc.get("aplicacion_id"),
                        "squad_id": str(valor),
                    }
                )
            else:
                res["correctos"] += 1
        colecciones[nombre] = res
        a_modificar[nombre] = cambios

    ruta_respaldo: str | None = None
    if aplicar and any(a_modificar.values()):
        ahora = datetime.now(UTC)
        directorio = Path(str(respaldo))
        directorio.mkdir(parents=True, exist_ok=True)
        respaldo_docs = {
            nombre: list(db[nombre].find({"_id": {"$in": [i for i, _, _ in cambios]}}))
            for nombre, cambios in a_modificar.items()
            if cambios
        }
        destino = directorio / f"squad_id_a_codigo_{ahora:%Y%m%d_%H%M%S_%f}.json"
        destino.write_text(
            json.dumps(respaldo_docs, default=str, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        ruta_respaldo = str(destino)
        for nombre, cambios in a_modificar.items():
            campo = COLECCIONES[nombre]
            for _id, nuevo, viejo in cambios:
                try:
                    # Filtra también por el valor viejo: no pisa un cambio concurrente.
                    db[nombre].update_one({"_id": _id, campo: viejo}, {"$set": {campo: nuevo}})
                except DuplicateKeyError:
                    # Choca con un índice único (ya existe el registro con el código): se omite.
                    colecciones[nombre]["duplicados"].append(str(_id))

    return {"aplicado": aplicar, "colecciones": colecciones, "respaldo": ruta_respaldo}


def _imprimir(resumen: dict[str, Any]) -> None:
    prefijo = "" if resumen["aplicado"] else "[dry-run] "
    print(f"{prefijo}Resumen de squad_id por coleccion")
    for nombre, r in resumen["colecciones"].items():
        print(
            f"  - {nombre} ({COLECCIONES[nombre]}): total={r['total']} "
            f"a_migrar={r['a_migrar']} conflictos={r['conflictos']} "
            f"desconocidos={r['desconocidos']} correctos={r['correctos']}"
        )
        for d in r["detalle_desconocidos"]:
            print(
                f"      desconocido _id={d['_id']} aplicacion={d['aplicacion_id']} "
                f"squad_id={d['squad_id']} (no es _id de Squad ni codigo de aplicacion)"
            )
        for d in r["duplicados"]:
            print(f"      omitido por indice unico _id={d} (no se migro)")
        for c in r["detalle_conflictos"]:
            print(
                f"      conflicto _id={c['_id']} aplicacion={c['aplicacion_id']} "
                f"squad_id={c['squad_id']} (squad de {c['aplicacion_del_squad']})"
            )
    if resumen["respaldo"]:
        print(f"Respaldo escrito en {resumen['respaldo']}")
    if not resumen["aplicado"]:
        print("Dry-run: no se modifico nada. Use --aplicar --respaldo <directorio>.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--aplicar", action="store_true", help="Ejecuta los cambios.")
    parser.add_argument(
        "--respaldo", help="Directorio del respaldo JSON (obligatorio con --aplicar)."
    )
    parser.add_argument("--aplicacion", help="Limita la corrida a un aplicacion_id.")
    args = parser.parse_args()
    if args.aplicar and not args.respaldo:
        parser.error("--aplicar exige --respaldo <directorio>")

    env = _leer_env()
    cliente: MongoClient = MongoClient(env["MONGO_URL"])
    try:
        resumen = migrar(cliente[env["MONGO_DB"]], args.aplicar, args.respaldo, args.aplicacion)
    finally:
        cliente.close()
    _imprimir(resumen)
    return 0


if __name__ == "__main__":
    sys.exit(main())
