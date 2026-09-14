"""Dependencias FastAPI de autenticación y autorización."""
from beanie import PydanticObjectId
from fastapi import Depends, HTTPException, status
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
    """Dependencia que exige un permiso concreto."""

    async def _dep(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
        if not await tiene_permiso(usuario, permiso):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Falta el permiso: {permiso}")
        return usuario

    return _dep
