"""Conexión a MongoDB e inicialización del ODM Beanie.

Usa el cliente asíncrono nativo de PyMongo (``AsyncMongoClient``). Motor quedó
obsoleto y las versiones recientes de Beanie ya no lo soportan.
"""
from pymongo import AsyncMongoClient

from beanie import init_beanie

from app.config import get_settings
from app.documents import ALL_DOCUMENTS

_client: AsyncMongoClient | None = None


async def init_db() -> None:
    """Abre el cliente de MongoDB e inicializa Beanie con todas las colecciones.

    Se usa ``allow_index_dropping=True`` para que Beanie elimine índices
    creados con nombres automáticos en arranques anteriores y los reemplace
    por los índices con nombre explícito definidos en cada modelo.
    """
    global _client
    settings = get_settings()
    _client = AsyncMongoClient(settings.mongo_url)
    await init_beanie(
        database=_client[settings.mongo_db],
        document_models=ALL_DOCUMENTS,
        allow_index_dropping=True,
    )


async def cerrar_db() -> None:
    """Cierra la conexión a MongoDB."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
