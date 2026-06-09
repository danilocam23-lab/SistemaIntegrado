"""Colección operativa: configuración clave/valor por aplicación."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class Configuracion(DocumentoOperativo):
    """Parámetro de configuración de una aplicación.

    Las marcadas ``es_base`` forman la plantilla mínima de toda aplicación nueva.
    """

    clave: str
    valor: str = ""
    grupo: str = "general"
    es_base: bool = False

    class Settings:
        name = "configuracion"
        indexes = [
            IndexModel(
                [("aplicacion_id", ASCENDING), ("clave", ASCENDING)],
                unique=True,
                name="uq_app_clave",
            )
        ]
