"""Dependencias FastAPI de autenticación y autorización."""
from typing import Any

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.documents.enums import RolUsuario
from app.documents.rol import Rol
from app.documents.usuario import Usuario
from app.security.jwt import decodificar_token
from app.security.rbac import PERM_ADMIN_ACCESO, normalizar_permisos

_bearer = HTTPBearer(auto_error=False)


async def usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Usuario:
    """Valida el token JWT y devuelve el usuario autenticado."""
    if credenciales is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No autenticado")
    payload = decodificar_token(credenciales.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido o expirado")
    try:
        usuario = await Usuario.get(PydanticObjectId(payload["sub"]))
    except Exception:  # noqa: BLE001 - id mal formado
        usuario = None
    if usuario is None or not usuario.activo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario no válido")
    return usuario


_SIN_RESOLVER = object()


async def rol_actual(usuario: Usuario) -> Rol | None:
    """Rol del usuario, resuelto una única vez por petición (F1.7, ADR-0008 P1).

    ``usuario_actual`` es una dependencia de FastAPI: FastAPI cachea su
    resultado durante toda la petición, así que todo el código que reciba
    ``usuario`` en la misma petición recibe la MISMA instancia de
    ``Usuario``. Antes, ``es_superadmin``, ``es_admin_app`` y
    ``tiene_permiso``/``requiere_permiso`` volvían a consultar ``Rol`` cada
    vez que se llamaban (hasta 4-6 viajes a Mongo por petición). Cachear el
    resultado en esa misma instancia (con un centinela para distinguir "no
    resuelto todavía" de "resuelto a None") reduce eso a una sola consulta
    por petición, sin tocar ninguno de los ~30 sitios que llaman a estas
    funciones.
    """
    cache = getattr(usuario, "_rol_cache", _SIN_RESOLVER)
    if cache is not _SIN_RESOLVER:
        return cache  # type: ignore[return-value]
    rol = await Rol.get(usuario.rol_id) if usuario.rol_id else None
    usuario._rol_cache = rol  # type: ignore[attr-defined]
    return rol


async def permisos_usuario(usuario: Usuario) -> list[str]:
    rol = await rol_actual(usuario)
    if rol is not None and rol.permisos:
        return normalizar_permisos(rol.permisos)
    if usuario.permisos:
        return normalizar_permisos(usuario.permisos)
    return []


async def tiene_permiso(usuario: Usuario, permiso: str) -> bool:
    permisos = await permisos_usuario(usuario)
    return "*" in permisos or permiso in permisos


async def es_superadmin(usuario: Usuario) -> bool:
    rol = await rol_actual(usuario)
    if rol is not None:
        return rol.clave == RolUsuario.SUPERADMIN.value
    return usuario.rol == RolUsuario.SUPERADMIN.value


async def es_admin_app(usuario: Usuario) -> bool:
    rol = await rol_actual(usuario)
    if rol is not None:
        return rol.clave == RolUsuario.ADMIN_APP.value
    return usuario.rol == RolUsuario.ADMIN_APP.value


async def es_admin(usuario: Usuario) -> bool:
    return await es_superadmin(usuario) or await tiene_permiso(usuario, PERM_ADMIN_ACCESO)


def requiere_rol(*roles: RolUsuario):
    """Dependencia que exige uno de los roles indicados."""

    async def _dep(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
        rol = await rol_actual(usuario)
        rol_usuario = rol.clave if rol is not None else usuario.rol
        if rol_usuario not in [r.value for r in roles]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado para esta acción")
        return usuario

    return _dep


def requiere_permiso(permiso: str):
    """Dependencia que exige un permiso concreto.

    Marca la clausura devuelta con ``.permiso_requerido`` (F4.2, ADR-0008): es lo
    que permite que ``sincronizar_permisos_openapi`` publique el permiso de cada
    ruta en su propio contrato OpenAPI sin que nadie tenga que repetirlo a mano.
    """

    async def _dep(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
        if not await tiene_permiso(usuario, permiso):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Falta el permiso: {permiso}")
        return usuario

    _dep.permiso_requerido = permiso  # type: ignore[attr-defined]
    return _dep


def permiso(nombre: str) -> Any:
    """Azúcar sobre ``Depends(requiere_permiso(nombre))`` (F4.2, ADR-0008).

    Funcionalmente es exactamente lo mismo (mismo objeto ``Depends``), pero dejar
    ``permiso("requerimientos.editar")`` en la firma o en ``dependencies=[...]``
    de la ruta lee mejor como "esto exige este permiso" que repetir
    ``Depends(requiere_permiso(...))`` en cada endpoint. El dato en sí —qué
    permiso exige la ruta— no depende de usar este helper: cualquier
    ``Depends(requiere_permiso(...))``, se llame como se llame, queda marcado
    igual y ``sincronizar_permisos_openapi`` lo detecta recorriendo el árbol de
    dependencias real de la ruta.
    """
    return Depends(requiere_permiso(nombre))


def calls_de_ruta(route: APIRoute) -> list[Any]:
    """Todas las funciones (``Dependant.call``) del árbol de dependencias de una
    ruta, a cualquier profundidad, sin duplicados.

    Es la base compartida para leer metadatos "de dato, no de prosa" desde el
    contrato real de la ruta: ``permiso_de_ruta`` la usa para encontrar
    ``requiere_permiso``, y el catálogo de
    ``GET /api/admin/endpoints/catalogo`` (F4.1) la usa para saber si una ruta
    depende de ``contexto_aplicacion``/``contexto_escritura``.
    """
    dependant = getattr(route, "dependant", None)
    if dependant is None:
        return []
    encontradas: list[Any] = []
    vistos: set[int] = set()
    pendientes = [dependant]
    while pendientes:
        actual = pendientes.pop()
        if actual is None or id(actual) in vistos:
            continue
        vistos.add(id(actual))
        if actual.call is not None:
            encontradas.append(actual.call)
        pendientes.extend(actual.dependencies)
    return encontradas


def permiso_de_ruta(route: APIRoute) -> str | None:
    """Permiso RBAC que exige una ``APIRoute`` ya construida, o ``None`` si no
    exige ninguno. Es la fuente de verdad que consume tanto
    ``sincronizar_permisos_openapi`` (F4.2) como el catálogo de
    ``GET /api/admin/endpoints/catalogo`` (F4.1): si una ruta combina más de un
    permiso (patrón OR comprobado a mano en el cuerpo, ver
    ``actualizar_detalle_ans_req``), se devuelve el primero declarado por
    ``Depends``; esos casos puntuales no pasan por aquí.
    """
    encontrados: list[str] = []
    for call in calls_de_ruta(route):
        marcado = getattr(call, "permiso_requerido", None)
        if marcado and marcado not in encontrados:
            encontrados.append(marcado)
    return encontrados[0] if encontrados else None


def sincronizar_permisos_openapi(router: APIRouter) -> None:
    """Publica en el contrato OpenAPI (``x-permiso``) el permiso que cada ruta ya
    exige en tiempo de ejecución (F4.2, ADR-0008).

    Se invoca una única vez, en ``app/api/router.py`` justo después de montar
    ``api_router`` con todos sus sub-routers, y antes de que algo dispare la
    primera generación del esquema (``FastAPI.openapi()`` la cachea en cuanto se
    llama). No requiere migrar cada router al helper ``permiso()``: cualquier
    ruta que dependa —directa o indirectamente— de ``requiere_permiso`` queda
    detectada igual, porque la marca vive en la propia dependencia, no en cómo
    se la invocó.
    """
    for route in router.routes:
        if not isinstance(route, APIRoute):
            continue
        permiso_ruta = permiso_de_ruta(route)
        if permiso_ruta is None:
            continue
        extra = dict(route.openapi_extra or {})
        extra["x-permiso"] = permiso_ruta
        route.openapi_extra = extra
