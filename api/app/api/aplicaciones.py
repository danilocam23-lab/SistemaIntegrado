# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de administración de aplicaciones (tenants) y sus usuarios."""
import re

from beanie.operators import In
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.aplicacion import Aplicacion
from app.documents.rol import Rol
from app.documents.usuario import Usuario
from app.schemas.aplicacion import AplicacionIn, AplicacionOut, AplicacionUpdate, EstadoIn
from app.schemas.auth import UsuarioOut
from app.security.deps import (
    es_superadmin,
    permiso,
    permisos_usuario,
    rol_actual,
    usuario_actual,
)
from app.services.provision_aplicacion import provisionar_aplicacion

router = APIRouter(prefix="/aplicaciones", tags=["aplicaciones"])


def _out(a: Aplicacion) -> AplicacionOut:
    return AplicacionOut(
        id=str(a.id),
        codigo=a.codigo,
        nombre=a.nombre,
        descripcion=a.descripcion,
        iteraciones=a.iteraciones,
        activa=a.activa,
        creada_por=a.creada_por,
    )


async def _usuario_out(u: Usuario) -> UsuarioOut:
    rol: Rol | None = await rol_actual(u)
    return UsuarioOut(
        id=str(u.id),
        nombre=u.nombre,
        email=u.email,
        rol=rol.clave if rol else (u.rol or "viewer"),
        rol_id=str(rol.id) if rol else u.rol_id,
        rol_nombre=rol.nombre if rol else (u.rol or "Sin rol"),
        activo=u.activo,
        aplicaciones_codigos=u.aplicaciones_codigos,
        permisos=await permisos_usuario(u),
    )


@router.get("", response_model=list[AplicacionOut])
async def listar(
    incluir_inactivas: bool = True,
    usuario: Usuario = Depends(usuario_actual),
) -> list[AplicacionOut]:
    """Lista las aplicaciones visibles para el usuario.

    Solo el superadmin ve todas; el resto (incluido ``admin_app``) ve las asignadas.
    Con ``incluir_inactivas=false`` se devuelven únicamente los squads activos.
    """
    if await es_superadmin(usuario):
        apps = await Aplicacion.find_all().to_list()
    else:
        apps = await Aplicacion.find(In(Aplicacion.codigo, usuario.aplicaciones_codigos)).to_list()
    if not incluir_inactivas:
        apps = [a for a in apps if a.activa]
    return [_out(a) for a in apps]


async def _validar_nombre_unico(nombre: str, excluir_codigo: str | None = None) -> None:
    """409 si otro squad ya usa ese nombre (comparación insensible a mayúsculas)."""
    filtro: dict = {"nombre": {"$regex": f"^{re.escape(nombre)}$", "$options": "i"}}
    if excluir_codigo is not None:
        filtro["codigo"] = {"$ne": excluir_codigo}
    if await Aplicacion.find_one(filtro):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un squad con ese nombre")


async def _contar_otros_activos(codigo: str) -> int:
    """Cantidad de squads activos distintos de ``codigo``."""
    return await Aplicacion.find(
        Aplicacion.activa == True, Aplicacion.codigo != codigo  # noqa: E712
    ).count()


@router.post("", response_model=AplicacionOut, status_code=status.HTTP_201_CREATED)
async def crear(
    datos: AplicacionIn,
    usuario: Usuario = permiso("aplicaciones.crear"),
) -> AplicacionOut:
    """Crea una aplicación nueva y provisiona su estructura base."""
    codigo = datos.codigo  # ya normalizado y validado por el esquema
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El nombre es obligatorio")
    if await Aplicacion.find_one(Aplicacion.codigo == codigo):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un squad con ese código")
    await _validar_nombre_unico(nombre)
    app = await Aplicacion(
        codigo=codigo,
        nombre=nombre,
        descripcion=datos.descripcion.strip(),
        iteraciones=datos.iteraciones.strip(),
        creada_por=str(usuario.id),
    ).insert()
    await provisionar_aplicacion(app.codigo)
    return _out(app)


@router.put("/{codigo}", response_model=AplicacionOut)
async def editar(
    codigo: str,
    datos: AplicacionUpdate,
    _: Usuario = permiso("aplicaciones.editar"),
) -> AplicacionOut:
    """Edita el nombre, la descripción o las iteraciones de un squad."""
    app = await Aplicacion.find_one(Aplicacion.codigo == codigo)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Squad no encontrado")
    if datos.nombre is not None:
        nombre = datos.nombre.strip()
        if not nombre:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "El nombre es obligatorio")
        await _validar_nombre_unico(nombre, excluir_codigo=app.codigo)
        app.nombre = nombre
    if datos.descripcion is not None:
        app.descripcion = datos.descripcion.strip()
    if datos.iteraciones is not None:
        app.iteraciones = datos.iteraciones.strip()
    app.marcar_actualizado()
    await app.save()
    return _out(app)


@router.patch("/{codigo}/estado", response_model=AplicacionOut)
async def cambiar_estado(
    codigo: str,
    datos: EstadoIn,
    _: Usuario = permiso("aplicaciones.editar"),
) -> AplicacionOut:
    """Activa o desactiva un squad (sin borrar sus datos)."""
    app = await Aplicacion.find_one(Aplicacion.codigo == codigo)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Squad no encontrado")
    if not datos.activa and app.activa:
        if await _contar_otros_activos(app.codigo) == 0:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "No se puede desactivar el último squad activo",
            )
    app.activa = datos.activa
    app.marcar_actualizado()
    await app.save()
    return _out(app)


@router.get("/{codigo}/usuarios", response_model=list[UsuarioOut])
async def usuarios_de_aplicacion(
    codigo: str,
    _: Usuario = permiso("admin.usuarios.ver"),
) -> list[UsuarioOut]:
    """Lista los usuarios asignados a un squad."""
    usuarios = await Usuario.find(In(Usuario.aplicaciones_codigos, [codigo])).to_list()
    return [await _usuario_out(u) for u in usuarios]


@router.post("/{codigo}/usuarios/{usuario_id}", response_model=UsuarioOut)
async def asignar_usuario(
    codigo: str,
    usuario_id: str,
    _: Usuario = permiso("admin.usuarios.editar"),
) -> UsuarioOut:
    """Asigna un usuario existente a un squad."""
    if await Aplicacion.find_one(Aplicacion.codigo == codigo) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Squad no encontrado")
    usuario = await Usuario.get(usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if codigo not in usuario.aplicaciones_codigos:
        usuario.aplicaciones_codigos.append(codigo)
        usuario.marcar_actualizado()
        await usuario.save()
    return await _usuario_out(usuario)


@router.delete("/{codigo}/usuarios/{usuario_id}", response_model=UsuarioOut)
async def quitar_usuario(
    codigo: str,
    usuario_id: str,
    _: Usuario = permiso("admin.usuarios.editar"),
) -> UsuarioOut:
    """Quita la asignación de un usuario a un squad."""
    usuario = await Usuario.get(usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    if codigo in usuario.aplicaciones_codigos:
        usuario.aplicaciones_codigos.remove(codigo)
        usuario.marcar_actualizado()
        await usuario.save()
    return await _usuario_out(usuario)
