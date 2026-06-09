"""Inicialización de datos al primer arranque: aplicación inicial y superadmin."""
import logging

from app.config import get_settings
from app.documents.aplicacion import Aplicacion
from app.documents.enums import RolUsuario, permisos_de
from app.documents.usuario import Usuario
from app.security.hashing import hash_password
from app.services.provision_aplicacion import provisionar_aplicacion

_log = logging.getLogger("bootstrap")


async def bootstrap() -> None:
    """Crea la aplicación inicial y el usuario superadmin si no existen.

    Llama ``provisionar_aplicacion`` en cada arranque: la función es
    idempotente y no crea duplicados si los datos ya existen.
    """
    settings = get_settings()

    app_inicial = await Aplicacion.find_one(
        Aplicacion.codigo == settings.aplicacion_inicial_codigo
    )
    if app_inicial is None:
        app_inicial = await Aplicacion(
            codigo=settings.aplicacion_inicial_codigo,
            nombre=settings.aplicacion_inicial_nombre,
            descripcion="Squad inicial con los datos migrados de Liquidador + Workload Manager.",
            creada_por="bootstrap",
        ).insert()
        _log.info("Squad inicial creado: %s", app_inicial.codigo)
    else:
        _log.info("Squad inicial ya existe: %s", app_inicial.codigo)

    # Siempre ejecutar provision: garantiza que categorías y parámetros
    # base estén presentes aunque se haya desplegado en un entorno nuevo
    # o se hayan eliminado datos. La función no crea duplicados.
    await provisionar_aplicacion(app_inicial.codigo)

    superadmin = await Usuario.find_one(Usuario.rol == RolUsuario.SUPERADMIN)
    if superadmin is None:
        await Usuario(
            nombre=settings.superadmin_nombre,
            email=settings.superadmin_email,
            password_hash=hash_password(settings.superadmin_password),
            rol=RolUsuario.SUPERADMIN,
            aplicaciones_codigos=[settings.aplicacion_inicial_codigo],
            permisos=permisos_de(RolUsuario.SUPERADMIN),
        ).insert()
        _log.info("Usuario superadmin creado: %s", settings.superadmin_email)
    else:
        _log.info("Superadmin ya existe: %s", superadmin.email)
