"""Constantes y utilidades del RBAC configurable."""

PERM_ADMIN_ACCESO = "admin.acceso"
PERM_CONSOLIDADO_VER = "consolidado.ver"

PERMISOS_CATALOGO: list[str] = [
    "dashboard.ver",
    "dashboard.estados.ver",
    "dashboard.squad.ver",
    "cifras.ver",
    "requerimientos.ver",
    "requerimientos.crear",
    "requerimientos.editar",
    "requerimientos.eliminar",
    "entregas_actas.ver",
    "personas.ver",
    "personas.crear",
    "personas.editar",
    "personas.eliminar",
    "asignaciones.ver",
    "asignaciones.editar",
    "capacidades.ver",
    "capacidades.editar",
    "roadmap.ver",
    "azure_devops.ver",
    "estimaciones.ver",
    "aplicaciones.ver",
    "aplicaciones.crear",
    "aplicaciones.editar",
    "admin.usuarios.ver",
    "admin.usuarios.crear",
    "admin.usuarios.editar",
    "admin.roles.ver",
    "admin.roles.crear",
    "admin.roles.editar",
    "admin.roles.eliminar",
    "admin.importacion.ver",
    "admin.importacion.ejecutar",
    "admin.endpoints.ver",
    "admin.configuracion.ver",
    "admin.configuracion.editar",
    PERM_ADMIN_ACCESO,
    PERM_CONSOLIDADO_VER,
]

ROLES_BASE: list[dict] = [
    {
        "clave": "superadmin",
        "nombre": "Superadministrador",
        "descripcion": "Acceso total al sistema.",
        "es_sistema": True,
        "permisos": ["*"],
    },
    {
        "clave": "admin_app",
        "nombre": "Administrador de aplicación",
        "descripcion": "Administra usuarios y datos de sus squads asignados.",
        "es_sistema": True,
        "permisos": [
            "dashboard.ver",
            "dashboard.estados.ver",
            "dashboard.squad.ver",
            "cifras.ver",
            "requerimientos.ver",
            "entregas_actas.ver",
            "personas.ver",
            "personas.crear",
            "personas.editar",
            "personas.eliminar",
            "asignaciones.ver",
            "asignaciones.editar",
            "capacidades.ver",
            "capacidades.editar",
            "roadmap.ver",
            "azure_devops.ver",
            "estimaciones.ver",
            "aplicaciones.ver",
            "aplicaciones.editar",
            "admin.usuarios.ver",
            "admin.usuarios.crear",
            "admin.usuarios.editar",
            "admin.roles.ver",
            "admin.importacion.ver",
            "admin.importacion.ejecutar",
            PERM_ADMIN_ACCESO,
            PERM_CONSOLIDADO_VER,
        ],
    },
    {
        "clave": "editor",
        "nombre": "Editor",
        "descripcion": "Usuario operativo con acceso de edición funcional.",
        "es_sistema": True,
        "permisos": [
            "dashboard.ver",
            "dashboard.estados.ver",
            "dashboard.squad.ver",
            "cifras.ver",
            "requerimientos.ver",
            "requerimientos.crear",
            "requerimientos.editar",
            "entregas_actas.ver",
            "personas.ver",
            "asignaciones.ver",
            "asignaciones.editar",
            "capacidades.ver",
            "capacidades.editar",
            "roadmap.ver",
            "azure_devops.ver",
            "estimaciones.ver",
        ],
    },
    {
        "clave": "viewer",
        "nombre": "Visualizador",
        "descripcion": "Usuario solo lectura.",
        "es_sistema": True,
        "permisos": [
            "dashboard.ver",
            "dashboard.estados.ver",
            "dashboard.squad.ver",
            "cifras.ver",
            "requerimientos.ver",
            "entregas_actas.ver",
            "personas.ver",
            "asignaciones.ver",
            "capacidades.ver",
            "roadmap.ver",
            "azure_devops.ver",
            "estimaciones.ver",
        ],
    },
]


def normalizar_permisos(permisos: list[str]) -> list[str]:
    vistos: set[str] = set()
    resultado: list[str] = []
    for permiso in permisos:
        p = (permiso or "").strip()
        if not p:
            continue
        if p in vistos:
            continue
        vistos.add(p)
        resultado.append(p)
    return resultado
