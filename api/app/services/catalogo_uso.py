"""Vocabulario cerrado de la telemetría de uso (espejo de ``web/src/analitica/catalogo.ts``).

Criterio de validación de los campos libres de ``POST /auditoria/eventos-uso``:

* ``screen`` y ``module``: deben pertenecer a las listas fijas de abajo; si no, el evento
  se descarta. Al añadir una pantalla/módulo en el frontend hay que añadirlo aquí.
* ``interaction_id`` (también ``form_id``/``export_id``, que viajan en ese campo): se
  acepta si es un identificador conocido (formularios, exportaciones, controles) o si
  empieza por un prefijo de grupo conocido (``requerimiento.``, ``menu.``...; ``control.``
  son los ids automáticos de la instrumentación del frontend). Los ids con formato válido
  ``[a-z0-9_.:-]{1,80}`` pero fuera de ambos consumen un cupo diario por usuario
  (``eventos_uso_ids_nuevos_por_dia``); superado el cupo el evento se descarta.
"""

PANTALLAS = frozenset({
    "login", "inicio_redireccion", "dashboard_squad_redireccion", "tarifas_redireccion",
    "categorias_redireccion", "no_encontrada", "dashboard", "dashboard_estados",
    "dashboard_backlog", "dashboard_analistas", "requerimientos", "requerimientos_ans",
    "requerimiento_nuevo",
    "requerimiento_detalle", "entregas_actas", "predictivos", "backlog_futuro", "personas",
    "asignaciones", "capacidades", "planes_accion", "control_horas_facturable", "roadmap",
    "estimaciones", "azure_devops", "configuracion", "admin_aplicaciones", "admin_usuarios",
    "admin_uso_personas", "admin_endpoints", "admin_esquema_azure", "admin_importacion",
    "facturacion_general", "facturacion_ans", "facturacion_valores", "soporte_solicitudes",
    "soporte_ans", "soporte_garantias",
})

MODULOS = frozenset({
    "sesion", "sistema", "dashboard", "configuracion", "requerimientos", "entregas",
    "predictivos", "backlog", "personas", "asignaciones", "capacidades", "planes", "horas",
    "roadmap", "estimaciones", "azure", "administracion", "importacion", "facturacion",
    "soporte",
})

FORMULARIOS = frozenset({
    "usuario", "rol", "requerimiento_nuevo", "entrega", "entrega_editar",
    "requerimiento_general",
})
EXPORTACIONES = frozenset({
    "entregas_excel", "requerimientos_excel", "backlog_excel", "personas_excel",
    "plantilla_importacion_excel",
})
PREFIJOS_INTERACCION = (
    "requerimiento.", "entrega.", "entregas.", "menu.", "modal.", "filtro.", "usuarios.",
    "roles.", "uso.", "control.", "dashboard_analistas.",
)
IDS_CONOCIDOS = FORMULARIOS | EXPORTACIONES


def interaccion_conocida(valor: str) -> bool:
    """``True`` si el id es del catálogo o de un grupo de controles conocido."""
    return valor in IDS_CONOCIDOS or valor.startswith(PREFIJOS_INTERACCION)
