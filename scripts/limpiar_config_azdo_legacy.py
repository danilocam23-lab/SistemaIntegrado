# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Limpia de ``configuracion`` las claves legacy de Azure DevOps.

La conexión a Azure DevOps (URL de la organización, PAT y proyecto por defecto) se
toma solo de la colección ``azdo_config`` (vista Azure DevOps). Este script retira los
parámetros legacy de ``configuracion``:

    azdo_org_url, azdo_pat, azdo_sync_interval, azdo_default_project,
    azdo2_org_url, azdo2_pat, azdo2_sync_interval, azdo2_default_project

Por defecto es DRY-RUN (solo informa). Con ``--aplicar``:

  1. Escribe un respaldo JSON de los documentos que va a borrar en ``--respaldo``
     (obligatorio). SENSIBLE: el JSON contiene PAT en claro; guárdalo con cuidado.
  2. Migra: por aplicación con ``azdo_org_url`` y ``azdo_pat`` no vacíos (``azdo2_*`` para
     EPM) y SIN ``AzdoConfig`` de scope ``app`` (``app_epm``), crea esa ``AzdoConfig``
     (con ``azdo_default_project`` / ``azdo2_default_project`` si existe).
  3. Borra de ``configuracion`` todos los registros con esas claves.

Idempotente: una segunda corrida no encuentra nada que migrar ni borrar. Nunca imprime
valores de PAT, solo su longitud. Respeta ``aplicacion_id``; ``--aplicacion`` limita la
corrida a una aplicación.

Uso (MONGO_URL / MONGO_DB se leen del entorno o de ``api/.env``):
    python scripts/limpiar_config_azdo_legacy.py                       # dry-run
    python scripts/limpiar_config_azdo_legacy.py --aplicar --respaldo ./respaldos
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

CLAVES_LEGACY = (
    "azdo_org_url",
    "azdo_pat",
    "azdo_sync_interval",
    "azdo_default_project",
    "azdo2_org_url",
    "azdo2_pat",
    "azdo2_sync_interval",
    "azdo2_default_project",
)

# target -> (prefijo de clave legacy, scope de AzdoConfig)
_TARGETS = {"hitss": ("azdo_", "app"), "epm": ("azdo2_", "app_epm")}


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


def limpiar(
    db: Database,
    aplicar: bool = False,
    respaldo: str | Path | None = None,
    aplicacion: str | None = None,
) -> dict[str, Any]:
    """Migra y borra la config legacy de Azure DevOps. Devuelve el resumen.

    Sin ``aplicar`` no escribe nada. Con ``aplicar`` exige ``respaldo`` (directorio).
    Resumen: ``migrados`` (lista de {aplicacion_id, scope, ...}), ``sin_migrar``,
    ``borrados`` ({clave: {aplicacion_id: n}}), ``respaldo`` (ruta o None).
    """
    if aplicar and not respaldo:
        raise ValueError("--aplicar exige indicar --respaldo (directorio del respaldo).")

    filtro: dict[str, Any] = {"clave": {"$in": list(CLAVES_LEGACY)}}
    if aplicacion:
        filtro["aplicacion_id"] = aplicacion
    docs = list(db["configuracion"].find(filtro))

    por_app: dict[str, dict[str, str]] = {}
    for doc in docs:
        valor = (doc.get("valor") or "").strip()
        por_app.setdefault(doc["aplicacion_id"], {})[doc["clave"]] = valor

    migrados: list[dict[str, Any]] = []
    sin_migrar: list[dict[str, str]] = []
    nuevas: list[dict[str, Any]] = []
    ahora = datetime.now(UTC)
    for app_id in sorted(por_app):
        valores = por_app[app_id]
        for target, (prefijo, scope) in _TARGETS.items():
            org = valores.get(f"{prefijo}org_url", "")
            pat = valores.get(f"{prefijo}pat", "")
            proyecto = valores.get(f"{prefijo}default_project", "")
            if not (org and pat):
                if org or pat or proyecto:
                    sin_migrar.append(
                        {"aplicacion_id": app_id, "target": target, "motivo": "faltan URL o PAT"}
                    )
                continue
            if db["azdo_config"].find_one({"aplicacion_id": app_id, "scope": scope}):
                sin_migrar.append(
                    {"aplicacion_id": app_id, "target": target, "motivo": "ya tiene AzdoConfig"}
                )
                continue
            nuevas.append(
                {
                    "aplicacion_id": app_id,
                    "scope": scope,
                    "squad_id": None,
                    "usuario_id": None,
                    "org_url": org,
                    "pat": pat,
                    "default_project": proyecto,
                    "sync_interval": "manual",
                    "learned_fields": None,
                    "tipos_esquema_activos": [],
                    "creado_en": ahora,
                    "actualizado_en": ahora,
                }
            )
            migrados.append(
                {
                    "aplicacion_id": app_id,
                    "scope": scope,
                    "pat_longitud": len(pat),
                    "default_project": proyecto,
                }
            )

    borrados: dict[str, dict[str, int]] = {}
    for doc in docs:
        por_clave = borrados.setdefault(doc["clave"], {})
        por_clave[doc["aplicacion_id"]] = por_clave.get(doc["aplicacion_id"], 0) + 1

    ruta_respaldo: str | None = None
    if aplicar and docs:
        directorio = Path(str(respaldo))
        directorio.mkdir(parents=True, exist_ok=True)
        destino = directorio / f"configuracion_azdo_legacy_{ahora:%Y%m%d_%H%M%S_%f}.json"
        destino.write_text(
            json.dumps(docs, default=str, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        ruta_respaldo = str(destino)
        if nuevas:
            db["azdo_config"].insert_many(nuevas)
        db["configuracion"].delete_many({"_id": {"$in": [d["_id"] for d in docs]}})

    return {
        "aplicado": aplicar,
        "migrados": migrados,
        "sin_migrar": sin_migrar,
        "borrados": borrados,
        "respaldo": ruta_respaldo,
    }


def _imprimir(resumen: dict[str, Any]) -> None:
    prefijo = "" if resumen["aplicado"] else "[dry-run] "
    print(f"{prefijo}Migrados a azdo_config: {len(resumen['migrados'])}")
    for m in resumen["migrados"]:
        print(
            f"  - {m['aplicacion_id']} scope={m['scope']} "
            f"(PAT: {m['pat_longitud']} caracteres) proyecto={m['default_project'] or '-'}"
        )
    for s in resumen["sin_migrar"]:
        print(f"  * No migrado: {s['aplicacion_id']} [{s['target']}] - {s['motivo']}")
    total = sum(sum(v.values()) for v in resumen["borrados"].values())
    print(f"{prefijo}Registros de configuracion a borrar/borrados: {total}")
    for clave in sorted(resumen["borrados"]):
        detalle = ", ".join(f"{a}: {n}" for a, n in sorted(resumen["borrados"][clave].items()))
        print(f"  - {clave}: {detalle}")
    if resumen["respaldo"]:
        print(f"Respaldo escrito en {resumen['respaldo']}")
        print("ATENCION: el respaldo contiene PAT en claro; es sensible, protéjalo o elimínelo.")
    if not resumen["aplicado"]:
        print("Dry-run: no se modificó nada. Use --aplicar --respaldo <directorio>.")


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
        resumen = limpiar(cliente[env["MONGO_DB"]], args.aplicar, args.respaldo, args.aplicacion)
    finally:
        cliente.close()
    _imprimir(resumen)
    return 0


if __name__ == "__main__":
    sys.exit(main())
