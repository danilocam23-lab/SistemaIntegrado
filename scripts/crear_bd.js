// ================================================================
// crear_bd.js
// Script de creacion de BD - Sistema Integrado HITSS
// Compatible con mongo shell (MongoDB 6.0)
// ================================================================

var dbName = "tecnoinsights_unificado";
var mydb = db.getSiblingDB(dbName);

print("=== Usando base de datos: " + dbName + " ===");
print("");

// --- Crear colecciones -----------------------------------------------
var colecciones = [
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
    "azdo_config"
];

var existentes = mydb.getCollectionNames();
var creadas = 0;

colecciones.forEach(function(col) {
    if (existentes.indexOf(col) === -1) {
        mydb.createCollection(col);
        print("  [CREADA]   " + col);
        creadas++;
    } else {
        print("  [EXISTE]   " + col);
    }
});

// --- Crear indices ---------------------------------------------------
print("");
print("=== Creando indices ===");

// aplicaciones
mydb.aplicaciones.createIndex({ "codigo": 1 }, { unique: true, name: "uq_codigo" });
print("  [OK] aplicaciones: uq_codigo (unique)");

// usuarios
mydb.usuarios.createIndex({ "email": 1 }, { unique: true, name: "uq_email" });
print("  [OK] usuarios: uq_email (unique)");

// personas
mydb.personas.createIndex({ "aplicacion_id": 1, "email": 1 }, { name: "ix_app_email" });
print("  [OK] personas: ix_app_email");

// categorias
mydb.categorias.createIndex({ "aplicacion_id": 1 }, { name: "ix_app" });
print("  [OK] categorias: ix_app");

// configuracion
mydb.configuracion.createIndex({ "aplicacion_id": 1, "clave": 1 }, { unique: true, name: "uq_app_clave" });
print("  [OK] configuracion: uq_app_clave (unique)");

// bitacora
mydb.bitacora.createIndex({ "aplicacion_id": 1, "entidad_tipo": 1 }, { name: "ix_app_entidad_tipo" });
mydb.bitacora.createIndex({ "entidad_id": 1 }, { name: "ix_entidad_id" });
print("  [OK] bitacora: ix_app_entidad_tipo, ix_entidad_id");

// aplicativos
mydb.aplicativos.createIndex({ "aplicacion_id": 1, "nombre": 1 }, { name: "ix_app_nombre" });
print("  [OK] aplicativos: ix_app_nombre");

// squads
mydb.squads.createIndex({ "aplicacion_id": 1, "nombre": 1 }, { name: "ix_app_nombre" });
print("  [OK] squads: ix_app_nombre");

// tarifas
mydb.tarifas.createIndex({ "aplicacion_id": 1, "anio": 1 }, { name: "ix_app_anio" });
print("  [OK] tarifas: ix_app_anio");

// festivos
mydb.festivos.createIndex({ "aplicacion_id": 1, "fecha": 1 }, { name: "ix_app_fecha" });
print("  [OK] festivos: ix_app_fecha");

// actas_trabajo
mydb.actas_trabajo.createIndex({ "aplicacion_id": 1, "codigo": 1 }, { name: "ix_app_codigo" });
print("  [OK] actas_trabajo: ix_app_codigo");

// ordenes_compra
mydb.ordenes_compra.createIndex({ "aplicacion_id": 1, "numero": 1 }, { name: "ix_app_numero" });
print("  [OK] ordenes_compra: ix_app_numero");

// requerimientos
mydb.requerimientos.createIndex({ "aplicacion_id": 1, "codigo_req": 1 }, { unique: true, name: "uq_app_codigo_req" });
mydb.requerimientos.createIndex({ "aplicacion_id": 1, "estado": 1 }, { name: "ix_app_estado" });
print("  [OK] requerimientos: uq_app_codigo_req (unique), ix_app_estado");

// asignaciones
mydb.asignaciones.createIndex({ "aplicacion_id": 1, "persona_id": 1 }, { name: "ix_app_persona" });
mydb.asignaciones.createIndex({ "aplicacion_id": 1, "categoria_id": 1 }, { name: "ix_app_categoria" });
print("  [OK] asignaciones: ix_app_persona, ix_app_categoria");

// capacidades
mydb.capacidades.createIndex({ "aplicacion_id": 1, "scope": 1, "mes": 1 }, { name: "ix_app_scope_mes" });
print("  [OK] capacidades: ix_app_scope_mes");

// estimaciones
mydb.estimaciones.createIndex({ "aplicacion_id": 1, "requerimiento_id": 1 }, { name: "ix_app_req" });
print("  [OK] estimaciones: ix_app_req");

// azdo_work_items
mydb.azdo_work_items.createIndex({ "aplicacion_id": 1, "azdo_id": 1 }, { unique: true, name: "uq_app_azdo_id" });
print("  [OK] azdo_work_items: uq_app_azdo_id (unique)");

// azdo_sync_log
mydb.azdo_sync_log.createIndex({ "aplicacion_id": 1, "sprint_id": 1 }, { name: "ix_app_sprint" });
print("  [OK] azdo_sync_log: ix_app_sprint");

// azdo_config
mydb.azdo_config.createIndex({ "aplicacion_id": 1, "scope": 1, "squad_id": 1, "usuario_id": 1 }, { unique: true, name: "uq_app_scope_squad_user" });
print("  [OK] azdo_config: uq_app_scope_squad_user (unique)");

// --- Resumen ---------------------------------------------------------
print("");
print("=== Resumen ===");
print("  Colecciones totales: " + mydb.getCollectionNames().length);
print("  Colecciones nuevas:  " + creadas);
print("");
print("[OK] Base de datos '" + dbName + "' lista.");
print("");
print("NOTA: El usuario superadmin y los datos iniciales se crean");
print("automaticamente al primer arranque del backend (bootstrap.py).");
