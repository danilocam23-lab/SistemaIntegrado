# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Sincronización de work items de Azure DevOps hacia la plataforma."""
from datetime import UTC, datetime

from pymongo import UpdateOne

from app.documents.azdo import AzdoSyncLog, AzdoWorkItem
from app.documents.azdo_config import AzdoConfig
from app.documents.configuracion import Configuracion
from app.documents.persona import Persona
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


async def sincronizar_iteracion(
    aplicacion_id: str,
    azdo_project: str,
    iteration_path: str,
    target: str = "hitss",
) -> dict:
    """Trae los work items de una iteración y los actualiza en la base.

    Registra el resultado en ``azdo_sync_log``. Lanza ``ValueError`` si falta
    la configuración (org_url / PAT).
    """
    prefijo = "azdo2_" if target == "epm" else "azdo_"
    org_url = await leer_config_azdo(aplicacion_id, f"{prefijo}org_url")
    pat = await leer_config_azdo(aplicacion_id, f"{prefijo}pat")
    if not org_url or not pat:
        raise ValueError("Falta configurar 'azdo_org_url' o 'azdo_pat' para la aplicación")

    inicio = datetime.now(UTC)
    servicio = AzureDevOpsService(org_url, pat)

    try:
        items = await servicio.obtener_work_items_sprint(azdo_project, iteration_path)
    except Exception as exc:  # noqa: BLE001 - se registra y se relanza
        await AzdoSyncLog(
            aplicacion_id=aplicacion_id,
            estado="error",
            error=str(exc),
            iniciado_en=inicio,
            finalizado_en=datetime.now(UTC),
        ).insert()
        raise

    # ADR-0008 F3.3 (P5): antes era un find_one (Persona) + find_one
    # (AzdoWorkItem) + save por work item = 3N viajes por sprint. Se precargan
    # las personas por email en una consulta y se reemplazan los N find_one +
    # save de AzdoWorkItem por un único bulk_write con upsert, apoyado en el
    # índice único (aplicacion_id, azdo_id).
    emails = {item["asignado_a"] for item in items if item["asignado_a"]}
    personas = (
        await Persona.find(
            {"aplicacion_id": aplicacion_id, "email": {"$in": list(emails)}}
        ).to_list()
        if emails
        else []
    )
    persona_id_por_email = {p.email: str(p.id) for p in personas if p.email}

    completado = restante = original = 0.0
    marca = datetime.now(UTC)
    operaciones = []
    for item in items:
        persona_id = (
            persona_id_por_email.get(item["asignado_a"]) if item["asignado_a"] else None
        )
        datos = {
            **item,
            "persona_id": persona_id,
            "iteration_path": iteration_path,
            "ultima_sync": marca,
        }
        operaciones.append(
            UpdateOne(
                {"aplicacion_id": aplicacion_id, "azdo_id": item["azdo_id"]},
                {"$set": {**datos, "actualizado_en": marca}, "$setOnInsert": {"creado_en": marca}},
                upsert=True,
            )
        )
        completado += item["completed_work"]
        restante += item["remaining_work"]
        original += item["original_estimate"]

    if operaciones:
        await AzdoWorkItem.get_pymongo_collection().bulk_write(operaciones)

    await AzdoSyncLog(
        aplicacion_id=aplicacion_id,
        estado="success",
        work_items=len(items),
        total_completado=completado,
        total_restante=restante,
        total_original=original,
        iniciado_en=inicio,
        finalizado_en=datetime.now(UTC),
    ).insert()

    return {
        "work_items": len(items),
        "total_completado": completado,
        "total_restante": restante,
        "total_original": original,
    }
