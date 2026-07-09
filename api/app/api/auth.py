"""Router de autenticación."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.rol import Rol
from app.documents.usuario import Usuario
from app.schemas.auth import LoginIn, TokenOut, UsuarioOut
from app.security.deps import permisos_usuario, rol_actual, usuario_actual
from app.security.hashing import verificar_password
from app.security.jwt import crear_token

router = APIRouter(prefix="/auth", tags=["auth"])


async def _usuario_out(u: Usuario) -> UsuarioOut:
    rol: Rol | None = await rol_actual(u)
    permisos = await permisos_usuario(u)
    clave_rol = rol.clave if rol else (u.rol or "viewer")
    return UsuarioOut(
        id=str(u.id),
        nombre=u.nombre,
        email=u.email,
        rol=clave_rol,
        rol_id=str(rol.id) if rol else u.rol_id,
        rol_nombre=rol.nombre if rol else (u.rol or "Sin rol"),
        activo=u.activo,
        aplicaciones_codigos=u.aplicaciones_codigos,
        permisos=permisos,
    )


@router.post("/login", response_model=TokenOut)
async def login(datos: LoginIn) -> TokenOut:
    """Valida credenciales y devuelve un token JWT."""
    usuario = await Usuario.find_one(Usuario.email == datos.email)
    if (
        usuario is None
        or not usuario.activo
        or not verificar_password(datos.password, usuario.password_hash)
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos")
    rol = await rol_actual(usuario)
    clave_rol = rol.clave if rol else (usuario.rol or "viewer")
    token = crear_token(str(usuario.id), clave_rol)
    return TokenOut(access_token=token, usuario=await _usuario_out(usuario))


@router.get("/me", response_model=UsuarioOut)
async def me(usuario: Usuario = Depends(usuario_actual)) -> UsuarioOut:
    """Devuelve el usuario autenticado."""
    return await _usuario_out(usuario)
