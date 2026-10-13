# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Colección operativa: membresía persona-squad con vigencia (ADR-0010).

``desde``/``hasta`` son fechas de calendario de Bogotá guardadas a medianoche.
Intervalo CERRADO ``[desde, hasta]``: ``hasta`` es el ÚLTIMO día activo, incluido.
``hasta = None`` significa abierta y ``desde = None`` significa «desde el inicio del proyecto».
"""
from datetime import datetime

from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


class Membresia(DocumentoOperativo):
    """Pertenencia de una persona a un squad durante un intervalo.

    ``aplicacion_id`` es la aplicación del **squad** (no la dueña de la persona).
    """

    persona_id: str
    squad_id: str
    desde: datetime | None = None
    hasta: datetime | None = None
    activo: bool = True
    # Registro: cuándo se hizo el cierre (no editable).
    fecha_desactivacion: datetime | None = None
    # Efecto: último día activo (incluido). Si activo es False, hasta == este valor.
    fecha_efecto_desactivacion: datetime | None = None
    cerrada_por_cascada: bool = False

    class Settings:
        name = "membresias"
        indexes = [
            IndexModel(
                [("aplicacion_id", ASCENDING), ("persona_id", ASCENDING)], name="ix_app_persona"
            ),
            IndexModel(
                [("persona_id", ASCENDING), ("squad_id", ASCENDING), ("desde", ASCENDING)],
                name="ix_persona_squad_desde",
                unique=True,
            ),
            IndexModel(
                [("aplicacion_id", ASCENDING), ("desde", ASCENDING), ("hasta", ASCENDING)],
                name="ix_app_desde_hasta",
            ),
        ]
