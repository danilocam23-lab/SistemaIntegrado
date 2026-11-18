"""Consulta restringida y paginada; no permite borrar ni editar la auditoría."""
import json
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings
from app.documents.auditoria import Auditoria
from app.documents.identidad_analitica import IdentidadAnalitica
from app.documents.usuario import Usuario
from app.middleware.aplicacion import (
    CONSOLIDADO,
    ContextoAplicacion,
    codigos_autorizados,
    contexto_aplicacion,
)
from app.security.deps import es_superadmin, permiso, usuario_actual
from app.services.auditoria import RutaAuditada
from app.services.eventos_uso import (
    guardar_eventos,
    limite_excedido,
    normalizar_evento,
    resumen_uso,
)

router = APIRouter(prefix="/auditoria", tags=["auditoria"], route_class=RutaAuditada)

# Campos de login que solo ve el superadmin (datos personales/de red).
_CAMPOS_SENSIBLES = {"ip", "user_agent", "email_hmac"}
RANGO_DEFECTO_DIAS = 90


def filtro_operativo(ctx: ContextoAplicacion) -> dict:
    # No revelar eventos consolidados que también incluyen aplicaciones ajenas.
    return {
        "plataforma": False,
        "aplicaciones_codigos": {"$in": ctx.codigos},
        "$expr": {"$setIsSubset": ["$aplicaciones_codigos", ctx.codigos]},
    }


def _fecha_utc(fecha: datetime) -> datetime:
    return fecha.replace(tzinfo=UTC) if fecha.tzinfo is None else fecha.astimezone(UTC)


async def _consultar(
    filtro: dict, desde: datetime | None, hasta: datetime | None, pagina: int, limite: int,
    incluir_sensibles: bool = False,
) -> dict:
    if desde and hasta and _fecha_utc(desde) > _fecha_utc(hasta):
        raise HTTPException(422, "El inicio debe ser anterior al final.")
    if desde or hasta:
        rango: dict = {}
        if desde:
            rango["$gte"] = _fecha_utc(desde)
        if hasta:
            rango["$lte"] = _fecha_utc(hasta)
        filtro["creado_en"] = rango
    consulta = Auditoria.find(filtro)
    total = await consulta.count()
    eventos = await Auditoria.find(filtro).sort("-creado_en", "-_id").skip(
        (pagina - 1) * limite
    ).limit(limite).to_list()
    excluir = None if incluir_sensibles else _CAMPOS_SENSIBLES
    return {
        "total": total, "pagina": pagina, "limite": limite,
        "eventos": [evento.model_dump(mode="json", exclude=excluir) for evento in eventos],
    }


@router.get("")
async def listar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = permiso("admin.auditoria.ver"),
    usuario_id: str | None = None,
    id_analitico: UUID | None = None,
    recurso_id: str | None = None,
    recurso_tipo: str | None = None,
    accion: str | None = None,
    resultado: Literal["exito", "fallo"] | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    pagina: int = Query(1, ge=1, le=10000),
    limite: int = Query(50, ge=1, le=200),
) -> dict:
    filtro = filtro_operativo(ctx)
    for clave, valor in (
        ("usuario_id", usuario_id), ("id_analitico", id_analitico),
        ("recurso_id", recurso_id), ("recurso_tipo", recurso_tipo),
        ("accion", accion), ("resultado", resultado),
    ):
        if valor is not None:
            filtro[clave] = str(valor)
    # ip, user_agent y email_hmac (login) solo se devuelven al superadmin.
    return await _consultar(
        filtro, desde, hasta, pagina, limite, incluir_sensibles=await es_superadmin(usuario)
    )


@router.get("/plataforma")
async def plataforma(
    usuario: Usuario = permiso("admin.auditoria.ver"),
    desde: datetime | None = None,
    hasta: datetime | None = None,
    pagina: int = Query(1, ge=1, le=10000),
    limite: int = Query(50, ge=1, le=200),
) -> dict:
    if not await es_superadmin(usuario):
        raise HTTPException(403, "Solo superadmin puede consultar auditoría de plataforma.")
    return await _consultar(
        {"plataforma": True}, desde, hasta, pagina, limite, incluir_sensibles=True
    )


@router.get("/identidad/{id_analitico}")
async def identidad(
    id_analitico: UUID,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = permiso("admin.auditoria.ver"),
) -> dict:
    correspondencia = await IdentidadAnalitica.find_one({"id_analitico": str(id_analitico)})
    if correspondencia is None:
        raise HTTPException(404, "Identidad no encontrada en el ámbito autorizado.")
    filtro: dict = {"_id": ObjectId(correspondencia.usuario_id)}
    if not await es_superadmin(usuario):
        filtro["aplicaciones_codigos"] = {"$in": ctx.codigos}
    objetivo = await Usuario.find_one(filtro)
    if objetivo is None:
        raise HTTPException(404, "Identidad no encontrada en el ámbito autorizado.")
    return {
        "id_analitico": str(id_analitico), "usuario_id": str(objetivo.id),
        "nombre": objetivo.nombre, "email": objetivo.email,
    }


class LoteEventosUso(BaseModel):
    eventos: list[Any] = Field(max_length=50)


