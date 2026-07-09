"""Colección de plataforma: roles y permisos configurables."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoBase


class Rol(DocumentoBase):
    """Rol configurable del sistema."""

    clave: str
    nombre: str
    descripcion: str = ""
    activo: bool = True
    es_sistema: bool = False
    permisos: list[str] = []

    class Settings:
        name = "roles"
        indexes = [IndexModel([("clave", ASCENDING)], unique=True, name="uq_rol_clave")]
