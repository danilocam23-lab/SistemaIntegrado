# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Elimina el campo retirado ``motivo_cierre`` de la colección ``requerimientos``.

El campo "Motivo de cierre" se quitó del modelo, la API y el frontend. Este script
retira el dato residual de los documentos existentes (todas las aplicaciones, salvo que se
use ``--aplicacion``).

Además limpia la clave ``motivoCierre`` de las listas de columnas guardadas en
``configuracion`` (claves que contienen "columnas", valor = lista JSON). Hoy las
preferencias de columnas de requerimientos / entregas-actas viven en ``localStorage`` del
navegador (no en MongoDB), así que normalmente no habrá nada que limpiar ahí.

Por defecto es SIMULACIÓN (no escribe). Con ``--aplicar``:

  1. Pide confirmación escrita (``--si`` la omite) y recuerda hacer backup con
     ``bat\\backup-mongodb.bat``.
  2. ``update_many({motivo_cierre: {$exists: true}}, {$unset: {motivo_cierre: ""}})``.
  3. Quita ``motivoCierre`` de las listas de columnas de ``configuracion``.

Idempotente: una segunda corrida no encuentra nada. NO toca ``bitacora`` (los
``datos_antes`` / ``datos_despues`` históricos se conservan por auditoría).

Uso (MONGO_URL / MONGO_DB se leen del entorno o de ``api/.env``):
    python scripts/eliminar_motivo_cierre.py                    # simulación
    python scripts/eliminar_motivo_cierre.py --aplicar          # pide confirmación
    python scripts/eliminar_motivo_cierre.py --aplicar --si     # sin confirmación
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from pymongo import MongoClient
from pymongo.database import Database

CAMPO = "motivo_cierre"
CLAVE_COLUMNA = "motivoCierre"
MAX_EJEMPLOS = 10


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


def _no_vacio(valor: Any) -> bool:
    return valor is not None and str(valor).strip() != ""


def _columnas_sin_clave(valor: Any) -> list[str] | None:
    """Si ``valor`` es una lista JSON (o lista) con ``motivoCierre``, la devuelve sin él."""
    lista = valor
    if isinstance(valor, str):
        try:
            lista = json.loads(valor)
        except ValueError:
            return None
    if not isinstance(lista, list) or CLAVE_COLUMNA not in lista:
        return None
    return [c for c in lista if c != CLAVE_COLUMNA]


def _config_afectada(db: Database, aplicacion: str | None) -> list[dict[str, Any]]:
    filtro: dict[str, Any] = {"clave": {"$regex": "columnas", "$options": "i"}}
    if aplicacion:
        filtro["aplicacion_id"] = aplicacion
    return [d for d in db["configuracion"].find(filtro) if _columnas_sin_clave(d.get("valor"))
            is not None]


def analizar(db: Database, aplicacion: str | None = None) -> dict[str, Any]:
    """Cuenta lo que se limpiaría. No escribe."""
    filtro: dict[str, Any] = {CAMPO: {"$exists": True}}
    if aplicacion:
        filtro["aplicacion_id"] = aplicacion
    docs = list(db["requerimientos"].find(filtro, {"codigo_req": 1, CAMPO: 1}))
    con_valor = [d for d in docs if _no_vacio(d.get(CAMPO))]
    return {
        "con_campo": len(docs),
        "con_valor": len(con_valor),
        "ejemplos": [(d.get("codigo_req"), d[CAMPO]) for d in con_valor[:MAX_EJEMPLOS]],
        "config": [(d.get("aplicacion_id"), d.get("clave")) for d in
                   _config_afectada(db, aplicacion)],
    }


def eliminar(db: Database, aplicacion: str | None = None) -> dict[str, int]:
    """Ejecuta la limpieza. Devuelve ``requerimientos`` y ``config`` modificados."""
    filtro: dict[str, Any] = {CAMPO: {"$exists": True}}
    if aplicacion:
        filtro["aplicacion_id"] = aplicacion
    modificados = db["requerimientos"].update_many(filtro, {"$unset": {CAMPO: ""}}).modified_count
    config = 0
    for doc in _config_afectada(db, aplicacion):
        nueva = _columnas_sin_clave(doc.get("valor")) or []
        valor = json.dumps(nueva, ensure_ascii=False) if isinstance(doc["valor"], str) else nueva
        db["configuracion"].update_one({"_id": doc["_id"]}, {"$set": {"valor": valor}})
        config += 1
    return {"requerimientos": modificados, "config": config}


def _imprimir_analisis(a: dict[str, Any], prefijo: str) -> None:
    print(f"{prefijo}Requerimientos con el campo '{CAMPO}': {a['con_campo']}")
    print(f"{prefijo}  con valor no vacío: {a['con_valor']}")
    for codigo, valor in a["ejemplos"]:
        print(f"    {codigo}: {valor!r}")
    print(f"{prefijo}Listas de columnas en configuracion con '{CLAVE_COLUMNA}': {len(a['config'])}")
    for app, clave in a["config"]:
        print(f"    {app}: {clave}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--aplicar", action="store_true", help="Ejecuta los cambios.")
    parser.add_argument("--si", action="store_true", help="Omite la confirmación escrita.")
    parser.add_argument("--aplicacion", help="Limita la corrida a un aplicacion_id.")
    args = parser.parse_args()

    env = _leer_env()
    cliente: MongoClient = MongoClient(env["MONGO_URL"])
    try:
        db = cliente[env["MONGO_DB"]]
        analisis = analizar(db, args.aplicacion)
        if not args.aplicar:
            _imprimir_analisis(analisis, "[simulación] ")
            print("Simulación: no se modificó nada. Use --aplicar para ejecutar.")
            return 0
        _imprimir_analisis(analisis, "")
        print("RECUERDE hacer backup antes: bat\\backup-mongodb.bat")
        if not args.si:
            if input(f"Escriba 'ELIMINAR' para quitar '{CAMPO}' de {env['MONGO_DB']}: ") != (
                "ELIMINAR"
            ):
                print("Cancelado.")
                return 1
        resultado = eliminar(db, args.aplicacion)
        print(f"Requerimientos modificados: {resultado['requerimientos']}")
        print(f"Listas de columnas limpiadas en configuracion: {resultado['config']}")
    finally:
        cliente.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
