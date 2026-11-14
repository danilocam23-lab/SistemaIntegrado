"""Registro confirmado y minimizado de operaciones backend."""
import json
import logging
import re
from collections.abc import Callable, Coroutine
from time import monotonic
from typing import Any
from uuid import UUID

from bson import ObjectId
from fastapi import HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute

from app.documents.auditoria import Auditoria
from app.errors import ErrorDominio
from app.security.deps import rol_actual
from app.services.identidad_analitica import obtener_id_analitico

logger = logging.getLogger("app.auditoria")
_IDS_RECURSO = (
    "entrega_id", "acta_id", "req_id", "usuario_id", "rol_id", "id", "id_analitico",
)
_ACCIONES = {"POST": "crear", "PUT": "editar", "PATCH": "editar", "DELETE": "eliminar"}


def id_recurso_seguro(valor: object) -> str | None:
    if not isinstance(valor, str):
        return None
    if ObjectId.is_valid(valor):
        return valor
    try:
        return str(UUID(valor))
    except ValueError:
        return None


def _recurso_id(request: Request, respuesta: Response | None, codigo: int) -> str | None:
    for clave in _IDS_RECURSO:
        valor = id_recurso_seguro(request.path_params.get(clave))
        if valor:
            return valor
    if 200 <= codigo < 300 and respuesta is not None and "application/json" in (
        respuesta.headers.get("content-type", "")
    ):
        cuerpo = getattr(respuesta, "body", None)
        if isinstance(cuerpo, bytes):
            try:
                datos = json.loads(cuerpo)
            except (ValueError, UnicodeDecodeError):
                logger.warning("No se pudo resolver el recurso JSON de una operación auditada.")
            else:
                if isinstance(datos, dict):
                    recurso_id = (
                        id_recurso_seguro(datos.get("id"))
                        or id_recurso_seguro(datos.get("_id"))
                    )
                    if recurso_id:
                        return recurso_id
    for clave in ("clave", "codigo_req"):
        codigo_recurso = request.path_params.get(clave)
        if isinstance(codigo_recurso, str) and re.fullmatch(
            r"[a-zA-Z0-9_.-]{1,100}", codigo_recurso
        ):
            return codigo_recurso
    return None


def _codigo_error(exc: Exception) -> int:
    if isinstance(exc, (HTTPException, ErrorDominio)):
        return exc.status_code
    if isinstance(exc, RequestValidationError):
        return 422
    if isinstance(exc, ValueError):
        return 400
    return 500


async def registrar_operacion(
    request: Request, ruta: str, codigo: int, inicio: float, respuesta: Response | None
) -> None:
    usuario = getattr(request.state, "usuario_autenticado", None)
    ctx = getattr(request.state, "contexto_aplicacion", None)
    segmentos = ruta.strip("/").split("/")
    recurso_tipo = segmentos[0] if segmentos else "desconocido"
    accion = _ACCIONES.get(request.method, "consultar")
    if ruta == "/auth/login":
        accion = "login"
    elif ruta.endswith("/transicion"):
        accion = "transicion"
    elif ruta.endswith("/password"):
        accion = "restablecer_password"
    elif recurso_tipo == "importacion":
        accion = "importar" if request.method == "POST" else "consultar"
    try:
        rol = await rol_actual(usuario) if usuario is not None else None
        await Auditoria(
            usuario_id=str(usuario.id) if usuario is not None else None,
            id_analitico=await obtener_id_analitico(usuario) if usuario is not None else None,
            rol=(rol.clave if rol else usuario.rol) if usuario is not None else None,
            aplicaciones_codigos=list(ctx.codigos) if ctx is not None else [],
            plataforma=ctx is None,
            recurso_tipo=recurso_tipo,
            recurso_id=_recurso_id(request, respuesta, codigo),
            accion=accion,
            resultado="exito" if 200 <= codigo < 300 else "fallo",
            codigo_http=codigo,
            duracion_ms=max(0, round((monotonic() - inicio) * 1000)),
            ruta=ruta,
            metodo=request.method,
        ).insert()
    except Exception:
        # Una operación ya confirmada no debe convertirse en 500 y provocar un reintento.
        logger.exception(
            "AUDITORIA_NO_PERSISTIDA metodo=%s ruta=%s codigo_http=%s usuario_id=%s",
            request.method, ruta, codigo, str(usuario.id) if usuario is not None else None,
        )


class RutaAuditada(APIRoute):
    """Audita mutaciones y consultas administrativas, no sondeos ni la propia auditoría."""

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        original = super().get_route_handler()
        ruta = self.path.removeprefix("/api")

        async def manejar(request: Request) -> Response:
            auditar = request.method != "GET" or ruta.startswith(
                ("/usuarios", "/roles", "/configuracion", "/actas", "/auditoria/identidad/")
            ) or (ruta.startswith("/requerimientos/") and ruta.count("/") == 2)
            if not auditar:
                return await original(request)
            inicio = monotonic()
            try:
                respuesta = await original(request)
            except Exception as exc:
                await registrar_operacion(request, ruta, _codigo_error(exc), inicio, None)
                raise
            await registrar_operacion(request, ruta, respuesta.status_code, inicio, respuesta)
            return respuesta

        return manejar
