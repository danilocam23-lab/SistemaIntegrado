"""Scheduler de auto-sincronización con Azure DevOps (APScheduler).

Cada 30 minutos revisa las aplicaciones con auto-sync activo (configuración
``azdo_sync_interval`` = hourly | daily) y sincroniza las iteraciones mapeadas
en los sprints de sus asignaciones.
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.documents.aplicacion import Aplicacion
from app.documents.asignacion import Asignacion
from app.documents.azdo import AzdoSyncLog
from app.services.azdo_sync import leer_config_azdo, sincronizar_iteracion

_log = logging.getLogger("scheduler")
_scheduler: AsyncIOScheduler | None = None


def _toca_sincronizar(ultima: datetime | None, intervalo: str) -> bool:
    if ultima is None:
        return True
    horas = (datetime.now(timezone.utc) - ultima).total_seconds() / 3600
    if intervalo == "hourly":
        return horas >= 1
    if intervalo == "daily":
        return horas >= 24
    return False


async def _tarea_sync_azdo() -> None:
    """Recorre las aplicaciones y sincroniza las que tengan auto-sync pendiente."""
    apps = await Aplicacion.find(Aplicacion.activa == True).to_list()  # noqa: E712
    for app in apps:
        intervalo = await leer_config_azdo(app.codigo, "azdo_sync_interval", "manual")
        if intervalo == "manual":
            continue
        ultimo = (
            await AzdoSyncLog.find(AzdoSyncLog.aplicacion_id == app.codigo)
            .sort("-iniciado_en")
            .first_or_none()
        )
        if not _toca_sincronizar(ultimo.iniciado_en if ultimo else None, intervalo):
            continue

        # Las iteraciones a sincronizar viven en los mapeos AzDO de los sprints.
        asignaciones = await Asignacion.find(Asignacion.aplicacion_id == app.codigo).to_list()
        vistos: set[tuple[str, str]] = set()
        for asig in asignaciones:
            for proyecto in asig.proyectos:
                for sprint in proyecto.sprints:
                    mapping = sprint.azdo_mapping
                    if mapping is None:
                        continue
                    clave = (mapping.azdo_project, mapping.iteration_path)
                    if clave in vistos:
                        continue
                    vistos.add(clave)
                    try:
                        await sincronizar_iteracion(app.codigo, clave[0], clave[1])
                    except Exception as exc:  # noqa: BLE001
                        _log.warning("[scheduler] sync AzDO falló (%s): %s", app.codigo, exc)


def iniciar_scheduler() -> None:
    """Arranca el scheduler. Se llama desde el lifespan de la aplicación."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(_tarea_sync_azdo, "interval", minutes=30, id="azdo_sync")
    _scheduler.start()
    _log.info("Scheduler de Azure DevOps iniciado (revisión cada 30 min)")


def detener_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
