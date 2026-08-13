"""Router de integración con Azure DevOps."""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.azdo import AzdoSyncLog, AzdoWorkItem
from app.documents.azdo_config import AzdoConfig
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.security.deps import requiere_permiso
from app.services.azdo_sync import sincronizar_iteracion
from app.services.azure_devops import AzureDevOpsService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/azdo", tags=["azure-devops"])


# ── Modelos de entrada ──

class SyncIn(BaseModel):
    azdo_project: str
    iteration_path: str
    target: str = "hitss"


class AzdoConfigIn(BaseModel):
    org_url: str = ""
    pat: str | None = None  # None = no cambiar
    default_project: str = ""
    sync_interval: str = "manual"
    squad_id: str | None = None
    usuario_id: str | None = None
    target: str = "hitss"


class CampoRequeridoOut(BaseModel):
    ref: str
    name: str
    type: str
    default_value: Any = None


# ── Resolución jerárquica de config ──

_TARGETS_VALIDOS = {"hitss", "epm"}


def _normalizar_target(target: str | None) -> str:
    valor = (target or "hitss").lower().strip()
    if valor not in _TARGETS_VALIDOS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "target inválido. Valores permitidos: hitss, epm.",
        )
    return valor


def _scope_base(squad_id: str | None = None, usuario_id: str | None = None) -> str:
    if usuario_id:
        return "user"
    if squad_id:
        return "squad"
    return "app"


def _scope_config(base: str, target: str) -> str:
    return base if target == "hitss" else f"{base}_{target}"


def _describir_scope(scope: str) -> tuple[str, str]:
    if scope.endswith("_epm"):
        return scope.removesuffix("_epm"), "epm"
    return scope, "hitss"


async def _resolver_config(
    aplicacion_id: str,
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
) -> AzdoConfig | None:
    """Resuelve la configuración con prioridad: user > squad > app."""
    target = _normalizar_target(target)
    if usuario_id:
        cfg = await AzdoConfig.find_one(
            AzdoConfig.aplicacion_id == aplicacion_id,
            AzdoConfig.scope == _scope_config("user", target),
            AzdoConfig.usuario_id == usuario_id,
        )
        if cfg and cfg.org_url and cfg.pat:
            return cfg

    if squad_id:
        cfg = await AzdoConfig.find_one(
            AzdoConfig.aplicacion_id == aplicacion_id,
            AzdoConfig.scope == _scope_config("squad", target),
            AzdoConfig.squad_id == squad_id,
        )
        if cfg and cfg.org_url and cfg.pat:
            return cfg

    return await AzdoConfig.find_one(
        AzdoConfig.aplicacion_id == aplicacion_id,
        AzdoConfig.scope == _scope_config("app", target),
    )


async def _crear_servicio_desde_config(cfg: AzdoConfig) -> AzureDevOpsService:
    if not cfg.org_url or not cfg.pat:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Falta configurar URL de organización y/o PAT en la vista de Azure DevOps.",
        )
    return AzureDevOpsService(cfg.org_url, cfg.pat)


# ── Endpoints de configuración ──

