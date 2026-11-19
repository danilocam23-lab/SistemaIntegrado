# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Helpers de configuración y cliente de Azure DevOps (config por aplicación).

La conexión (URL de la organización, PAT y proyecto por defecto) se toma
EXCLUSIVAMENTE de la colección ``azdo_config`` (lo que el usuario guarda en la vista
Azure DevOps), con la resolución jerárquica usuario > squad > aplicación. Ya no se
lee la colección ``configuracion`` (claves legacy ``azdo_*`` / ``azdo2_*``).

La sincronización antigua por sprint/iteración fue eliminada; el espejo de
esquema vive en ``azdo_esquema_sync``.
"""
import re

from app.documents.azdo_config import AzdoConfig
from app.documents.persona import Persona
from app.documents.usuario import Usuario
from app.services.azure_devops import AzureDevOpsService

MENSAJE_SIN_CONFIG = (
    "Falta configurar la URL de la organización y el PAT en la vista Azure DevOps."
)

TARGETS_VALIDOS = {"hitss", "epm"}


def normalizar_target(target: str | None) -> str:
    """Normaliza el target; lanza ``ValueError`` si no es ``hitss`` ni ``epm``."""
    valor = (target or "hitss").lower().strip()
    if valor not in TARGETS_VALIDOS:
        raise ValueError("target inválido. Valores permitidos: hitss, epm.")
    return valor


def scope_config(base: str, target: str) -> str:
    """Scope de ``AzdoConfig``: ``base`` para HITSS, ``base_epm`` para EPM."""
    return base if target == "hitss" else f"{base}_{target}"


async def resolver_config(
    aplicacion_id: str,
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
) -> AzdoConfig | None:
    """Resuelve la configuración con prioridad: user > squad > app.

    ``usuario_id`` es el id con el que la vista guarda la config de usuario (el id de
    la Persona del usuario). Siempre se filtra por ``aplicacion_id``. Los niveles
    user/squad solo valen si traen org_url y PAT; el nivel app se devuelve tal cual.
    """
    target = normalizar_target(target)
    if usuario_id:
        cfg = await AzdoConfig.find_one(
            AzdoConfig.aplicacion_id == aplicacion_id,
            AzdoConfig.scope == scope_config("user", target),
            AzdoConfig.usuario_id == usuario_id,
        )
        if cfg and cfg.org_url and cfg.pat:
            return cfg

    if squad_id:
        cfg = await AzdoConfig.find_one(
            AzdoConfig.aplicacion_id == aplicacion_id,
            AzdoConfig.scope == scope_config("squad", target),
            AzdoConfig.squad_id == squad_id,
        )
        if cfg and cfg.org_url and cfg.pat:
            return cfg

    return await AzdoConfig.find_one(
        AzdoConfig.aplicacion_id == aplicacion_id,
        AzdoConfig.scope == scope_config("app", target),
    )


async def persona_de_usuario(usuario: Usuario) -> str | None:
    """Devuelve el id de la Persona vinculada al usuario (por ``usuario_id`` o email)."""
    persona = await Persona.find_one(Persona.usuario_id == str(usuario.id))
    if persona:
        return str(persona.id)
    email = (usuario.email or "").strip().lower()
    if not email:
        return None
    persona = await Persona.find_one(
        {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}
    )
    return str(persona.id) if persona else None


async def leer_config_azdo(
    aplicacion_id: str,
    clave: str,
    defecto: str = "",
    *,
    usuario_id: str | None = None,
    squad_id: str | None = None,
) -> str:
    """Lee un valor de la config de Azure DevOps desde ``azdo_config``.

    ``clave`` admite ``[azdo_|azdo2_]{org_url,pat,default_project,sync_interval}``
    (``azdo2_`` = target EPM). Resuelve con la jerarquía usuario > squad > app. No
    consulta la colección ``configuracion``: si no hay config o el campo está vacío
    devuelve ``defecto``.
    """
    target = "epm" if clave.startswith("azdo2_") else "hitss"
    campo = clave.removeprefix("azdo2_").removeprefix("azdo_")
    if campo not in {"org_url", "pat", "default_project", "sync_interval"}:
        return defecto
    cfg = await resolver_config(aplicacion_id, target, squad_id, usuario_id)
    valor = getattr(cfg, campo, "") if cfg else ""
    return valor or defecto


async def crear_servicio_azdo(
    aplicacion_id: str,
    prefijo: str = "azdo_",
    *,
    usuario_id: str | None = None,
    squad_id: str | None = None,
) -> AzureDevOpsService:
    """Crea un cliente de Azure DevOps con la config de ``azdo_config``.

    ``prefijo`` ``"azdo_"`` = HITSS, ``"azdo2_"`` = EPM. Resuelve usuario > squad > app
    dentro de ``aplicacion_id``. Lanza ``ValueError`` si no hay org_url y PAT.
    """
    target = "epm" if prefijo == "azdo2_" else "hitss"
    cfg = await resolver_config(aplicacion_id, target, squad_id, usuario_id)
    if not cfg or not cfg.org_url or not cfg.pat:
        raise ValueError(MENSAJE_SIN_CONFIG)
    return AzureDevOpsService(cfg.org_url, cfg.pat)
