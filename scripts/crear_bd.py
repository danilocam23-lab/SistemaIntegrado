"""Crea la base de datos, colecciones e índices del Sistema Integrado HITSS.

Ejecutado por crear-bd.bat usando el venv del backend (PyMongo).
"""
import sys

from pymongo import MongoClient


MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "tecnoinsights_unificado"

COLECCIONES = [
    "aplicaciones",
    "usuarios",
    "personas",
    "categorias",
    "configuracion",
    "bitacora",
    "aplicativos",
    "squads",
    "tarifas",
    "festivos",
    "actas_trabajo",
    "ordenes_compra",
    "requerimientos",
    "asignaciones",
    "capacidades",
    "estimaciones",
    "azdo_work_items",
    "azdo_sync_log",
    "azdo_config",
]

# (coleccion, campos, opciones)
INDICES = [
    ("aplicaciones",    [("codigo", 1)],                                                           {"unique": True,  "name": "uq_codigo"}),
    ("usuarios",        [("email", 1)],                                                            {"unique": True,  "name": "uq_email"}),
    ("personas",        [("aplicacion_id", 1), ("email", 1)],                                      {"name": "ix_app_email"}),
    ("categorias",      [("aplicacion_id", 1)],                                                    {"name": "ix_app"}),
    ("configuracion",   [("aplicacion_id", 1), ("clave", 1)],                                      {"unique": True,  "name": "uq_app_clave"}),
    ("bitacora",        [("aplicacion_id", 1), ("entidad_tipo", 1)],                               {"name": "ix_app_entidad_tipo"}),
    ("bitacora",        [("entidad_id", 1)],                                                       {"name": "ix_entidad_id"}),
    ("aplicativos",     [("aplicacion_id", 1), ("nombre", 1)],                                     {"name": "ix_app_nombre"}),
    ("squads",          [("aplicacion_id", 1), ("nombre", 1)],                                     {"name": "ix_app_nombre"}),
    ("tarifas",         [("aplicacion_id", 1), ("anio", 1)],                                       {"name": "ix_app_anio"}),
    ("festivos",        [("aplicacion_id", 1), ("fecha", 1)],                                      {"name": "ix_app_fecha"}),
    ("actas_trabajo",   [("aplicacion_id", 1), ("codigo", 1)],                                     {"name": "ix_app_codigo"}),
    ("ordenes_compra",  [("aplicacion_id", 1), ("numero", 1)],                                     {"name": "ix_app_numero"}),
    ("requerimientos",  [("aplicacion_id", 1), ("codigo_req", 1)],                                 {"unique": True,  "name": "uq_app_codigo_req"}),
    ("requerimientos",  [("aplicacion_id", 1), ("estado", 1)],                                     {"name": "ix_app_estado"}),
    ("asignaciones",    [("aplicacion_id", 1), ("persona_id", 1)],                                 {"name": "ix_app_persona"}),
    ("asignaciones",    [("aplicacion_id", 1), ("categoria_id", 1)],                               {"name": "ix_app_categoria"}),
    ("capacidades",     [("aplicacion_id", 1), ("scope", 1), ("mes", 1)],                          {"name": "ix_app_scope_mes"}),
    ("estimaciones",    [("aplicacion_id", 1), ("requerimiento_id", 1)],                           {"name": "ix_app_req"}),
    ("azdo_work_items", [("aplicacion_id", 1), ("azdo_id", 1)],                                    {"unique": True,  "name": "uq_app_azdo_id"}),
    ("azdo_sync_log",   [("aplicacion_id", 1), ("sprint_id", 1)],                                  {"name": "ix_app_sprint"}),
    ("azdo_config",     [("aplicacion_id", 1), ("scope", 1), ("squad_id", 1), ("usuario_id", 1)],  {"unique": True,  "name": "uq_app_scope_squad_user"}),
]


def main() -> int:
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
    except Exception as e:
        print(f"  [ERROR] No se pudo conectar a MongoDB: {e}")
        return 1

    db = client[DB_NAME]
    existentes = set(db.list_collection_names())

    # --- Colecciones ---
    print("=== Creando colecciones ===")
    creadas = 0
    for col in COLECCIONES:
        if col not in existentes:
            db.create_collection(col)
            print(f"  [CREADA]   {col}")
            creadas += 1
        else:
            print(f"  [EXISTE]   {col}")

    # --- Índices ---
    print()
    print(f"=== Creando indices ({len(INDICES)}) ===")
    idx_ok = 0
    for col_name, campos, opts in INDICES:
        nombre = opts.get("name", "")
        try:
            db[col_name].create_index(campos, **opts)
            print(f"  [OK] {col_name}: {nombre}")
            idx_ok += 1
        except Exception as e:
            print(f"  [ERROR] {col_name}.{nombre}: {e}")

    # --- Resumen ---
    print()
    print("=== Resumen ===")
    print(f"  Colecciones totales : {len(db.list_collection_names())}")
    print(f"  Colecciones creadas : {creadas}")
    print(f"  Indices procesados  : {idx_ok}/{len(INDICES)}")
    print()
    print(f'  [OK] Base de datos "{DB_NAME}" lista.')
    print()
    print("  NOTA: El usuario superadmin y datos iniciales se crean")
    print("  automaticamente al primer arranque del backend (bootstrap.py).")

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
