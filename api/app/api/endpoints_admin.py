"""Router de administración de endpoints — catálogo editable de rutas documentadas."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.documents.endpoint_admin import EndpointAdmin
from app.documents.usuario import Usuario
from app.schemas.endpoint_admin import EndpointAdminIn, EndpointAdminOut, EndpointAdminUpdate
from app.security.deps import requiere_permiso

router = APIRouter(prefix="/admin/endpoints", tags=["admin-endpoints"])

_METODOS_VALIDOS = {"GET", "POST", "PUT", "PATCH", "DELETE"}


def _out(endpoint: EndpointAdmin) -> EndpointAdminOut:
    return EndpointAdminOut(
        id=str(endpoint.id),
        modulo=endpoint.modulo,
        metodo=endpoint.metodo,
        ruta=endpoint.ruta,
        descripcion=endpoint.descripcion,
        parametros=endpoint.parametros,
        cuerpo=endpoint.cuerpo,
        permisos=endpoint.permisos,
        activo=endpoint.activo,
    )


def _validar_metodo(metodo: str) -> str:
    metodo_norm = (metodo or "").strip().upper()
    if metodo_norm not in _METODOS_VALIDOS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Método inválido: {metodo}")
    return metodo_norm


@router.get("", response_model=list[EndpointAdminOut])
async def listar(
    _: Usuario = Depends(requiere_permiso("admin.endpoints.ver")),
) -> list[EndpointAdminOut]:
    endpoints = await EndpointAdmin.find_all().sort("modulo", "ruta").to_list()
    return [_out(e) for e in endpoints]


@router.post("", response_model=EndpointAdminOut, status_code=status.HTTP_201_CREATED)
async def crear(
    datos: EndpointAdminIn,
    _: Usuario = Depends(requiere_permiso("admin.endpoints.crear")),
) -> EndpointAdminOut:
    modulo = datos.modulo.strip()
    ruta = datos.ruta.strip()
    if not modulo or not ruta:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Módulo y ruta son obligatorios")
    metodo = _validar_metodo(datos.metodo)
    if await EndpointAdmin.find_one(EndpointAdmin.metodo == metodo, EndpointAdmin.ruta == ruta):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un endpoint con ese método y ruta")
    endpoint = await EndpointAdmin(
        modulo=modulo,
        metodo=metodo,
        ruta=ruta,
        descripcion=datos.descripcion.strip(),
        parametros=datos.parametros.strip(),
        cuerpo=datos.cuerpo.strip(),
        permisos=datos.permisos.strip(),
    ).insert()
    return _out(endpoint)


@router.put("/{endpoint_id}", response_model=EndpointAdminOut)
async def actualizar(
    endpoint_id: str,
    datos: EndpointAdminUpdate,
    _: Usuario = Depends(requiere_permiso("admin.endpoints.editar")),
) -> EndpointAdminOut:
    endpoint = await EndpointAdmin.get(endpoint_id)
    if endpoint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Endpoint no encontrado")
    if datos.modulo is not None:
        endpoint.modulo = datos.modulo.strip()
    if datos.metodo is not None:
        endpoint.metodo = _validar_metodo(datos.metodo)
    if datos.ruta is not None:
        endpoint.ruta = datos.ruta.strip()
    if datos.descripcion is not None:
        endpoint.descripcion = datos.descripcion.strip()
    if datos.parametros is not None:
        endpoint.parametros = datos.parametros.strip()
    if datos.cuerpo is not None:
        endpoint.cuerpo = datos.cuerpo.strip()
    if datos.permisos is not None:
        endpoint.permisos = datos.permisos.strip()
    if datos.activo is not None:
        endpoint.activo = datos.activo
    endpoint.marcar_actualizado()
    await endpoint.save()
    return _out(endpoint)


@router.delete("/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    endpoint_id: str,
    _: Usuario = Depends(requiere_permiso("admin.endpoints.eliminar")),
) -> None:
    endpoint = await EndpointAdmin.get(endpoint_id)
    if endpoint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Endpoint no encontrado")
    await endpoint.delete()
