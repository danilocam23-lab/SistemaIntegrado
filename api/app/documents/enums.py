"""Enumeraciones del dominio: roles, permisos."""
from enum import StrEnum


class RolUsuario(StrEnum):
    """Rol de plataforma — define qué puede hacer una cuenta en el sistema."""

    SUPERADMIN = "superadmin"
    ADMIN_APP = "admin_app"
    EDITOR = "editor"
    VIEWER = "viewer"


ROLES_ADMIN = {RolUsuario.SUPERADMIN, RolUsuario.ADMIN_APP}


class RolPersona(StrEnum):
    """Rol operativo — describe la función de una persona en el dominio."""

    LT_HITSS = "LT_HITSS"
    LT_EPM = "LT_EPM"
    EPM = "EPM"
    COORD = "COORD"
    DEV = "DEV"
    LECTOR = "LECTOR"


class Permiso(StrEnum):
    """Permisos finos sobre el módulo de administración y la vista consolidada."""

    CREAR_APLICACIONES = "crear_aplicaciones"
    GESTIONAR_TODAS = "gestionar_todas_las_aplicaciones"
    GESTIONAR_ASIGNADAS = "gestionar_aplicaciones_asignadas"
    ACCESO_ADMIN = "acceso_modulo_admin"
    VER_CONSOLIDADO = "ver_consolidado"


PERMISOS_POR_ROL: dict[RolUsuario, list[Permiso]] = {
    RolUsuario.SUPERADMIN: [
        Permiso.CREAR_APLICACIONES,
        Permiso.GESTIONAR_TODAS,
        Permiso.GESTIONAR_ASIGNADAS,
        Permiso.ACCESO_ADMIN,
        Permiso.VER_CONSOLIDADO,
    ],
    RolUsuario.ADMIN_APP: [
        Permiso.GESTIONAR_ASIGNADAS,
        Permiso.ACCESO_ADMIN,
        Permiso.VER_CONSOLIDADO,
    ],
    RolUsuario.EDITOR: [],
    RolUsuario.VIEWER: [],
}


def permisos_de(rol: RolUsuario) -> list[str]:
    return [p.value for p in PERMISOS_POR_ROL.get(rol, [])]


# --- Enumeraciones del dominio de liquidación (portadas del Sistema Liquidador) ---


class TipoCosto(StrEnum):
    FIJO = "FIJO"
    TYM = "TYM"


class AnsResultado(StrEnum):
    CUMPLE = "CUMPLE"
    NO_CUMPLE = "NO_CUMPLE"


class EstadoRequerimiento(StrEnum):
    ESTIMACION_EN_CURSO_POR_HITSS = "ESTIMACION EN CURSO POR HITSS"
    ESTIMACION_EN_ESPERA_DE_APROBACION_POR_EPM = "ESTIMACION EN ESPERA DE APROBACION POR EPM"
    ESTIMACION_APROBADA_POR_LT = "ESTIMACION APROBADA POR LT"
    ESTIMACION_APROBADA_ENTREGA_PENDIENTE = "ESTIMACION APROBADA ENTREGA PENDIENTE"
    ENTREGA_CARGADA = "ENTREGA CARGADA"
    ENTREGA_NO_CARGADA = "ENTREGA NO CARGADA"
    CONTROL_DE_CAMBIOS = "CONTROL DE CAMBIOS"
    REQUERIMIENTO_DEVUELTO_A_EPM = "REQUERIMIENTO DEVUELTO A EPM"
    REQUERIMIENTO_SUSPENDIDO_POR_EPM = "REQUERIMIENTO SUSPENDIDO POR EPM"
    REQUERIMIENTO_CANCELADO_POR_EPM = "REQUERIMIENTO CANCELADO POR EPM"
    REQUERIMIENTO_CANCELADO = "REQUERIMIENTO CANCELADO"
    REQUERIMIENTO_REEMPLAZADO = "REQUERIMIENTO REEMPLAZADO"


class EstadoEntrega(StrEnum):
    PENDIENTE = "PENDIENTE"
    EN_ESPERA_DE_APROBACION = "EN ESPERA DE APROBACION"
    ENTREGA_CARGADA = "ENTREGA CARGADA"
    ENTREGA_NO_CARGADA = "ENTREGA NO CARGADA"
    APROBADA = "APROBADA"
    RECHAZADA = "RECHAZADA"
    EN_GARANTIA = "EN GARANTIA"


class EstadoFacturacion(StrEnum):
    PENDIENTE = "PENDIENTE"
    APROBADA = "APROBADA"
    FACTURADA = "FACTURADA"
    RECHAZADA = "RECHAZADA"
