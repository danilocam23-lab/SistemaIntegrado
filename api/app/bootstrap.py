"""Inicialización de datos al primer arranque: aplicación inicial y superadmin."""
import logging

from app.config import get_settings
from app.documents.aplicacion import Aplicacion
from app.documents.enums import RolUsuario
from app.documents.rol import Rol
from app.documents.usuario import Usuario
from app.security.hashing import hash_password
from app.security.rbac import ROLES_BASE, normalizar_permisos
from app.services.provision_aplicacion import provisionar_aplicacion

_log = logging.getLogger("bootstrap")
ROLES_OBSOLETOS = ("editor", "soporte_ans_editor")


async def _asegurar_roles_base() -> dict[str, Rol]:
    roles: dict[str, Rol] = {}
    for cfg in ROLES_BASE:
        rol = await Rol.find_one(Rol.clave == cfg["clave"])
        if rol is None:
            rol = await Rol(
                clave=cfg["clave"],
                nombre=cfg["nombre"],
                descripcion=cfg["descripcion"],
                es_sistema=cfg["es_sistema"],
                permisos=normalizar_permisos(cfg["permisos"]),
            ).insert()
            _log.info("Rol base creado: %s", rol.clave)
        else:
            _log.info("Rol base ya existe (sin modificar): %s", rol.clave)
        roles[rol.clave] = rol
    return roles


async def _eliminar_roles_obsoletos(roles: dict[str, Rol]) -> None:
    rol_viewer = roles.get(RolUsuario.VIEWER.value)
    for clave in ROLES_OBSOLETOS:
        rol = await Rol.find_one(Rol.clave == clave)
        if rol is None:
            continue
        if rol_viewer is not None:
            usuarios = await Usuario.find({"$or": [{"rol_id": str(rol.id)}, {"rol": clave}]}).to_list()
            for usuario in usuarios:
                usuario.rol = rol_viewer.clave
                usuario.rol_id = str(rol_viewer.id)
                usuario.permisos = normalizar_permisos(rol_viewer.permisos)
                usuario.marcar_actualizado()
                await usuario.save()
        await rol.delete()
        _log.info("Rol obsoleto eliminado: %s", clave)


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

    roles = await _asegurar_roles_base()
    await _eliminar_roles_obsoletos(roles)

    superadmin = await Usuario.find_one(Usuario.rol == RolUsuario.SUPERADMIN)
    if superadmin is None:
        rol_superadmin = roles[RolUsuario.SUPERADMIN.value]
        await Usuario(
            nombre=settings.superadmin_nombre,
            email=settings.superadmin_email,
            password_hash=hash_password(settings.superadmin_password),
            rol=RolUsuario.SUPERADMIN.value,
            rol_id=str(rol_superadmin.id),
            aplicaciones_codigos=[settings.aplicacion_inicial_codigo],
            permisos=["*"],
        ).insert()
        _log.info("Usuario superadmin creado: %s", settings.superadmin_email)
    else:
        if not superadmin.rol_id and RolUsuario.SUPERADMIN.value in roles:
            superadmin.rol_id = str(roles[RolUsuario.SUPERADMIN.value].id)
            superadmin.permisos = ["*"]
            superadmin.marcar_actualizado()
            await superadmin.save()
        _log.info("Superadmin ya existe: %s", superadmin.email)

    # Backfill de rol_id para usuarios legacy.
    usuarios = await Usuario.find_all().to_list()
    for usuario in usuarios:
        if usuario.rol_id:
            continue
        clave_rol = (usuario.rol or RolUsuario.VIEWER.value).strip().lower()
        rol_obj = roles.get(clave_rol) or roles.get(RolUsuario.VIEWER.value)
        if rol_obj is None:
            continue
        usuario.rol_id = str(rol_obj.id)
        if not usuario.permisos:
            usuario.permisos = normalizar_permisos(rol_obj.permisos)
        usuario.marcar_actualizado()
        await usuario.save()
