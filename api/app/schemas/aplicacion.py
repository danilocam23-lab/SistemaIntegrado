"""Esquemas del módulo de administración de aplicaciones."""
from pydantic import BaseModel


class AplicacionIn(BaseModel):
    """Datos para dar de alta una aplicación (tenant) nueva."""

    codigo: str
    nombre: str
    descripcion: str = ""


class AplicacionUpdate(BaseModel):
    """Campos editables de una aplicación existente; ambos opcionales."""

    nombre: str | None = None
    descripcion: str | None = None


class EstadoIn(BaseModel):
    """Activa o desactiva una aplicación."""

    activa: bool


class AplicacionOut(BaseModel):
    """Aplicación tal como se devuelve al cliente."""

    id: str
    codigo: str
    nombre: str
    descripcion: str
    activa: bool
    creada_por: str | None = None