@router.get("/config")
async def obtener_config(
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Devuelve la config AzDO por target (hitss|epm) y jerarquía user > squad > app."""
    target = _normalizar_target(target)
    cfg = await _resolver_config(ctx.codigo, target, squad_id, usuario_id)
    if not cfg:
        return {
            "scope": "app",
            "target": target,
            "org_url": "",
            "pat_guardado": False,
            "default_project": "",
            "sync_interval": "manual",
            "squad_id": None,
            "usuario_id": None,
            "learned_fields": None,
        }
    return {
        "scope": _describir_scope(cfg.scope)[0],
        "target": target,
        "org_url": cfg.org_url,
        "pat_guardado": bool(cfg.pat),
        "default_project": cfg.default_project,
        "sync_interval": cfg.sync_interval,
        "squad_id": cfg.squad_id,
        "usuario_id": cfg.usuario_id,
        "learned_fields": cfg.learned_fields,
    }


@router.get("/config/all")
async def listar_configs(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    """Lista todas las configuraciones AzDO de la aplicación (app, squads, users)."""
    configs = await AzdoConfig.find(
        AzdoConfig.aplicacion_id == ctx.codigo
    ).sort("scope").to_list()
    return [
        {
            "id": str(c.id),
            "scope": _describir_scope(c.scope)[0],
            "target": _describir_scope(c.scope)[1],
            "org_url": c.org_url,
            "pat_guardado": bool(c.pat),
            "default_project": c.default_project,
            "sync_interval": c.sync_interval,
            "squad_id": c.squad_id,
            "usuario_id": c.usuario_id,
        }
        for c in configs
    ]


@router.put("/config")
async def guardar_config(
    datos: AzdoConfigIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: object = Depends(requiere_permiso("azure_devops.editar")),
):
    """Guarda la config AzDO para HITSS o EPM según ``target``."""
    target = _normalizar_target(datos.target)
    scope = _scope_config(_scope_base(datos.squad_id, datos.usuario_id), target)

    cfg = await AzdoConfig.find_one(
        AzdoConfig.aplicacion_id == ctx.codigo,
        AzdoConfig.scope == scope,
        AzdoConfig.squad_id == datos.squad_id,
        AzdoConfig.usuario_id == datos.usuario_id,
    )

    if cfg is None:
        cfg = AzdoConfig(
            aplicacion_id=ctx.codigo,
            scope=scope,
            squad_id=datos.squad_id,
            usuario_id=datos.usuario_id,
            org_url=datos.org_url,
            pat=datos.pat or "",
            default_project=datos.default_project,
            sync_interval=datos.sync_interval,
        )
        await cfg.insert()
    else:
        cfg.org_url = datos.org_url
        cfg.default_project = datos.default_project
        cfg.sync_interval = datos.sync_interval
        if datos.pat is not None:
            cfg.pat = datos.pat
        cfg.marcar_actualizado()
        await cfg.save()

    return {
        "ok": True,
        "scope": _describir_scope(cfg.scope)[0],
        "target": target,
        "org_url": cfg.org_url,
        "pat_guardado": bool(cfg.pat),
        "default_project": cfg.default_project,
    }


@router.delete("/config")
async def eliminar_config(
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: object = Depends(requiere_permiso("azure_devops.editar")),
):
    """Elimina una config de squad o usuario (no permite eliminar la de app)."""
    if not squad_id and not usuario_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Solo se pueden eliminar configs de squad o usuario, no la global.",
        )
    target = _normalizar_target(target)
    scope = _scope_config("user" if usuario_id else "squad", target)
    cfg = await AzdoConfig.find_one(
        AzdoConfig.aplicacion_id == ctx.codigo,
        AzdoConfig.scope == scope,
        AzdoConfig.squad_id == squad_id,
        AzdoConfig.usuario_id == usuario_id,
    )
    if cfg:
        await cfg.delete()
    return {"ok": True}


# ── Test de conexión ──

@router.get("/test")
async def test_conexion(
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
) -> dict:
    """Verifica la conexión con Azure DevOps usando la config resuelta."""
    cfg = await _resolver_config(ctx.codigo, target, squad_id, usuario_id)
    if not cfg or not cfg.org_url or not cfg.pat:
        return {"ok": False, "error": "Falta configurar URL y/o PAT de Azure DevOps."}
    svc = AzureDevOpsService(cfg.org_url, cfg.pat)
    return await svc.test_conexion()


# ── Campos requeridos (descubrimiento) ──

@router.get("/campos-requeridos")
async def campos_requeridos(
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: object = Depends(requiere_permiso("azure_devops.editar")),
) -> dict[str, list[dict]]:
    """Descubre los campos requeridos para Feature, User Story/PBI y Task.

    Intenta crear un work item de prueba con título mínimo, parsea los errores
    400 para identificar campos obligatorios, y luego devuelve la lista.
    Los resultados se cachean en la config (learned_fields).
    """
    cfg = await _resolver_config(ctx.codigo, target, squad_id, usuario_id)
    if not cfg or not cfg.org_url or not cfg.pat:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Falta configurar URL y/o PAT de Azure DevOps.",
        )
    if not cfg.default_project:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Falta configurar el proyecto por defecto.",
        )

    svc = AzureDevOpsService(cfg.org_url, cfg.pat)
    proyecto = cfg.default_project
    wit_types = await svc.obtener_tipos_work_item(proyecto)

    resultado: dict[str, list[dict]] = {}
    all_learned: dict[str, dict] = {}

    for logical_name, real_name in wit_types.items():
        if logical_name not in ("feature", "userStory", "task"):
            continue

        # Intentar crear con campos mínimos para descubrir los requeridos
        campos_base = {"System.Title": f"__DISCOVERY__{logical_name}"}
        try:
            wi = await svc.crear_work_item(proyecto, real_name, campos_base.copy())
            # Si se creó sin error, eliminar el WI de prueba
            import httpx
            async with httpx.AsyncClient(timeout=30) as http:
                try:
                    delete_url = svc._url(f"/_apis/wit/workitems/{wi['id']}")
                    await http.delete(delete_url, headers=svc.headers, params={"destroy": "true"})
                except Exception:
                    pass
        except RuntimeError:
            pass

        # Recoger los campos aprendidos del retry
        cache_key = f"{proyecto}|{real_name}"
        learned = svc._learned_fields.get(cache_key, {})
        all_learned[cache_key] = learned

        # Obtener field map para nombres legibles
        field_map = await svc._obtener_field_map(proyecto)
        inv_map = {v["referenceName"]: k for k, v in field_map.items()}

        campos_lista = []
        # Campos estándar siempre requeridos
        standard = {
            "System.Title": {"name": "Title", "type": "string", "default": "(nombre de la tarea)"},
        }
        if logical_name == "task":
            standard.update({
                "Microsoft.VSTS.Common.Activity": {"name": "Activity", "type": "string", "default": "Development"},
                "Microsoft.VSTS.Scheduling.OriginalEstimate": {"name": "Original Estimate", "type": "double", "default": 0},
                "Microsoft.VSTS.Scheduling.RemainingWork": {"name": "Remaining Work", "type": "double", "default": 0},
                "Microsoft.VSTS.Scheduling.CompletedWork": {"name": "Completed Work", "type": "double", "default": 0},
                "Microsoft.VSTS.Scheduling.StartDate": {"name": "Start Date", "type": "dateTime", "default": "(fecha actual)"},
                "Microsoft.VSTS.Scheduling.FinishDate": {"name": "Finish Date", "type": "dateTime", "default": "(fecha actual)"},
            })
        elif logical_name == "userStory":
            standard.update({
                "System.Description": {"name": "Description", "type": "html", "default": "<div>(título)</div>"},
                "Microsoft.VSTS.Common.AcceptanceCriteria": {"name": "Acceptance Criteria", "type": "html", "default": "<div>(título)</div>"},
                "Microsoft.VSTS.Scheduling.StartDate": {"name": "Start Date", "type": "dateTime", "default": "(fecha actual)"},
                "Microsoft.VSTS.Scheduling.FinishDate": {"name": "Finish Date", "type": "dateTime", "default": "(fecha actual)"},
            })
        elif logical_name == "feature":
            standard.update({
                "Microsoft.VSTS.Scheduling.StartDate": {"name": "Start Date", "type": "dateTime", "default": "(fecha actual)"},
                "Microsoft.VSTS.Scheduling.TargetDate": {"name": "Target Date", "type": "dateTime", "default": "(fecha actual)"},
            })

        for ref, info in standard.items():
            campos_lista.append({
                "ref": ref,
                "name": info["name"],
                "type": info["type"],
                "default_value": info["default"],
                "source": "standard",
            })

        # Campos custom descubiertos por retry
        for ref, val in learned.items():
            if ref in standard:
                continue
            name = inv_map.get(ref, ref.split(".")[-1])
            field_info = field_map.get(name, {})
            campo_type = field_info.get("type", "string") if field_info else "string"
            display_val = val
            if val == "__TODAY__":
                display_val = "(fecha actual)"
            elif val == "__HTML_TITLE__":
                display_val = "<div>(título)</div>"
            elif val == "__TITLE__":
                display_val = "(título)"
            campos_lista.append({
                "ref": ref,
                "name": name.title() if name == name.lower() else name,
                "type": campo_type,
                "default_value": display_val,
                "source": "discovered",
            })

        resultado[logical_name] = campos_lista

    # Guardar learned fields en la config
    if all_learned:
        cfg.learned_fields = all_learned
        cfg.marcar_actualizado()
        await cfg.save()

    return resultado


# ── Proyectos e iteraciones ──

@router.get("/proyectos")
async def proyectos(
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
) -> list[dict]:
    cfg = await _resolver_config(ctx.codigo, target, squad_id, usuario_id)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin configuración de Azure DevOps.")
    svc = await _crear_servicio_desde_config(cfg)
    try:
        return await svc.obtener_proyectos()
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc


@router.get("/iteraciones")
async def iteraciones(
    proyecto: str,
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
) -> list[dict]:
    cfg = await _resolver_config(ctx.codigo, target, squad_id, usuario_id)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin configuración de Azure DevOps.")
    svc = await _crear_servicio_desde_config(cfg)
    try:
        return await svc.obtener_iteraciones(proyecto)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc


# ── Work items y sync ──

@router.get("/work-items")
async def listar_work_items(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    return await AzdoWorkItem.find(ctx.filtro()).to_list()


@router.get("/sync-log")
async def listar_sync_log(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    return await AzdoSyncLog.find(ctx.filtro()).sort("-iniciado_en").to_list()


@router.post("/sync")
async def sincronizar(
    datos: SyncIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: object = Depends(requiere_permiso("azure_devops.editar")),
) -> dict:
    """Sincroniza los work items de una iteración de Azure DevOps."""
    try:
        return await sincronizar_iteracion(
            ctx.codigo, datos.azdo_project, datos.iteration_path, datos.target
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"Error de Azure DevOps: {exc}"
        ) from exc
