# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de capacidades mensuales (por persona o por squad).

Contrato de lectura estable: lista plana ``[{id, scope, persona_id, mes, horas_disponibles, ...}]``
con filtros opcionales ``mes``, ``anio``, ``desde`` y ``hasta``.

Reglas de escritura (la unicidad no se garantiza con índice porque pueden existir
duplicados históricos; se valida en servidor):

* ``mes`` con formato ``YYYY-MM``; ``horas_disponibles`` finito en 0..744.
* ``scope`` persona exige ``persona_id`` existente y de la aplicación activa.
* No se admiten dos filas de la misma persona (o squad) y mes: 409.
"""
from typing import Annotated, Any

from beanie import PydanticObjectId
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from pymongo import UpdateOne

from app.documents.base import ahora
from app.documents.capacidad import Capacidad
from app.documents.persona import Persona
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.security.deps import permiso

router = APIRouter(prefix="/capacidades", tags=["capacidad"])

PATRON_MES = r"^\d{4}-(0[1-9]|1[0-2])$"
HORAS_MAX = 744.0  # 31 días x 24 h
MAX_FILAS_BULK = 500
SCOPES = ("persona", "squad")

Mes = Annotated[str, Field(pattern=PATRON_MES)]
Horas = Annotated[float, Field(ge=0, le=HORAS_MAX, allow_inf_nan=False)]


class CapacidadIn(BaseModel):
    scope: str = "persona"
    persona_id: str | None = None
    squad_id: str | None = None
    mes: Mes  # 'YYYY-MM'
    horas_disponibles: Horas = 180
    personas: int = Field(default=1, ge=0, le=10000)
    notas: str | None = None


class CapacidadPut(BaseModel):
    """PUT parcial: solo se aplican los campos enviados."""

    scope: str | None = None
    persona_id: str | None = None
    squad_id: str | None = None
    mes: Mes | None = None
    horas_disponibles: Horas | None = None
    personas: int | None = Field(default=None, ge=0, le=10000)
    notas: str | None = None


class FilaBulk(BaseModel):
    persona_id: str
    mes: Mes
    horas_disponibles: Horas


class BulkIn(BaseModel):
    filas: list[FilaBulk] = Field(min_length=1, max_length=MAX_FILAS_BULK)


def _no_encontrada() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "Capacidad no encontrada")


async def _obtener(capacidad_id: str, ctx: ContextoAplicacion) -> Capacidad:
    if not ObjectId.is_valid(capacidad_id):
        raise _no_encontrada()
    capacidad = await Capacidad.find_one(
        {"_id": PydanticObjectId(capacidad_id), **ctx.filtro()}
    )
    if capacidad is None:
        raise _no_encontrada()
    return capacidad


def _validar_scope(scope: str) -> None:
    if scope not in SCOPES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "scope debe ser 'persona' o 'squad'"
        )


async def _personas_validas(ids: set[str], ctx: ContextoAplicacion) -> None:
    """Exige que todas las personas existan en la aplicación activa."""
    if any(not ObjectId.is_valid(i) for i in ids):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "persona_id inválido")
    encontrados = {
        str(p["_id"])
        async for p in Persona.get_pymongo_collection().find(
            {"_id": {"$in": [ObjectId(i) for i in ids]}, **ctx.filtro()}, {"_id": 1}
        )
    }
    if encontrados != ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")


async def _validar_destino(
    ctx: ContextoAplicacion,
    scope: str,
    persona_id: str | None,
    squad_id: str | None,
    mes: str,
    excluir_id: Any = None,
) -> None:
    """Valida scope/persona y que no exista otra fila con la misma clave (409)."""
    _validar_scope(scope)
    clave: dict[str, Any] = {**ctx.filtro(), "scope": scope, "mes": mes}
    if scope == "persona":
        if not persona_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "persona_id es obligatorio en scope persona"
            )
        await _personas_validas({persona_id}, ctx)
        clave["persona_id"] = persona_id
    elif squad_id:
        clave["squad_id"] = squad_id
    else:
        return  # squad sin identificador: no hay clave de unicidad que comprobar
    if excluir_id is not None:
        clave["_id"] = {"$ne": excluir_id}
    if await Capacidad.find_one(clave) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ya existe una capacidad para esa persona/squad y mes"
        )


@router.get("", dependencies=[permiso("capacidades.ver")])
async def listar(
    mes: Annotated[str | None, Query(pattern=PATRON_MES)] = None,
    anio: Annotated[int | None, Query(ge=1900, le=2999)] = None,
    desde: Annotated[str | None, Query(pattern=PATRON_MES)] = None,
    hasta: Annotated[str | None, Query(pattern=PATRON_MES)] = None,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    consulta = ctx.filtro()
    if mes:
        consulta["mes"] = mes
    else:
        rango: dict[str, str] = {}
        if anio is not None:
            rango["$gte"], rango["$lte"] = f"{anio}-01", f"{anio}-12"
        if desde and ("$gte" not in rango or desde > rango["$gte"]):
            rango["$gte"] = desde
        if hasta and ("$lte" not in rango or hasta < rango["$lte"]):
            rango["$lte"] = hasta
        if rango:
            consulta["mes"] = rango
    return await Capacidad.find(consulta).sort("mes").to_list()


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(
    datos: CapacidadIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("capacidades.editar"),
):
    await _validar_destino(ctx, datos.scope, datos.persona_id, datos.squad_id, datos.mes)
    capacidad = Capacidad(aplicacion_id=ctx.codigo, **datos.model_dump())
    await capacidad.insert()
    return capacidad


@router.put("/bulk")
async def actualizar_en_lote(
    datos: BulkIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("capacidades.editar"),
):
    """Upsert por (persona, mes) de hasta ``MAX_FILAS_BULK`` filas (scope persona).

    Valida todo antes de escribir (todo o nada en la validación); la escritura es un
    ``bulk_write`` no ordenado. Solo fija ``horas_disponibles``: conserva notas/personas.
    """
    claves = [(f.persona_id, f.mes) for f in datos.filas]
    if len(set(claves)) != len(claves):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Hay filas repetidas (persona_id, mes)"
        )
    await _personas_validas({f.persona_id for f in datos.filas}, ctx)

    marca = ahora()
    operaciones = [
        UpdateOne(
            {**ctx.filtro(), "scope": "persona", "persona_id": f.persona_id, "mes": f.mes},
            {
                "$set": {"horas_disponibles": f.horas_disponibles, "actualizado_en": marca},
                "$setOnInsert": {
                    "squad_id": None, "personas": 1, "notas": None, "creado_en": marca,
                },
            },
            upsert=True,
        )
        for f in datos.filas
    ]
    res = await Capacidad.get_pymongo_collection().bulk_write(operaciones, ordered=False)
    return {
        "total": len(operaciones),
        "creadas": res.upserted_count,
        "actualizadas": res.matched_count,
    }


@router.put("/{capacidad_id}")
async def actualizar(
    capacidad_id: str,
    datos: CapacidadPut,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("capacidades.editar"),
):
    capacidad = await _obtener(capacidad_id, ctx)
    cambios = datos.model_dump(exclude_unset=True)
    # Campos obligatorios no admiten null explícito.
    for campo in ("scope", "mes", "horas_disponibles", "personas"):
        if campo in cambios and cambios[campo] is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"{campo} no admite null"
            )
    nuevo = {**capacidad.model_dump(include={"scope", "persona_id", "squad_id", "mes"}), **cambios}
    # Solo se revalida la clave si cambia (no bloquea editar filas con duplicados históricos).
    if any(c in cambios for c in ("scope", "persona_id", "squad_id", "mes")):
        await _validar_destino(
            ctx, nuevo["scope"], nuevo["persona_id"], nuevo["squad_id"], nuevo["mes"],
            excluir_id=capacidad.id,
        )
    for campo, valor in cambios.items():
        setattr(capacidad, campo, valor)
    capacidad.marcar_actualizado()
    await capacidad.save()
    return capacidad


@router.delete("/{capacidad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    capacidad_id: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: Usuario = permiso("capacidades.editar"),
) -> None:
    capacidad = await _obtener(capacidad_id, ctx)
    await capacidad.delete()
