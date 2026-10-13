# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de membresías persona-squad con vigencia (ADR-0010).

Una persona puede tener membresías en varias aplicaciones. Cada membresía vive en la
aplicación de su squad: leer o escribir exige acceso a **esa** aplicación, no solo a la
de la persona (un usuario sin acceso a un squad no ve ni toca sus membresías).

Decisión consciente: un usuario con acceso a la aplicación de un squad puede editar la
membresía de ese squad aunque la persona pertenezca a OTRA aplicación (basta que la persona
sea visible en su contexto); nunca toca las membresías de aplicaciones sin acceso.
"""
from datetime import date, timedelta

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.api.personas import _persona_visible
from app.documents.aplicacion import Aplicacion
from app.documents.membresia import Membresia
from app.documents.persona import Persona
from app.documents.usuario import Usuario
from app.middleware.aplicacion import (
    ContextoAplicacion,
    _codigos_autorizados,
    contexto_aplicacion,
    contexto_escritura,
)
from app.security.deps import permiso, tiene_permiso, usuario_actual
from app.services import membresias as svc
from app.services.membresias_backfill import backfill_persona
from app.services.metas_horas import metas_del_mes
from app.services.vigencia import (
    a_fecha_logica,
    hoy_bogota,
    meses_entre,
    recalcular_squads_persona,
    squads_vigentes,
)

router = APIRouter(prefix="/membresias", tags=["membresias"])


class MembresiaIn(BaseModel):
    """Alta de membresía. ``squad_id`` es el código de la aplicación del squad."""

    squad_id: str
    desde: date | None = None  # vacío = desde el inicio del proyecto


class MembresiaPatch(BaseModel):
    """Edición parcial de fechas. Un campo ausente no se toca; ``null`` es un valor:
    ``desde: null`` = desde el inicio del proyecto, ``hasta: null`` = reabrir."""

    desde: date | None = None
    hasta: date | None = None


class CierreIn(BaseModel):
    """Cierre con fecha de efecto (ÚLTIMO día activo, incluido); por defecto hoy."""

    fecha_efecto: date | None = None


def _salida(m: Membresia) -> dict:
    return m.model_dump(mode="json", by_alias=True)


async def _persona_accesible(persona_id: str, ctx: ContextoAplicacion) -> Persona:
    try:
        persona = await Persona.get(persona_id)
    except Exception:  # id mal formado
        persona = None
    if persona is None or not _persona_visible(persona, ctx):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    return persona


@router.get("/vigencias", dependencies=[permiso("personas.ver")])
async def vigencias(
    desde: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    hasta: str = Query(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict[str, dict[str, list[str]]]:
    """Mapa ``{persona_id: {mes: [squad_id]}}`` ya resuelto con la regla «vigente al
    menos un día del mes». Solo membresías de las aplicaciones del contexto."""
    if desde > hasta:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "'desde' debe ser <= 'hasta'")
    if len(meses_entre(desde, hasta)) > 60:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Rango máximo de 60 meses")
    return await squads_vigentes(ctx, desde, hasta)


@router.get("/metas", dependencies=[permiso("personas.ver")])
async def metas(
    anio: int = Query(..., ge=2000, le=2100),
    mes: int = Query(..., ge=1, le=12),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> list[dict]:
    """Meta de horas del mes por persona y squad vigente (al menos un día del mes).

    ``desde_efectivo``/``hasta_efectivo`` son el rango de la membresía recortado al mes
    (``hasta`` es el último día activo, incluido). ``dias_habiles`` excluye fines de semana
    y festivos; ``horas_meta`` = 8,5 h de lunes a jueves y 8 h los viernes. Los squads en
    paralelo cuentan la meta completa en cada uno. Solo membresías del contexto.
    """
    return await metas_del_mes(ctx, anio, mes)


@router.get("/persona/{persona_id}", dependencies=[permiso("personas.ver")])
async def listar_por_persona(
    persona_id: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
) -> list[dict]:
    """Membresías de la persona (vigentes y cerradas) limitadas a las aplicaciones a las
    que el usuario tiene acceso."""
    persona = await _persona_accesible(persona_id, ctx)
    # Respaldo perezoso: si faltan membresías de sus Persona.squads, se crean (idempotente,
    # nunca toca Persona.squads). Solo con personas.editar: con solo personas.ver el GET no
    # escribe (el backfill de arranque ya cubre el caso general).
    if await tiene_permiso(usuario, "personas.editar"):
        await backfill_persona(persona)
    autorizadas = await _codigos_autorizados(usuario)
    membresias = (
        await Membresia.find(
            {"persona_id": str(persona.id), "aplicacion_id": {"$in": autorizadas}}
        )
        .sort("desde")
        .to_list()
    )
    return [_salida(m) for m in membresias]


async def _exigir_acceso(m: Membresia, usuario: Usuario) -> None:
    """404 si la aplicación de la membresía no es accesible para el usuario."""
    if m.aplicacion_id not in await _codigos_autorizados(usuario):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membresía no encontrada")


async def _membresia_accesible(membresia_id: str, usuario: Usuario) -> Membresia:
    try:
        m = await Membresia.get(PydanticObjectId(membresia_id))
    except Exception:  # id mal formado
        m = None
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membresía no encontrada")
    await _exigir_acceso(m, usuario)
    return m


@router.post("/persona/{persona_id}", status_code=status.HTTP_201_CREATED)
async def crear(
    persona_id: str,
    datos: MembresiaIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
    _: Usuario = permiso("personas.editar"),
) -> dict:
    """Abre una membresía (también sirve para «reabrir» un squad: crea una nueva).

    El usuario debe tener acceso a la aplicación del squad (403 si no). 409 si la persona
    está inactiva o ya tiene una membresía vigente/solapada en ese squad.
    """
    persona = await _persona_accesible(persona_id, ctx)
    if await Aplicacion.find_one(Aplicacion.codigo == datos.squad_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Squad no encontrado")
    if datos.squad_id not in await _codigos_autorizados(usuario):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a la aplicación del squad.")
    if not persona.activo:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "La persona está inactiva; reactívela antes de abrir squads."
        )
    m = await svc.abrir(
        persona, datos.squad_id, datos.squad_id, datos.desde, usuario.email
    )
    if await recalcular_squads_persona(persona):
        persona.marcar_actualizado()
        await persona.save()
    return _salida(m)


@router.patch("/{membresia_id}")
async def editar(
    membresia_id: str,
    datos: MembresiaPatch,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
    _: Usuario = permiso("personas.editar"),
) -> dict:
    """Edita ``desde`` y/o ``hasta`` de una membresía (cuerpo parcial).

    ``desde: null`` = desde el inicio del proyecto. ``hasta: null`` reabre la membresía
    (409 si la persona está inactiva o se solapa con otra del mismo squad); ``hasta`` con
    fecha la deja cerrada con ese efecto. 422 si ``hasta < desde`` o el cuerpo está vacío;
    409 ante solape. Devuelve la membresía serializada.
    """
    campos = {c: getattr(datos, c) for c in datos.model_fields_set if c in ("desde", "hasta")}
    if not campos:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Indique 'desde' y/o 'hasta'.")
    m = await _membresia_accesible(membresia_id, usuario)
    persona = await _persona_accesible(m.persona_id, ctx)
    m = await svc.editar(m, persona, campos, usuario.email)
    if await recalcular_squads_persona(persona):
        persona.marcar_actualizado()
        await persona.save()
    return _salida(m)


@router.patch("/{membresia_id}/cerrar")
async def cerrar(
    membresia_id: str,
    datos: CierreIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
    _: Usuario = permiso("personas.editar"),
) -> dict:
    """Desactiva a la persona en ese squad con fecha de efecto (pasada, hoy o futura).

    No desactiva a la persona: si el cierre la deja sin ninguna membresía vigente a la
    fecha de efecto
    (abiertas o con cierre posterior) la respuesta trae ``ultimo_squad: true`` para
    que la UI avise y ofrezca desactivarla.
    """
    m = await _membresia_accesible(membresia_id, usuario)
    persona = await _persona_accesible(m.persona_id, ctx)
    if not m.activo:
        raise HTTPException(status.HTTP_409_CONFLICT, "La membresía ya está cerrada.")
    efecto = datos.fecha_efecto or hoy_bogota()
    await svc.cerrar(m, efecto, usuario.email)
    efecto_real = a_fecha_logica(m.hasta) if m.hasta else efecto
    if await recalcular_squads_persona(persona):
        persona.marcar_actualizado()
        await persona.save()
    return {
        "membresia": _salida(m),
        "ultimo_squad": not await svc.hay_vigentes_desde(
            str(persona.id), efecto_real + timedelta(days=1)
        ),
        "efecto": efecto_real.isoformat(),
    }
