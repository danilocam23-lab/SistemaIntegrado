"""Colección operativa: categorías (catálogo base por aplicación)."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class Categoria(DocumentoOperativo):
    """Categoría de trabajo. Las marcadas ``es_base`` se crean al provisionar una aplicación."""

    nombre: str
    color: str = "#6366f1"
    orden: int = 0
    es_base: bool = False

    class Settings:
        name = "categorias"
        indexes = [IndexModel([("aplicacion_id", ASCENDING)], name="ix_app")]
