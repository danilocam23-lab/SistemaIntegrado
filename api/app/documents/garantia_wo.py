# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Documento para garantías de Work Orders."""
from pymongo import ASCENDING, IndexModel

from .base import DocumentoBase


class GarantiaWO(DocumentoBase):
    """Registro de una WO marcada como garantía con observaciones."""

    work_order_id: str
    aplicacion_id: str
    squad: str | None = None
    lider: str | None = None
    descripcion: str | None = None
    fecha_creacion_wo: str | None = None
    estado_wo: str | None = None
    observaciones: str | None = None
    observaciones_resolucion: str | None = None

    class Settings:
        name = "garantias_wo"
        indexes = [
            # F1.4 (ADR-0008 S7): antes era único por work_order_id a secas,
            # así que dos aplicaciones no podían registrar jamás la misma WO
            # como garantía. Pasa a compuesto: sigue impidiendo duplicados
            # dentro de una misma aplicación, pero deja de bloquear a otra.
            # Es una migración segura: el índice viejo ya garantizaba
            # unicidad global, así que no puede haber datos existentes que
            # violen la nueva restricción (más laxa). Beanie lo reemplaza
            # solo al arrancar (allow_index_dropping=True en db.py).
            IndexModel(
                [("aplicacion_id", ASCENDING), ("work_order_id", ASCENDING)],
                name="ix_app_wo_id",
                unique=True,
            ),
        ]
