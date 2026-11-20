# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de backlog futuro (Desarrollos de fábrica)."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.backlog_futuro import BacklogFuturo
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.security.deps import permiso

router = APIRouter(prefix="/backlog-futuro", tags=["backlog_futuro"])


def _datos_con_squad(datos: "BacklogFuturoIn", ctx: ContextoAplicacion) -> dict:
    """Cuerpo a persistir: squad == aplicación. Vacío se fuerza al de la aplicación activa;
    otro distinto es 422."""
    cuerpo = datos.model_dump()
    squad = (cuerpo.get("squad_id") or "").strip()
    if squad and squad != ctx.codigo:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"El squad '{squad}' no coincide con la aplicación activa '{ctx.codigo}'",
        )
    cuerpo["squad_id"] = ctx.codigo
    return cuerpo


class BacklogFuturoIn(BaseModel):
    nombre_iniciativa: str
    tipo_demanda: str | None = None
    squad_id: str
    horas_aproximadas: float = 0
    fecha_tentativa_inicio: str | None = None
    estado: str = "PENDIENTE"
    volvio_acta: bool = False
    acta_id: str | None = None
    responsable_id: str | None = None


@router.get("", dependencies=[permiso("backlog_futuro.ver")])
async def listar(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    consulta = ctx.filtro()
    return await BacklogFuturo.find(consulta).sort("-creado_en").to_list()


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(
    datos: BacklogFuturoIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("backlog_futuro.editar"),
):
    item = BacklogFuturo(aplicacion_id=ctx.codigo, **_datos_con_squad(datos, ctx))
    await item.insert()
    return item


@router.put("/{item_id}")
async def actualizar(
    item_id: str,
    datos: BacklogFuturoIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("backlog_futuro.editar"),
):
    item = await BacklogFuturo.get(item_id)
    if item is None or item.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro de backlog futuro no encontrado")
    for campo, valor in _datos_con_squad(datos, ctx).items():
        setattr(item, campo, valor)
    item.marcar_actualizado()
    await item.save()
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    item_id: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("backlog_futuro.editar"),
) -> None:
    item = await BacklogFuturo.get(item_id)
    if item is None or item.aplicacion_id != ctx.codigo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro de backlog futuro no encontrado")
    await item.delete()
