"""Colección operativa: órdenes de compra."""
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


class OrdenCompra(DocumentoOperativo):
    numero: str
    vigencia: datetime | None = None
    monto: MongoDecimal | None = None

    class Settings:
        name = "ordenes_compra"
        indexes = [IndexModel([("aplicacion_id", ASCENDING), ("numero", ASCENDING)], name="ix_app_numero")]
