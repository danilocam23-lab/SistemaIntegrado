"""Dependencias FastAPI de autenticación y autorización."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from beanie import PydanticObjectId

from app.documents.enums import RolUsuario
from app.documents.usuario import Usuario
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


def requiere_rol(*roles: RolUsuario):
    """Dependencia que exige uno de los roles indicados."""

    async def _dep(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado para esta acción")
        return usuario

    return _dep


def requiere_permiso(permiso: str):
    """Dependencia que exige un permiso concreto."""

    async def _dep(usuario: Usuario = Depends(usuario_actual)) -> Usuario:
        if permiso not in usuario.permisos:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Falta el permiso: {permiso}")
        return usuario

    return _dep
