# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Infraestructura común de la suite de tests (ADR-0008 F2.1).

Requiere un MongoDB local corriendo en ``MONGO_URL`` (por defecto
``mongodb://localhost:27017``, igual que en desarrollo): la suite usa una base
de datos real y efímera (``MONGO_DB``, por defecto ``sistema_integrado_test``)
que se limpia (``drop_database``) al empezar y al terminar la sesión. No usa
``mongomock``/``testcontainers`` porque el entorno de desarrollo de este
proyecto ya corre Mongo localmente (ver ``arrancar.bat`` /
``iniciar-mongodb.bat`` en la raíz del repo); es el criterio más simple que
cumple lo que pide el ADR ("una BD *_test local con teardown").

Las variables de entorno obligatorias (``JWT_SECRET``, ``SUPERADMIN_PASSWORD``,
F0.5) se fijan aquí ANTES de importar cualquier módulo de ``app``: si un test
o un import disparara ``get_settings()`` antes de este bloque, el arranque
fallaría igual que en producción sin ``.env``.
"""
import os

os.environ.setdefault("JWT_SECRET", "clave-de-pruebas-solo-para-tests-1234567890")
os.environ.setdefault("SUPERADMIN_PASSWORD", "ClaveDePruebas123*")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("MONGO_DB", "sistema_integrado_test")
os.environ.setdefault("APLICACION_INICIAL_CODIGO", "epm-hitss-test")
os.environ.setdefault("APLICACION_INICIAL_NOMBRE", "EPM-HITSS (suite de tests)")
# API Keys de /api/integracion/*: cada endpoint usa la suya (ver api/README.md).
os.environ.setdefault("API_KEY", "clave-test-entregas")
os.environ.setdefault("API_KEY_REQUERIMIENTOS", "clave-test-requerimientos")
os.environ.setdefault("API_KEY_SOLICITUDES", "clave-test-solicitudes")

import uuid  # noqa: E402
from collections.abc import AsyncIterator, Awaitable, Callable  # noqa: E402

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from pymongo import AsyncMongoClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import cerrar_db, init_db  # noqa: E402
from app.documents.aplicacion import Aplicacion  # noqa: E402
from app.documents.usuario import Usuario  # noqa: E402
from app.security.hashing import hash_password  # noqa: E402
from app.security.jwt import crear_token  # noqa: E402

CONSOLIDADO = "__todas__"


async def _drop_db_prueba() -> None:
    settings = get_settings()
    cliente: AsyncMongoClient = AsyncMongoClient(settings.mongo_url)
    await cliente.drop_database(settings.mongo_db)
    await cliente.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _infra_bd() -> AsyncIterator[None]:
    """Inicializa Beanie contra la base de pruebas y corre ``bootstrap()`` una vez.

    ``bootstrap()`` es idempotente (crea roles base + superadmin si no
    existen), así que basta con correrlo una vez por sesión de tests; cada
    test que necesite datos propios los crea con las fixtures de más abajo,
    usando códigos de aplicación únicos (``uuid4``) para no interferir entre sí.
    """
    from app.bootstrap import bootstrap

    await _drop_db_prueba()
    await init_db()
    await bootstrap()
    yield
    await cerrar_db()
    await _drop_db_prueba()


@pytest_asyncio.fixture
async def cliente() -> AsyncIterator[AsyncClient]:
    """Cliente HTTP asíncrono contra la app FastAPI, sin pasar por uvicorn."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _codigo_unico(prefijo: str) -> str:
    return f"{prefijo}-{uuid.uuid4().hex[:8]}"


@pytest_asyncio.fixture
async def fabrica_aplicacion() -> Callable[[], Awaitable[Aplicacion]]:
    """Crea una aplicación (tenant) con código único por invocación."""

    async def _crear(nombre: str | None = None) -> Aplicacion:
        codigo = _codigo_unico("app")
        return await Aplicacion(
            codigo=codigo, nombre=nombre or codigo, creada_por="tests"
        ).insert()

    return _crear


@pytest_asyncio.fixture
async def fabrica_usuario() -> Callable[..., Awaitable[tuple[Usuario, str]]]:
    """Crea un ``Usuario`` de prueba y su JWT.

    Los permisos se asignan directamente en ``usuario.permisos`` (sin pasar
    por la colección ``Rol``): ``rol_actual()`` devuelve ``None`` cuando
    ``rol_id`` es ``None`` y ``permisos_usuario()`` cae entonces a
    ``usuario.permisos`` (ver ``app/security/deps.py``), que es exactamente el
    control fino que necesitan los tests de RBAC (F2.4).
    """

    async def _crear(
        aplicaciones_codigos: list[str],
        permisos: list[str] | None = None,
        rol: str = "viewer",
    ) -> tuple[Usuario, str]:
        email = f"{_codigo_unico('usuario')}@tests.local"
        usuario = await Usuario(
            nombre="Usuario de prueba",
            email=email,
            password_hash=hash_password("no-se-usa-en-tests"),
            rol=rol,
            rol_id=None,
            aplicaciones_codigos=aplicaciones_codigos,
            permisos=permisos or [],
        ).insert()
        token = crear_token(str(usuario.id), rol)
        return usuario, token

    return _crear


def headers_con_token(token: str, aplicacion: str | None = None) -> dict[str, str]:
    """Cabeceras estándar de una petición autenticada.

    Omitir ``aplicacion`` sirve para probar el 400 de "falta X-Aplicacion".
    """
    headers = {"Authorization": f"Bearer {token}"}
    if aplicacion is not None:
        headers["X-Aplicacion"] = aplicacion
    return headers


@pytest_asyncio.fixture
async def superadmin_token() -> str:
    """JWT del superadmin creado por ``bootstrap()`` (ve todas las aplicaciones)."""
    from app.documents.enums import RolUsuario

    superadmin = await Usuario.find_one(Usuario.rol == RolUsuario.SUPERADMIN)
    assert superadmin is not None, "bootstrap() debió crear el superadmin"
    return crear_token(str(superadmin.id), RolUsuario.SUPERADMIN.value)
