"""Auditoría interna sin cuerpos de peticiones ni credenciales."""
from typing import Literal

from pymongo import ASCENDING, DESCENDING, IndexModel

from app.documents.base import DocumentoBase


class Auditoria(DocumentoBase):
    usuario_id: str | None = None
    id_analitico: str | None = None
    rol: str | None = None
    aplicaciones_codigos: list[str] = []
    plataforma: bool = False
    recurso_tipo: str
    recurso_id: str | None = None
    accion: str
    resultado: Literal["exito", "fallo"]
    codigo_http: int
    duracion_ms: int
    ruta: str
    metodo: str

    class Settings:
        name = "auditoria"
        indexes = [
            IndexModel([("creado_en", DESCENDING)]),
            IndexModel([("usuario_id", ASCENDING), ("creado_en", DESCENDING)]),
            IndexModel([("id_analitico", ASCENDING), ("creado_en", DESCENDING)]),
            IndexModel([("aplicaciones_codigos", ASCENDING), ("creado_en", DESCENDING)]),
        ]
