"""Esquemas del módulo de administración de aplicaciones."""
from pydantic import BaseModel


class AplicacionIn(BaseModel):
    codigo: str
    nombre: str
    descripcion: str = ""


class AplicacionUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None


class EstadoIn(BaseModel):
    activa: bool


class AplicacionOut(BaseModel):
    id: str
    codigo: str
    nombre: str
    descripcion: str
    activa: bool
    creada_por: str | None = None
