"""Colección de plataforma: usuarios (cuentas de acceso)."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoBase


class Usuario(DocumentoBase):
    """Cuenta de acceso al sistema. Es transversal a las aplicaciones."""

    nombre: str
    email: str
    password_hash: str
    rol: str = "viewer"
    rol_id: str | None = None
    activo: bool = True
    aplicaciones_codigos: list[str] = []
    permisos: list[str] = []

    class Settings:
        name = "usuarios"
        indexes = [IndexModel([("email", ASCENDING)], unique=True, name="uq_email")]
