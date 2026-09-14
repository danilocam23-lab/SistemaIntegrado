"""Esquemas del módulo de roles."""
from pydantic import BaseModel


class RolIn(BaseModel):
    """Datos para crear un rol RBAC nuevo, con su lista de permisos."""

    clave: str
    nombre: str
    descripcion: str = ""
    permisos: list[str] = []


class RolUpdate(BaseModel):
    """Campos editables de un rol existente; todos opcionales. Los roles de
    sistema (``es_sistema``) no aceptan cambiar su ``clave``."""

    nombre: str | None = None
    descripcion: str | None = None
    activo: bool | None = None
    permisos: list[str] | None = None


class RolOut(BaseModel):
    """Rol tal como se devuelve al cliente."""

    id: str
    clave: str
    nombre: str
    descripcion: str
    activo: bool
    es_sistema: bool
    permisos: list[str]
