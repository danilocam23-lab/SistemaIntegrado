"""Esquemas del módulo de roles."""
from pydantic import BaseModel


class RolIn(BaseModel):
    clave: str
    nombre: str
    descripcion: str = ""
    permisos: list[str] = []


class RolUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    activo: bool | None = None
    permisos: list[str] | None = None


class RolOut(BaseModel):
    id: str
    clave: str
    nombre: str
    descripcion: str
    activo: bool
    es_sistema: bool
    permisos: list[str]
