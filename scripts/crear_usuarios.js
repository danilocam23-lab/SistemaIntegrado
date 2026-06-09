// ================================================================
// crear_usuarios.js
// Crea el usuario superadmin inicial en la coleccion "usuarios".
// Compatible con mongo shell (MongoDB 6.0)
//
// Uso: mongo localhost:27017/tecnoinsights_unificado crear_usuarios.js
// ================================================================

var dbName = "tecnoinsights_unificado";
var mydb = db.getSiblingDB(dbName);

print("=== Creando usuarios en: " + dbName + " ===");
print("");

// --- Superadmin ------------------------------------------------------
var superadminEmail = "admin@hitss.com";
var existe = mydb.usuarios.findOne({ "email": superadminEmail });

if (existe) {
    print("  [EXISTE] Superadmin ya existe: " + superadminEmail);
} else {
    mydb.usuarios.insertOne({
        "nombre":               "Administrador",
        "email":                superadminEmail,
        "password_hash":        "$2b$12$SoIVCGwlhKrg0Xh6oGBJYeGHCYP/gpy3wkTwOwVp9CuhBvg5QecRy",
        "rol":                  "superadmin",
        "activo":               true,
        "aplicaciones_codigos": ["epm-hitss"],
        "permisos": [
            "crear_aplicaciones",
            "gestionar_todas_las_aplicaciones",
            "gestionar_aplicaciones_asignadas",
            "acceso_modulo_admin",
            "ver_consolidado"
        ],
        "creado_en":      new Date(),
        "actualizado_en": new Date()
    });
    print("  [CREADO] Superadmin: " + superadminEmail + " / Admin123*");
}

// --- Resumen ---------------------------------------------------------
print("");
print("=== Resumen ===");
print("  Usuarios totales: " + mydb.usuarios.countDocuments({}));
print("");
print("[OK] Usuarios listos.");
