"""Dependencias FastAPI de autenticación y autorización."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from beanie import PydanticObjectId

from app.documents.enums import RolUsuario
from app.documents.rol import Rol
from app.documents.usuario import Usuario
from app.security.rbac import PERM_ADMIN_ACCESO, normalizar_permisos
from app.security.jwt import decodificar_token

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


async def rol_actual(usuario: Usuario) -> Rol | None:
    if not usuario.rol_id:
        return None
    return await Rol.get(usuario.rol_id)


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
