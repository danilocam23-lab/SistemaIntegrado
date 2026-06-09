"""Esquemas del módulo de usuarios."""
from pydantic import BaseModel

from app.documents.enums import RolUsuario


class UsuarioIn(BaseModel):
    nombre: str
    email: str
    password: str
    rol: RolUsuario = RolUsuario.VIEWER
    aplicaciones_codigos: list[str] = []


class UsuarioUpdate(BaseModel):
    nombre: str | None = None
    rol: RolUsuario | None = None
    activo: bool | None = None
    aplicaciones_codigos: list[str] | None = None


class CambioPasswordIn(BaseModel):
    password: str
