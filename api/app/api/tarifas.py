# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de tarifas (valor hora para liquidación T&M).

Las tarifas son globales al proyecto (no están segmentadas por squad),
por lo que el listado devuelve todos los registros y las operaciones de
escritura no exigen un squad activo en particular.
"""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.tarifa import Tarifa
from app.security.deps import (
    permiso,
    usuario_actual,
)

# F1.1 (ADR-0008 S1): el router entero exigía cero autenticación; ahora toda
# operación requiere JWT válido, y las de escritura además el permiso de
# configuración administrativa.
router = APIRouter(
    prefix="/tarifas", tags=["tarifas"], dependencies=[Depends(usuario_actual)]
)

# aplicacion_id fijo para registros globales
_APP_GLOBAL = "global"


class TarifaIn(BaseModel):
    anio: int
    valor_hora: Decimal
    ramificacion: str | None = None


@router.get("")
async def listar():
    """Devuelve todas las tarifas sin filtro de squad."""
    return await Tarifa.find_all().sort("-anio").to_list()


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[permiso("admin.configuracion.editar")],
)
async def crear(datos: TarifaIn):
    tarifa = Tarifa(aplicacion_id=_APP_GLOBAL, **datos.model_dump())
    await tarifa.insert()
    return tarifa


@router.put(
    "/{tarifa_id}",
    dependencies=[permiso("admin.configuracion.editar")],
)
async def actualizar(tarifa_id: str, datos: TarifaIn):
    tarifa = await Tarifa.get(tarifa_id)
    if tarifa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarifa no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(tarifa, campo, valor)
    tarifa.marcar_actualizado()
    await tarifa.save()
    return tarifa


@router.delete(
    "/{tarifa_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[permiso("admin.configuracion.editar")],
)
async def eliminar(tarifa_id: str) -> None:
    tarifa = await Tarifa.get(tarifa_id)
    if tarifa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarifa no encontrada")
    await tarifa.delete()
