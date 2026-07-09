"""Esquemas del módulo de usuarios."""
from pydantic import BaseModel


class UsuarioIn(BaseModel):
    nombre: str
    email: str
    password: str
    rol: str | None = "viewer"
    rol_id: str | None = None
    aplicaciones_codigos: list[str] = []


class UsuarioUpdate(BaseModel):
    nombre: str | None = None
    rol: str | None = None
    rol_id: str | None = None
    activo: bool | None = None
    aplicaciones_codigos: list[str] | None = None


class CambioPasswordIn(BaseModel):
    password: str
