"""Evento de uso de la interfaz (telemetría mínima, sin PII ni contenido de formularios)."""
from datetime import datetime

from pymongo import ASCENDING, IndexModel

from app.config import get_settings
from app.documents.base import DocumentoBase


class EventoUso(DocumentoBase):
    usuario_id: str
    aplicacion_id: str | None = None
    event: str
    screen: str | None = None
    module: str | None = None
    interaction_id: str | None = None
    action_name: str | None = None
    ts: datetime
    # Identificador opcional del cliente para deduplicar reintentos (único por usuario).
    evento_id: str | None = None
    # Tiempo activo en pantalla (ms); solo en app_screen_engagement.
    duracion_ms: int | None = None

    class Settings:
        name = "eventos_uso"
        indexes = [
            IndexModel(
                [("usuario_id", ASCENDING), ("ts", ASCENDING)], name="ix_evento_uso_usuario_ts"
            ),
            IndexModel(
                [("aplicacion_id", ASCENDING), ("ts", ASCENDING)], name="ix_evento_uso_app_ts"
            ),
            IndexModel(
                [("usuario_id", ASCENDING), ("evento_id", ASCENDING)],
                name="ix_evento_uso_dedupe",
                unique=True,
                partialFilterExpression={"evento_id": {"$type": "string"}},
            ),
            IndexModel(
                [("creado_en", ASCENDING)],
                name="ix_evento_uso_ttl",
                expireAfterSeconds=get_settings().eventos_uso_retencion_dias * 86400,
            ),
        ]
