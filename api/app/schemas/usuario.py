"""Esquemas del módulo de usuarios."""
from pydantic import BaseModel


class UsuarioIn(BaseModel):
    """Datos para crear un usuario: rol (RBAC) y aplicaciones a las que tiene
    acceso."""

    nombre: str
    email: str
    password: str
    rol: str | None = "viewer"
    rol_id: str | None = None
    aplicaciones_codigos: list[str] = []


class UsuarioUpdate(BaseModel):
    """Campos editables de un usuario existente; todos opcionales. No incluye
    la contraseña (ver ``CambioPasswordIn``)."""

    nombre: str | None = None
    rol: str | None = None
    rol_id: str | None = None
    activo: bool | None = None
    aplicaciones_codigos: list[str] | None = None


class CambioPasswordIn(BaseModel):
    """Nueva contraseña de un usuario."""

    password: str
