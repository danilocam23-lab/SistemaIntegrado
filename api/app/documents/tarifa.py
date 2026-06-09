"""Colección operativa: tarifas (valor hora para liquidación T&M)."""
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


class Tarifa(DocumentoOperativo):
    anio: int
    valor_hora: MongoDecimal
    ramificacion: str | None = None

    class Settings:
        name = "tarifas"
        indexes = [IndexModel([("aplicacion_id", ASCENDING), ("anio", ASCENDING)], name="ix_app_anio")]
