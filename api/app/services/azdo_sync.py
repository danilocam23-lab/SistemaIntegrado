# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Helpers de configuración y cliente de Azure DevOps (config por aplicación).

La sincronización antigua por sprint/iteración fue eliminada; el espejo de
esquema vive en ``azdo_esquema_sync``.
"""
from app.documents.azdo_config import AzdoConfig
from app.documents.configuracion import Configuracion
from app.services.azure_devops import AzureDevOpsService


def _target_desde_clave(clave: str) -> str:
    return "epm" if clave.startswith("azdo2_") else "hitss"


def _scope_app(target: str) -> str:
    return "app" if target == "hitss" else f"app_{target}"


async def _config_app(aplicacion_id: str, target: str) -> AzdoConfig | None:
    return await AzdoConfig.find_one(
        AzdoConfig.aplicacion_id == aplicacion_id,
        AzdoConfig.scope == _scope_app(target),
    )


async def leer_config_azdo(aplicacion_id: str, clave: str, defecto: str = "") -> str:
    """Lee un parámetro de configuración de Azure DevOps de una aplicación.

    Primero busca en AzdoConfig (nueva), luego en Configuracion (legacy).
    """
    target = _target_desde_clave(clave)
    cfg = await _config_app(aplicacion_id, target)
    if cfg:
        mapa = {
            "azdo_org_url": cfg.org_url,
            "azdo_pat": cfg.pat,
            "azdo_default_project": cfg.default_project,
            "azdo_sync_interval": cfg.sync_interval,
            "azdo2_org_url": cfg.org_url,
            "azdo2_pat": cfg.pat,
            "azdo2_default_project": cfg.default_project,
            "azdo2_sync_interval": cfg.sync_interval,
        }
        valor = mapa.get(clave)
        if valor:
            return valor

    # Fallback a Configuracion legacy
    doc = await Configuracion.find_one(
        Configuracion.aplicacion_id == aplicacion_id,
        Configuracion.clave == clave,
    )
    return doc.valor if doc else defecto


async def crear_servicio_azdo(
    aplicacion_id: str, prefijo: str = "azdo_"
) -> AzureDevOpsService:
    """Crea un cliente de Azure DevOps.

    Primero intenta desde AzdoConfig, luego desde Configuración legacy.
    """
    cfg = await _config_app(aplicacion_id, "epm" if prefijo == "azdo2_" else "hitss")
    if cfg and cfg.org_url and cfg.pat:
        return AzureDevOpsService(cfg.org_url, cfg.pat)

    # Fallback a Configuracion legacy
    org_url = await leer_config_azdo(aplicacion_id, f"{prefijo}org_url")
    pat = await leer_config_azdo(aplicacion_id, f"{prefijo}pat")
    if not org_url or not pat:
        target = "EPM" if prefijo == "azdo2_" else "HITSS"
        campo_faltante = "org_url" if not org_url else "pat"
        raise ValueError(
            f"Falta configurar '{campo_faltante}' de Azure DevOps ({target}) "
            "en la vista de Azure DevOps."
        )
    return AzureDevOpsService(org_url, pat)
