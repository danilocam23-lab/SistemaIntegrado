"""Router de administración de endpoints.

Dos catálogos conviven aquí:

* El **editable** (``EndpointAdmin``, colección ``endpoints_admin``): notas de
  negocio que un administrador carga a mano (``listar``/``crear``/``actualizar``/
  ``eliminar``).
* El **vivo** (``GET /catalogo``, F4.1 del ADR-0008): se deriva en caliente de
  ``app.openapi()`` y del árbol de dependencias real de cada ruta, así que no
  puede desincronizarse del código. Fusiona cada operación con su entrada del
  catálogo editable, si existe, casando por ``método + ruta``.
"""
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from app.documents.endpoint_admin import EndpointAdmin
from app.documents.usuario import Usuario
from app.schemas.endpoint_admin import (
    EndpointAdminIn,
    EndpointAdminOut,
    EndpointAdminUpdate,
    EndpointCatalogoOut,
)
from app.security.deps import permiso

router = APIRouter(prefix="/admin/endpoints", tags=["admin-endpoints"])

_METODOS_VALIDOS = {"GET", "POST", "PUT", "PATCH", "DELETE"}

# F4.3 (ADR-0008): operaciones que, sin ser DELETE, borran datos de forma
# permanente, disparan una sincronización externa irreversible o mueven un
# recurso fuera del alcance de la aplicación activa. Lista explícita del ADR.
_DESTRUCTIVOS_EXPLICITOS: frozenset[tuple[str, str]] = frozenset(
    {
        ("POST", "/api/personas/deduplicar"),
        ("POST", "/api/azdo/sync"),
        ("GET", "/api/azdo/campos-requeridos"),
        ("DELETE", "/api/azdo/config"),
        ("POST", "/api/soporte/solicitudes-fabrica/sincronizar"),
        ("POST", "/api/soporte/solicitudes-fabrica/ejecutar-carga-automatica"),
        ("POST", "/api/requerimientos/{codigo_req}/reasignar-aplicacion"),
        ("POST", "/api/importacion/excel"),
    }
)


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


def _clasificar_riesgo(metodo: str, ruta: str) -> str:
    """Riesgo de invocar la operación (F4.3, ADR-0008).

    ``seguro`` (GET idempotente), ``mutante`` (POST/PUT/PATCH) o
    ``destructivo`` (todo DELETE, más la lista explícita de
    ``_DESTRUCTIVOS_EXPLICITOS``: operaciones que aunque no sean DELETE, borran,
    reasignan entre aplicaciones o disparan sincronizaciones irreversibles).
    """
    if metodo == "DELETE" or (metodo, ruta) in _DESTRUCTIVOS_EXPLICITOS:
        return "destructivo"
    if metodo == "GET":
        return "seguro"
    return "mutante"


def _primera_linea(texto: str | None) -> str | None:
    if not texto:
        return None
    primera = texto.strip().splitlines()[0].strip()
    return primera or None


def _modulo_de_operacion(ruta: str, op: dict[str, Any]) -> str:
    tags = op.get("tags") or []
    if tags:
        return str(tags[0])
    partes = ruta.strip("/").split("/")
    return partes[1] if len(partes) > 1 else (partes[0] if partes else "general")


@router.get("", response_model=list[EndpointAdminOut])
async def listar(
    _: Usuario = permiso("admin.endpoints.ver"),
) -> list[EndpointAdminOut]:
    endpoints = await EndpointAdmin.find_all().sort("modulo", "ruta").to_list()
    return [_out(e) for e in endpoints]


@router.get("/catalogo", response_model=list[EndpointCatalogoOut])
async def catalogo(
    request: Request,
    _: Usuario = permiso("admin.endpoints.ver"),
) -> list[EndpointCatalogoOut]:
    """Catálogo vivo de la API (F4.1, ADR-0008).

    Lee ``app.openapi()`` en caliente (fuente única de verdad, la misma que
    sirve ``/docs``) en vez de una lista escrita a mano: no puede
    desincronizarse del código como pasaba con
    ``web/src/pages/admin-endpoints/catalogoEndpoints.ts`` (113 entradas para
    145 rutas reales en la auditoría del ADR). El permiso RBAC
    (``x-permiso``) y si exige ``X-Aplicacion`` (``x-requiere-aplicacion``) ya
    vienen publicados en el propio esquema por
    ``app/api/router.py::sincronizar_permisos_openapi``/``_marcar_requiere_aplicacion``
    (F4.2); aquí solo se clasifica el riesgo (F4.3) y se fusiona con el
    catálogo editable (``EndpointAdmin``), casando por método + ruta.
    """
    esquema = request.app.openapi()
    enriquecimientos = {
        (e.metodo, e.ruta): _out(e) for e in await EndpointAdmin.find_all().to_list()
    }
    resultado: list[EndpointCatalogoOut] = []
    for ruta, operaciones in esquema.get("paths", {}).items():
        if not ruta.startswith("/api"):
            continue
        for metodo, op in operaciones.items():
            metodo_norm = metodo.upper()
            if metodo_norm not in _METODOS_VALIDOS:
                continue
            resultado.append(
                EndpointCatalogoOut(
                    metodo=metodo_norm,
                    ruta=ruta,
                    operation_id=op.get("operationId"),
                    modulo=_modulo_de_operacion(ruta, op),
                    resumen=op.get("summary") or _primera_linea(op.get("description")),
                    parametros=op.get("parameters", []),
                    esquema_de_cuerpo=op.get("requestBody"),
                    permiso=op.get("x-permiso"),
                    requiere_aplicacion=bool(op.get("x-requiere-aplicacion", False)),
                    riesgo=_clasificar_riesgo(metodo_norm, ruta),
                    enriquecimiento=enriquecimientos.get((metodo_norm, ruta)),
                )
            )
    resultado.sort(key=lambda e: (e.modulo, e.ruta, e.metodo))
    return resultado


@router.post("", response_model=EndpointAdminOut, status_code=status.HTTP_201_CREATED)
async def crear(
    datos: EndpointAdminIn,
    _: Usuario = permiso("admin.endpoints.crear"),
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
    _: Usuario = permiso("admin.endpoints.editar"),
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
    _: Usuario = permiso("admin.endpoints.eliminar"),
) -> None:
    endpoint = await EndpointAdmin.get(endpoint_id)
    if endpoint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Endpoint no encontrado")
    await endpoint.delete()
