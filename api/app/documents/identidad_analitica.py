"""Correspondencia protegida independiente de las ediciones de usuarios."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoBase


class IdentidadAnalitica(DocumentoBase):
    usuario_id: str
    id_analitico: str

    class Settings:
        name = "identidades_analiticas"
        indexes = [
            IndexModel([("usuario_id", ASCENDING)], unique=True),
            IndexModel([("id_analitico", ASCENDING)], unique=True),
        ]
