"""Router de gestión de roles y permisos."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.rol import Rol
from app.documents.usuario import Usuario
from app.schemas.rol import RolIn, RolOut, RolUpdate
from app.security.deps import requiere_permiso
from app.security.rbac import PERMISOS_CATALOGO, normalizar_permisos

router = APIRouter(prefix="/roles", tags=["roles"])


def _out(rol: Rol) -> RolOut:
    return RolOut(
        id=str(rol.id),
        clave=rol.clave,
        nombre=rol.nombre,
        descripcion=rol.descripcion,
        activo=rol.activo,
        es_sistema=rol.es_sistema,
        permisos=rol.permisos,
    )


@router.get("/catalogo", response_model=list[str])
async def catalogo(
    _: Usuario = Depends(requiere_permiso("admin.roles.ver")),
) -> list[str]:
    return PERMISOS_CATALOGO


@router.get("", response_model=list[RolOut])
async def listar(
    _: Usuario = Depends(requiere_permiso("admin.roles.ver")),
) -> list[RolOut]:
    roles = await Rol.find_all().sort("nombre").to_list()
    return [_out(rol) for rol in roles]


@router.post("", response_model=RolOut, status_code=status.HTTP_201_CREATED)
async def crear(
    datos: RolIn,
    _: Usuario = Depends(requiere_permiso("admin.roles.crear")),
) -> RolOut:
    clave = datos.clave.strip().lower()
    if not clave:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La clave del rol es obligatoria")
    if await Rol.find_one(Rol.clave == clave):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un rol con esa clave")
    rol = await Rol(
        clave=clave,
        nombre=datos.nombre.strip(),
        descripcion=datos.descripcion.strip(),
        permisos=normalizar_permisos(datos.permisos),
        es_sistema=False,
    ).insert()
    return _out(rol)


@router.put("/{rol_id}", response_model=RolOut)
async def editar(
    rol_id: str,
    datos: RolUpdate,
    _: Usuario = Depends(requiere_permiso("admin.roles.editar")),
) -> RolOut:
    rol = await Rol.get(rol_id)
    if rol is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rol no encontrado")
    if datos.nombre is not None:
        rol.nombre = datos.nombre.strip()
    if datos.descripcion is not None:
        rol.descripcion = datos.descripcion.strip()
    if datos.activo is not None:
        rol.activo = datos.activo
    if datos.permisos is not None:
        rol.permisos = normalizar_permisos(datos.permisos)
    rol.marcar_actualizado()
    await rol.save()
    return _out(rol)


@router.delete("/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    rol_id: str,
    _: Usuario = Depends(requiere_permiso("admin.roles.eliminar")),
) -> None:
    rol = await Rol.get(rol_id)
    if rol is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rol no encontrado")
    if rol.es_sistema:
        raise HTTPException(status.HTTP_409_CONFLICT, "No se puede eliminar un rol de sistema")
    existe_usuario = await Usuario.find_one(Usuario.rol_id == str(rol.id))
    if existe_usuario is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "No se puede eliminar un rol con usuarios asignados")
    await rol.delete()
