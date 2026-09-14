"""Tests unitarios de la máquina de estados (ADR-0008 F2.2).

Lógica pura, sin base de datos: cubre las transiciones válidas e inválidas de
``TRANSICIONES_REQUERIMIENTO``/``TRANSICIONES_ENTREGA`` una por una. C7 del
ADR marca que ``validar_transicion_requerimiento``/``validar_transicion_entrega``
hoy son código muerto (``POST /{codigo}/transicion`` no las invoca todavía,
pendiente en F3.7): estos tests validan las funciones puras en sí mismas, no
su cableado al router.
"""
import pytest

from app.documents.enums import EstadoEntrega, EstadoRequerimiento
from app.services.state_machine import (
    TRANSICIONES_ENTREGA,
    TRANSICIONES_REQUERIMIENTO,
    puede_transitar_entrega,
    puede_transitar_requerimiento,
    validar_transicion_entrega,
    validar_transicion_requerimiento,
)

_TRANSICIONES_VALIDAS_REQ = [
    (origen, destino)
    for origen, destinos in TRANSICIONES_REQUERIMIENTO.items()
    for destino in destinos
]
_TRANSICIONES_VALIDAS_ENTREGA = [
    (origen, destino)
    for origen, destinos in TRANSICIONES_ENTREGA.items()
    for destino in destinos
]


@pytest.mark.parametrize("origen,destino", _TRANSICIONES_VALIDAS_REQ)
def test_transiciones_requerimiento_permitidas(origen, destino):
    assert puede_transitar_requerimiento(origen, destino)
    validar_transicion_requerimiento(origen, destino)  # no lanza


@pytest.mark.parametrize("origen,destino", _TRANSICIONES_VALIDAS_ENTREGA)
def test_transiciones_entrega_permitidas(origen, destino):
    assert puede_transitar_entrega(origen, destino)
    validar_transicion_entrega(origen, destino)  # no lanza


@pytest.mark.parametrize(
    "origen,destino",
    [
        (o, d)
        for o in EstadoRequerimiento
        for d in EstadoRequerimiento
        if d not in TRANSICIONES_REQUERIMIENTO.get(o, set()) and d != o
    ],
)
def test_transiciones_requerimiento_no_permitidas(origen, destino):
    assert not puede_transitar_requerimiento(origen, destino)
    with pytest.raises(ValueError, match="no permitida"):
        validar_transicion_requerimiento(origen, destino)


@pytest.mark.parametrize(
    "origen,destino",
    [
        (o, d)
        for o in EstadoEntrega
        for d in EstadoEntrega
        if d not in TRANSICIONES_ENTREGA.get(o, set()) and d != o
    ],
)
def test_transiciones_entrega_no_permitidas(origen, destino):
    assert not puede_transitar_entrega(origen, destino)
    with pytest.raises(ValueError, match="no permitida"):
        validar_transicion_entrega(origen, destino)


def test_permanecer_en_el_mismo_estado_no_es_una_transicion():
    """``actual == nuevo`` no debe lanzar: no es una transición, es un no-op."""
    estado = EstadoRequerimiento.ENTREGA_CARGADA
    validar_transicion_requerimiento(estado, estado)
    entrega = EstadoEntrega.APROBADA
    validar_transicion_entrega(entrega, entrega)
