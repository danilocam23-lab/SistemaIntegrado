"""Colección operativa: actas de trabajo."""
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any

from bson import Decimal128
from pydantic import BeforeValidator
from pymongo import ASCENDING, IndexModel

from app.documents.base import DocumentoOperativo


def _decimal128_a_decimal(v: Any) -> Any:
    if isinstance(v, Decimal128):
        return v.to_decimal()
    return v


MongoDecimal = Annotated[Decimal, BeforeValidator(_decimal128_a_decimal)]


class ActaTrabajo(DocumentoOperativo):
    codigo: str
    fecha: datetime | None = None
    direccion: str | None = None
    total_horas: MongoDecimal | None = None
    total_valor: MongoDecimal | None = None

    class Settings:
        name = "actas_trabajo"
        indexes = [IndexModel([("aplicacion_id", ASCENDING), ("codigo", ASCENDING)], name="ix_app_codigo")]
