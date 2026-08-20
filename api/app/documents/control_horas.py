"""Control de horas facturables por persona y squad."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class ControlHoras(DocumentoOperativo):
    """Registro de horas proyectadas por persona/squad."""

    persona_id: str
    squad: str
    lt_hitss: str = ""
    horas_soporte: float = 0
    horas_desarrollo: float = 0
    horas_soporte_cerrado: float = 0
    horas_desarrollo_cerrado: float = 0

    class Settings:
        name = "control_horas"
        indexes = [
            IndexModel(
                [("aplicacion_id", ASCENDING), ("persona_id", ASCENDING), ("squad", ASCENDING)],
                name="ix_app_persona_squad",
                unique=True,
            ),
        ]
