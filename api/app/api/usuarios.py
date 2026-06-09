"""Router de gestión de usuarios."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.enums import RolUsuario, permisos_de
from app.documents.usuario import Usuario
from app.schemas.auth import UsuarioOut
from app.schemas.usuario import CambioPasswordIn, UsuarioIn, UsuarioUpdate
from app.security.deps import requiere_rol
from app.security.hashing import hash_password

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


def _out(u: Usuario) -> UsuarioOut:
    return UsuarioOut(
        id=str(u.id),
        nombre=u.nombre,
        email=u.email,
        rol=u.rol.value,
        activo=u.activo,
        aplicaciones_codigos=u.aplicaciones_codigos,
        permisos=u.permisos,
    )


@router.get("", response_model=list[UsuarioOut])
async def listar(me: Usuario = Depends(requiere_rol(RolUsuario.SUPERADMIN, RolUsuario.ADMIN_APP))) -> list[UsuarioOut]:
    todos = await Usuario.find_all().to_list()
    if me.rol == RolUsuario.ADMIN_APP:
        mis_apps = set(me.aplicaciones_codigos)
        todos = [
            u for u in todos
            if u.rol not in (RolUsuario.SUPERADMIN, RolUsuario.ADMIN_APP)
            and any(c in mis_apps for c in u.aplicaciones_codigos)
        ]
    return [_out(u) for u in todos]


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def crear(
    datos: UsuarioIn,
    me: Usuario = Depends(requiere_rol(RolUsuario.SUPERADMIN, RolUsuario.ADMIN_APP)),
) -> UsuarioOut:
    """Crea una cuenta de usuario."""
    # admin_app solo puede crear editor/viewer
    if me.rol == RolUsuario.ADMIN_APP and datos.rol not in (RolUsuario.EDITOR, RolUsuario.VIEWER):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo puede crear usuarios con rol editor o viewer")
    email = datos.email.strip().lower()
    if await Usuario.find_one(Usuario.email == email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese correo")
    usuario = await Usuario(
        nombre=datos.nombre.strip(),
        email=email,
        password_hash=hash_password(datos.password),
        rol=datos.rol,
        aplicaciones_codigos=datos.aplicaciones_codigos,
        permisos=permisos_de(datos.rol),
    ).insert()
    return _out(usuario)


@router.put("/{usuario_id}", response_model=UsuarioOut)
async def editar(
    usuario_id: str,
    datos: UsuarioUpdate,
    me: Usuario = Depends(requiere_rol(RolUsuario.SUPERADMIN, RolUsuario.ADMIN_APP)),
) -> UsuarioOut:
    """Edita un usuario; al cambiar el rol se recalculan sus permisos."""
    usuario = await Usuario.get(usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if datos.nombre is not None:
        usuario.nombre = datos.nombre.strip()
    if datos.rol is not None:
        usuario.rol = datos.rol
        usuario.permisos = permisos_de(datos.rol)
    if datos.activo is not None:
        usuario.activo = datos.activo
    if datos.aplicaciones_codigos is not None:
        usuario.aplicaciones_codigos = datos.aplicaciones_codigos
    usuario.marcar_actualizado()
    await usuario.save()
    return _out(usuario)


@router.patch("/{usuario_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def cambiar_password(
    usuario_id: str,
    datos: CambioPasswordIn,
    _: Usuario = Depends(requiere_rol(RolUsuario.SUPERADMIN, RolUsuario.ADMIN_APP)),
) -> None:
    """Restablece la contraseña de un usuario."""
    usuario = await Usuario.get(usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    usuario.password_hash = hash_password(datos.password)
    usuario.marcar_actualizado()
    await usuario.save()
