# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Clases base de los documentos Beanie."""
from datetime import UTC, datetime

from beanie import Document
from pydantic import Field


def ahora() -> datetime:
    """Marca de tiempo UTC actual."""
    return datetime.now(UTC)


class DocumentoBase(Document):
    """Base de toda colección: marca de creación y actualización."""

    creado_en: datetime = Field(default_factory=ahora)
    actualizado_en: datetime = Field(default_factory=ahora)

    def marcar_actualizado(self) -> None:
        self.actualizado_en = ahora()


class DocumentoOperativo(DocumentoBase):
    """Base de las colecciones operativas — pertenecen a una aplicación (tenant).

    El campo ``aplicacion_id`` guarda el código de la aplicación y es la pieza
    central del aislamiento multi-tenant: ninguna consulta operativa debe omitirlo.
    """

    aplicacion_id: str = Field(..., description="Código de la aplicación (tenant)")
