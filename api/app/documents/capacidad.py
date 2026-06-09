"""Colección operativa: capacidades mensuales.

Unifica ``developer_monthly_capacity`` (Workload Manager) y ``CapacidadMensual``
(Liquidador) mediante el campo ``scope``.
"""
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class Capacidad(DocumentoOperativo):
    scope: str = "persona"  # 'persona' | 'squad'
    persona_id: str | None = None
    squad_id: str | None = None
    mes: str  # formato 'YYYY-MM'
    horas_disponibles: float = 180
    personas: int = 1
    notas: str | None = None

    class Settings:
        name = "capacidades"
        indexes = [
            IndexModel(
                [("aplicacion_id", ASCENDING), ("scope", ASCENDING), ("mes", ASCENDING)],
                name="ix_app_scope_mes",
            )
        ]
