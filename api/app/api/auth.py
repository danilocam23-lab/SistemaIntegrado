"""Router de autenticación."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.usuario import Usuario
from app.schemas.auth import LoginIn, TokenOut, UsuarioOut
from app.security.deps import usuario_actual
from app.security.hashing import verificar_password
from app.security.jwt import crear_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _usuario_out(u: Usuario) -> UsuarioOut:
    return UsuarioOut(
        id=str(u.id),
        nombre=u.nombre,
        email=u.email,
        rol=u.rol.value,
        activo=u.activo,
        aplicaciones_codigos=u.aplicaciones_codigos,
        permisos=u.permisos,
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
    token = crear_token(str(usuario.id), usuario.rol.value)
    return TokenOut(access_token=token, usuario=_usuario_out(usuario))


@router.get("/me", response_model=UsuarioOut)
async def me(usuario: Usuario = Depends(usuario_actual)) -> UsuarioOut:
    """Devuelve el usuario autenticado."""
    return _usuario_out(usuario)