async def _leer_cuerpo_acotado(request: Request, maximo: int) -> bytes:
    """Lee el cuerpo sin superar ``maximo`` bytes; si lo excede responde 413."""
    declarado = request.headers.get("content-length")
    if declarado and declarado.isdigit() and int(declarado) > maximo:
        raise HTTPException(413, "El lote de eventos de uso excede el tamaño permitido.")
    partes: list[bytes] = []
    total = 0
    async for trozo in request.stream():
        total += len(trozo)
        if total > maximo:
            raise HTTPException(413, "El lote de eventos de uso excede el tamaño permitido.")
        partes.append(trozo)
    return b"".join(partes)


@router.post("/eventos-uso", status_code=202)
async def registrar_eventos_uso(
    request: Request,
    usuario: Usuario = Depends(usuario_actual),
    x_aplicacion: str | None = Header(default=None, alias="X-Aplicacion"),
) -> dict:
    """Recibe telemetría de uso; solo exige sesión. Descarta en silencio lo inválido.

    Respuestas: 202 con ``aceptados`` (eventos válidos) y ``duplicados`` (los ya recibidos
    con el mismo ``id``); 401 sin sesión; 413 si el cuerpo supera ``eventos_uso_max_bytes``;
    422 si el cuerpo no es ``{"eventos": [...]}`` o trae más de 50 eventos; 429 si supera
    el ritmo por minuto. La aplicación se guarda solo si ``X-Aplicacion`` es un código
    autorizado; con ``__todas__`` o uno ajeno queda ``None``.
    """
    cuerpo = await _leer_cuerpo_acotado(request, get_settings().eventos_uso_max_bytes)
    try:
        lote = LoteEventosUso.model_validate(json.loads(cuerpo))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(422, "Cuerpo inválido: se espera un lote de máx. 50 eventos.") from exc
    if limite_excedido(str(usuario.id), len(lote.eventos)):
        raise HTTPException(429, "Demasiados eventos de uso; intente más tarde.")
    aplicacion = None
    if x_aplicacion and x_aplicacion != CONSOLIDADO and (
        x_aplicacion in await codigos_autorizados(usuario)
    ):
        aplicacion = x_aplicacion
    uid = str(usuario.id)
    validos = [e for e in (normalizar_evento(c, uid) for c in lote.eventos) if e is not None]
    duplicados = await guardar_eventos(uid, aplicacion, validos)
    return {"aceptados": len(validos), "duplicados": duplicados}


def _rango_resumen(
    desde: datetime | None, hasta: datetime | None
) -> tuple[datetime, datetime | None]:
    """Resuelve el rango: 90 días por defecto y tope ``resumen_uso_rango_max_dias``."""
    fin = _fecha_utc(hasta) if hasta else None
    ini = _fecha_utc(desde) if desde else (fin or datetime.now(UTC)) - timedelta(
        days=RANGO_DEFECTO_DIAS
    )
    if fin is not None and ini > fin:
        raise HTTPException(422, "El inicio debe ser anterior al final.")
    maximo = get_settings().resumen_uso_rango_max_dias
    if ((fin or datetime.now(UTC)) - ini) > timedelta(days=maximo):
        raise HTTPException(422, f"El rango máximo de consulta es de {maximo} días.")
    return ini, fin


@router.get("/resumen-uso")
async def resumen_de_uso(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = permiso("admin.auditoria.ver"),
    desde: datetime | None = None,
    hasta: datetime | None = None,
    usuario_id: str | None = None,
) -> list[dict]:
    """Resumen de uso por persona dentro del ámbito de ``X-Aplicacion``.

    Rango: 90 días por defecto; máximo ``resumen_uso_rango_max_dias`` (422 si se excede).
    Ámbito unificado para logins y eventos: solo el superadmin en modo consolidado
    (``__todas__``) ve todo, incluidos los eventos sin aplicación y los logins de
    plataforma. En el resto de casos (incluido el superadmin con una app concreta) se
    filtra por ``ctx.codigos``: logins cuyas aplicaciones intersectan el ámbito y eventos
    con ``aplicacion_id`` dentro de él; los eventos con ``aplicacion_id`` nulo no se ven.
    """
    ini, fin = _rango_resumen(desde, hasta)
    rango_login: dict = {"$gte": ini}
    rango_ts: dict = {"$gte": ini}
    if fin is not None:
        rango_login["$lte"] = rango_ts["$lte"] = fin
    filtro_login: dict = {"accion": "login", "recurso_tipo": "auth", "creado_en": rango_login}
    filtro_eventos: dict = {"ts": rango_ts}
    if not (ctx.modo_consolidado and await es_superadmin(usuario)):
        filtro_login.update({"plataforma": False, "aplicaciones_codigos": {"$in": ctx.codigos}})
        filtro_eventos["aplicacion_id"] = {"$in": ctx.codigos}
    por_usuario = await resumen_uso(filtro_login, filtro_eventos, usuario_id)
    ids = [ObjectId(u) for u in por_usuario if ObjectId.is_valid(u)]
    usuarios = (
        await Usuario.find({"_id": {"$in": ids}}).limit(len(ids)).to_list() if ids else []
    )
    nombres = {str(u.id): u.nombre for u in usuarios}
    resultado = [
        {**datos, "nombre": nombres[uid]} for uid, datos in por_usuario.items() if uid in nombres
    ]
    resultado.sort(key=lambda r: (r["ultimo_ingreso"] is None, r["nombre"]))
    return resultado
