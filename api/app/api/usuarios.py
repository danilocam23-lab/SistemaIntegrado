"""Router de gestión de usuarios."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.rol import Rol
from app.documents.usuario import Usuario
from app.schemas.auth import UsuarioOut
from app.schemas.usuario import CambioPasswordIn, UsuarioIn, UsuarioUpdate
from app.security.deps import es_admin_app, es_superadmin, permisos_usuario, requiere_permiso, rol_actual
from app.security.hashing import hash_password

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


async def _out(u: Usuario) -> UsuarioOut:
    rol = await rol_actual(u)
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


@router.get("", response_model=list[UsuarioOut])
async def listar(me: Usuario = Depends(requiere_permiso("admin.usuarios.ver"))) -> list[UsuarioOut]:
    todos = await Usuario.find_all().to_list()
    if not await es_superadmin(me) and not (await es_admin_app(me) and len(me.aplicaciones_codigos) == 0):
        mis_apps = set(me.aplicaciones_codigos)
        todos = [
            u for u in todos
            if (u.rol or "viewer") not in ("superadmin", "admin_app")
            and any(c in mis_apps for c in u.aplicaciones_codigos)
        ]
    return [await _out(u) for u in todos]


async def _resolver_rol_obj(rol_id: str | None, rol_clave: str | None) -> Rol:
    rol: Rol | None = None
    if rol_id:
        rol = await Rol.get(rol_id)
    elif rol_clave:
        rol = await Rol.find_one(Rol.clave == rol_clave.strip().lower())
    if rol is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rol inválido")
    if not rol.activo:
        raise HTTPException(status.HTTP_409_CONFLICT, "El rol seleccionado está inactivo")
    return rol


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def crear(
    datos: UsuarioIn,
    me: Usuario = Depends(requiere_permiso("admin.usuarios.crear")),
) -> UsuarioOut:
    """Crea una cuenta de usuario."""
    rol_obj = await _resolver_rol_obj(datos.rol_id, datos.rol)
    if not await es_superadmin(me) and rol_obj.clave in ("superadmin", "admin_app"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No puede asignar roles de administración global")
    email = datos.email.strip().lower()
    if await Usuario.find_one(Usuario.email == email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese correo")
    usuario = await Usuario(
        nombre=datos.nombre.strip(),
        email=email,
        password_hash=hash_password(datos.password),
        rol=rol_obj.clave,
        rol_id=str(rol_obj.id),
        aplicaciones_codigos=datos.aplicaciones_codigos,
        permisos=rol_obj.permisos,
    ).insert()
    return await _out(usuario)


@router.put("/{usuario_id}", response_model=UsuarioOut)
async def editar(
    usuario_id: str,
    datos: UsuarioUpdate,
    me: Usuario = Depends(requiere_permiso("admin.usuarios.editar")),
) -> UsuarioOut:
    """Edita un usuario; al cambiar el rol se recalculan sus permisos."""
    usuario = await Usuario.get(usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if datos.nombre is not None:
        usuario.nombre = datos.nombre.strip()
    if datos.rol_id is not None or datos.rol is not None:
        rol_obj = await _resolver_rol_obj(datos.rol_id, datos.rol)
        if not await es_superadmin(me) and rol_obj.clave in ("superadmin", "admin_app"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No puede asignar roles de administración global")
        usuario.rol = rol_obj.clave
        usuario.rol_id = str(rol_obj.id)
        usuario.permisos = rol_obj.permisos
    if datos.activo is not None:
        usuario.activo = datos.activo
    if datos.aplicaciones_codigos is not None:
        usuario.aplicaciones_codigos = datos.aplicaciones_codigos
    usuario.marcar_actualizado()
    await usuario.save()
    return await _out(usuario)


@router.patch("/{usuario_id}/password", status_code=status.HTTP_204_NO_CONTENT)
async def cambiar_password(
    usuario_id: str,
    datos: CambioPasswordIn,
    _: Usuario = Depends(requiere_permiso("admin.usuarios.editar")),
) -> None:
    """Restablece la contraseña de un usuario."""
    usuario = await Usuario.get(usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    usuario.password_hash = hash_password(datos.password)
    usuario.marcar_actualizado()
    await usuario.save()
