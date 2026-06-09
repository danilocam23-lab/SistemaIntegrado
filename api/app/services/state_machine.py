"""Máquina de estados de Requerimiento y Entrega (lógica pura, portada del Liquidador)."""
from app.documents.enums import EstadoEntrega, EstadoRequerimiento

TRANSICIONES_REQUERIMIENTO: dict[EstadoRequerimiento, set[EstadoRequerimiento]] = {
    EstadoRequerimiento.ESTIMACION_EN_CURSO_POR_HITSS: {
        EstadoRequerimiento.ESTIMACION_EN_ESPERA_DE_APROBACION_POR_EPM,
        EstadoRequerimiento.REQUERIMIENTO_DEVUELTO_A_EPM,
        EstadoRequerimiento.REQUERIMIENTO_CANCELADO,
        EstadoRequerimiento.REQUERIMIENTO_CANCELADO_POR_EPM,
    },
    EstadoRequerimiento.ESTIMACION_EN_ESPERA_DE_APROBACION_POR_EPM: {
        EstadoRequerimiento.ESTIMACION_APROBADA_POR_LT,
        EstadoRequerimiento.REQUERIMIENTO_DEVUELTO_A_EPM,
        EstadoRequerimiento.REQUERIMIENTO_SUSPENDIDO_POR_EPM,
        EstadoRequerimiento.REQUERIMIENTO_CANCELADO_POR_EPM,
    },
    EstadoRequerimiento.ESTIMACION_APROBADA_POR_LT: {
        EstadoRequerimiento.ESTIMACION_APROBADA_ENTREGA_PENDIENTE,
        EstadoRequerimiento.CONTROL_DE_CAMBIOS,
    },
    EstadoRequerimiento.ESTIMACION_APROBADA_ENTREGA_PENDIENTE: {
        EstadoRequerimiento.ENTREGA_CARGADA,
        EstadoRequerimiento.ENTREGA_NO_CARGADA,
        EstadoRequerimiento.CONTROL_DE_CAMBIOS,
    },
    EstadoRequerimiento.ENTREGA_CARGADA: {
        EstadoRequerimiento.CONTROL_DE_CAMBIOS,
        EstadoRequerimiento.REQUERIMIENTO_REEMPLAZADO,
    },
    EstadoRequerimiento.ENTREGA_NO_CARGADA: {
        EstadoRequerimiento.ENTREGA_CARGADA,
        EstadoRequerimiento.CONTROL_DE_CAMBIOS,
    },
    EstadoRequerimiento.CONTROL_DE_CAMBIOS: {
        EstadoRequerimiento.ESTIMACION_EN_CURSO_POR_HITSS,
        EstadoRequerimiento.REQUERIMIENTO_REEMPLAZADO,
    },
    EstadoRequerimiento.REQUERIMIENTO_DEVUELTO_A_EPM: {
        EstadoRequerimiento.ESTIMACION_EN_CURSO_POR_HITSS,
        EstadoRequerimiento.REQUERIMIENTO_CANCELADO_POR_EPM,
    },
    EstadoRequerimiento.REQUERIMIENTO_SUSPENDIDO_POR_EPM: {
        EstadoRequerimiento.ESTIMACION_EN_CURSO_POR_HITSS,
        EstadoRequerimiento.REQUERIMIENTO_CANCELADO_POR_EPM,
    },
    EstadoRequerimiento.REQUERIMIENTO_CANCELADO_POR_EPM: set(),
    EstadoRequerimiento.REQUERIMIENTO_CANCELADO: set(),
    EstadoRequerimiento.REQUERIMIENTO_REEMPLAZADO: set(),
}

TRANSICIONES_ENTREGA: dict[EstadoEntrega, set[EstadoEntrega]] = {
    EstadoEntrega.PENDIENTE: {
        EstadoEntrega.EN_ESPERA_DE_APROBACION,
        EstadoEntrega.ENTREGA_CARGADA,
        EstadoEntrega.ENTREGA_NO_CARGADA,
    },
    EstadoEntrega.EN_ESPERA_DE_APROBACION: {
        EstadoEntrega.ENTREGA_CARGADA,
        EstadoEntrega.RECHAZADA,
        EstadoEntrega.APROBADA,
    },
    EstadoEntrega.ENTREGA_NO_CARGADA: {
        EstadoEntrega.ENTREGA_CARGADA,
        EstadoEntrega.EN_ESPERA_DE_APROBACION,
    },
    EstadoEntrega.ENTREGA_CARGADA: {
        EstadoEntrega.APROBADA,
        EstadoEntrega.RECHAZADA,
        EstadoEntrega.EN_GARANTIA,
    },
    EstadoEntrega.RECHAZADA: {EstadoEntrega.ENTREGA_CARGADA, EstadoEntrega.EN_GARANTIA},
    EstadoEntrega.EN_GARANTIA: {EstadoEntrega.ENTREGA_CARGADA, EstadoEntrega.APROBADA},
    EstadoEntrega.APROBADA: set(),
}


def puede_transitar_requerimiento(
    actual: EstadoRequerimiento, nuevo: EstadoRequerimiento
) -> bool:
    return nuevo in TRANSICIONES_REQUERIMIENTO.get(actual, set())


def puede_transitar_entrega(actual: EstadoEntrega, nuevo: EstadoEntrega) -> bool:
    return nuevo in TRANSICIONES_ENTREGA.get(actual, set())


def validar_transicion_requerimiento(
    actual: EstadoRequerimiento, nuevo: EstadoRequerimiento
) -> None:
    """Lanza ``ValueError`` si la transición de estado no está permitida."""
    if actual != nuevo and not puede_transitar_requerimiento(actual, nuevo):
        raise ValueError(f"Transición de requerimiento no permitida: {actual} -> {nuevo}")


def validar_transicion_entrega(actual: EstadoEntrega, nuevo: EstadoEntrega) -> None:
    """Lanza ``ValueError`` si la transición de estado de entrega no está permitida."""
    if actual != nuevo and not puede_transitar_entrega(actual, nuevo):
        raise ValueError(f"Transición de entrega no permitida: {actual} -> {nuevo}")
