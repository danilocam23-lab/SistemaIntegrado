"""Control de horas facturables por persona y squad."""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class ControlHoras(DocumentoOperativo):
    """Registro de horas proyectadas por persona/squad."""

    anio: int = 0
    mes: int = 0
    persona_id: str
    squad: str
    lt_hitss: str = ""
    horas_soporte: float = 0
    horas_desarrollo: float = 0
    horas_soporte_cerrado: float = 0
    horas_desarrollo_cerrado: float = 0
    horas_vacaciones: float = 0
    horas_incapacidades: float = 0
    horas_licencias: float = 0
    horas_permisos: float = 0
    otras_novedades: float = 0
    horas_errores_analista: float = 0
    horas_garantias: float = 0
    horas_reprocesos: float = 0
    otras_novedades_calidad: float = 0
    observaciones: str = ""

    class Settings:
        name = "control_horas"
        indexes = [
            IndexModel(
                [
                    ("aplicacion_id", ASCENDING),
                    ("anio", ASCENDING),
                    ("mes", ASCENDING),
                    ("persona_id", ASCENDING),
                    ("squad", ASCENDING),
                ],
                name="ix_app_periodo_persona_squad",
                unique=True,
            ),
        ]
