"""Sincronización de work items de Azure DevOps hacia la plataforma."""
from datetime import datetime, timezone

from app.documents.azdo import AzdoSyncLog, AzdoWorkItem
from app.documents.azdo_config import AzdoConfig
from app.documents.configuracion import Configuracion
from app.documents.persona import Persona
from app.services.azure_devops import AzureDevOpsService


async def leer_config_azdo(aplicacion_id: str, clave: str, defecto: str = "") -> str:
    """Lee un parámetro de configuración de Azure DevOps de una aplicación.

    Primero busca en AzdoConfig (nueva), luego en Configuracion (legacy).
    """
    cfg = await AzdoConfig.find_one(
        AzdoConfig.aplicacion_id == aplicacion_id,
        AzdoConfig.scope == "app",
    )
    if cfg:
        mapa = {
            "azdo_org_url": cfg.org_url,
            "azdo_pat": cfg.pat,
            "azdo_default_project": cfg.default_project,
            "azdo_sync_interval": cfg.sync_interval,
            "azdo2_org_url": cfg.org_url,
            "azdo2_pat": cfg.pat,
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
    cfg = await AzdoConfig.find_one(
        AzdoConfig.aplicacion_id == aplicacion_id,
        AzdoConfig.scope == "app",
    )
    if cfg and cfg.org_url and cfg.pat:
        return AzureDevOpsService(cfg.org_url, cfg.pat)

    # Fallback a Configuracion legacy
    org_url = await leer_config_azdo(aplicacion_id, f"{prefijo}org_url")
    pat = await leer_config_azdo(aplicacion_id, f"{prefijo}pat")
    if not org_url or not pat:
        raise ValueError(
            f"Falta configurar la conexión a Azure DevOps en la vista de Azure DevOps."
        )
    return AzureDevOpsService(org_url, pat)


async def sincronizar_iteracion(
    aplicacion_id: str, azdo_project: str, iteration_path: str
) -> dict:
    """Trae los work items de una iteración y los actualiza en la base.

    Registra el resultado en ``azdo_sync_log``. Lanza ``ValueError`` si falta
    la configuración (org_url / PAT).
    """
    org_url = await leer_config_azdo(aplicacion_id, "azdo_org_url")
    pat = await leer_config_azdo(aplicacion_id, "azdo_pat")
    if not org_url or not pat:
        raise ValueError("Falta configurar 'azdo_org_url' o 'azdo_pat' para la aplicación")

    inicio = datetime.now(timezone.utc)
    servicio = AzureDevOpsService(org_url, pat)

    try:
        items = await servicio.obtener_work_items_sprint(azdo_project, iteration_path)
    except Exception as exc:  # noqa: BLE001 - se registra y se relanza
        await AzdoSyncLog(
            aplicacion_id=aplicacion_id,
            estado="error",
            error=str(exc),
            iniciado_en=inicio,
            finalizado_en=datetime.now(timezone.utc),
        ).insert()
        raise

    completado = restante = original = 0.0
    for item in items:
        persona_id = None
        if item["asignado_a"]:
            persona = await Persona.find_one(
                Persona.aplicacion_id == aplicacion_id,
                Persona.email == item["asignado_a"],
            )
            persona_id = str(persona.id) if persona else None

        datos = {
            **item,
            "persona_id": persona_id,
            "iteration_path": iteration_path,
            "ultima_sync": datetime.now(timezone.utc),
        }
        existente = await AzdoWorkItem.find_one(
            AzdoWorkItem.aplicacion_id == aplicacion_id,
            AzdoWorkItem.azdo_id == item["azdo_id"],
        )
        if existente is not None:
            for campo, valor in datos.items():
                setattr(existente, campo, valor)
            existente.marcar_actualizado()
            await existente.save()
        else:
            await AzdoWorkItem(aplicacion_id=aplicacion_id, **datos).insert()

        completado += item["completed_work"]
        restante += item["remaining_work"]
        original += item["original_estimate"]

    await AzdoSyncLog(
        aplicacion_id=aplicacion_id,
        estado="success",
        work_items=len(items),
        total_completado=completado,
        total_restante=restante,
        total_original=original,
        iniciado_en=inicio,
        finalizado_en=datetime.now(timezone.utc),
    ).insert()

    return {
        "work_items": len(items),
        "total_completado": completado,
        "total_restante": restante,
        "total_original": original,
    }
