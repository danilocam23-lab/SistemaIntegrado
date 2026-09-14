"""Esquemas del módulo de administración de endpoints."""
from typing import Any

from pydantic import BaseModel


class EndpointAdminIn(BaseModel):
    """Datos para dar de alta una entrada manual del catálogo editable."""

    modulo: str
    metodo: str
    ruta: str
    descripcion: str = ""
    parametros: str = ""
    cuerpo: str = ""
    permisos: str = ""


class EndpointAdminUpdate(BaseModel):
    """Campos editables de una entrada existente del catálogo; todos opcionales
    (solo se actualiza lo que venga distinto de ``None``)."""

    modulo: str | None = None
    metodo: str | None = None
    ruta: str | None = None
    descripcion: str | None = None
    parametros: str | None = None
    cuerpo: str | None = None
    permisos: str | None = None
    activo: bool | None = None


class EndpointAdminOut(BaseModel):
    """Entrada del catálogo editable tal como se devuelve al cliente."""

    id: str
    modulo: str
    metodo: str
    ruta: str
    descripcion: str
    parametros: str
    cuerpo: str
    permisos: str
    activo: bool


class EndpointCatalogoOut(BaseModel):
    """Una operación real del backend (F4.1, ADR-0008).

    Se deriva en caliente de ``app.openapi()`` y del árbol de dependencias de
    cada ``APIRoute`` — no de una lista escrita a mano —, así que no puede
    desincronizarse del código: cada campo sale del propio contrato de la
    ruta (ver ``GET /api/admin/endpoints/catalogo``). ``enriquecimiento`` es la
    única parte editable a mano: la nota de negocio que un administrador haya
    cargado en el catálogo clásico (``EndpointAdmin``, casada por
    ``metodo + ruta``); es ``None`` si nadie la documentó ahí todavía.
    """

    metodo: str
    ruta: str
    operation_id: str | None
    modulo: str
    resumen: str | None
    parametros: list[dict[str, Any]]
    esquema_de_cuerpo: dict[str, Any] | None
    permiso: str | None
    requiere_aplicacion: bool
    riesgo: str
    enriquecimiento: EndpointAdminOut | None = None
