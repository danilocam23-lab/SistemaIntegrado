"""Colección de plataforma: usuarios (cuentas de acceso)."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoBase
from app.documents.enums import RolUsuario


class Usuario(DocumentoBase):
    """Cuenta de acceso al sistema. Es transversal a las aplicaciones."""

    nombre: str
    email: str
    password_hash: str
    rol: RolUsuario = RolUsuario.VIEWER
    activo: bool = True
    aplicaciones_codigos: list[str] = []
    permisos: list[str] = []

    class Settings:
        name = "usuarios"
        indexes = [IndexModel([("email", ASCENDING)], unique=True, name="uq_email")]
