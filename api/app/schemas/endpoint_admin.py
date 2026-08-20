"""Esquemas del módulo de administración de endpoints."""
from pydantic import BaseModel


class EndpointAdminIn(BaseModel):
    modulo: str
    metodo: str
    ruta: str
    descripcion: str = ""
    parametros: str = ""
    cuerpo: str = ""
    permisos: str = ""


class EndpointAdminUpdate(BaseModel):
    modulo: str | None = None
    metodo: str | None = None
    ruta: str | None = None
    descripcion: str | None = None
    parametros: str | None = None
    cuerpo: str | None = None
    permisos: str | None = None
    activo: bool | None = None


class EndpointAdminOut(BaseModel):
    id: str
    modulo: str
    metodo: str
    ruta: str
    descripcion: str
    parametros: str
    cuerpo: str
    permisos: str
    activo: bool
