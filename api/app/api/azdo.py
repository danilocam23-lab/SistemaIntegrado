"""Router de integración con Azure DevOps."""
import logging
import re
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import get_settings
from app.documents.aplicacion import Aplicacion
from app.documents.azdo import AzdoSyncLog, AzdoWorkItem
from app.documents.azdo_config import AzdoConfig
from app.documents.persona import Persona
from app.documents.usuario import Usuario
from app.errors import ErrorDominio, ErrorIntegracion, NoEncontrado
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.security.deps import permiso, usuario_actual
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


class TiposEsquemaConfigIn(BaseModel):
    activos: list[str]


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


async def _resolver_config_contexto(
    ctx: ContextoAplicacion,
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
) -> tuple[AzdoConfig | None, str]:
    """Resuelve la config de Azure DevOps válida para el contexto.

    En modo operativo usa la aplicación activa. En modo consolidado recorre las
    aplicaciones autorizadas y devuelve la primera que tenga org_url y PAT, para
    que un administrador con varias aplicaciones pueda consultar Azure DevOps sin
    tener que seleccionar una concreta.

    Devuelve la config y el código de aplicación con el que se resolvió.
    """
    if not ctx.modo_consolidado:
        return await _resolver_config(ctx.codigo, target, squad_id, usuario_id), ctx.codigo

    for codigo in ctx.codigos:
        cfg = await _resolver_config(codigo, target, squad_id, usuario_id)
        if cfg and cfg.org_url and cfg.pat:
            return cfg, codigo
    return None, ctx.codigos[0] if ctx.codigos else ""


async def _crear_servicio_desde_config(cfg: AzdoConfig) -> AzureDevOpsService:
    if not cfg.org_url or not cfg.pat:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Falta configurar URL de organización y/o PAT en la vista de Azure DevOps.",
        )
    return AzureDevOpsService(cfg.org_url, cfg.pat)


def _separar_csv(valor: str | None) -> list[str]:
    if not valor:
        return []
    return [parte.strip() for parte in valor.split(",") if parte.strip()]


async def _persona_de_usuario(usuario: Usuario) -> str | None:
    """Devuelve el id de la Persona vinculada al usuario, si existe."""
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


def _es_superadmin_configurado(usuario: Usuario) -> bool:
    """Indica si el usuario es el superadministrador configurado en settings."""
    settings = get_settings()
    return usuario.email.strip().lower() == settings.superadmin_email.strip().lower()


async def _usuario_id_efectivo(usuario: Usuario, usuario_id: str | None) -> str | None:
    """Devuelve el usuario_id solicitado si está permitido, o la persona del usuario.

    Solo el superadministrador configurado puede consultar con la configuración de
    otra persona; el resto queda restringido a la suya.
    """
    propia = await _persona_de_usuario(usuario)
    if not usuario_id:
        return propia
    if usuario_id == propia:
        return usuario_id
    if _es_superadmin_configurado(usuario):
        return usuario_id
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        "Solo puedes consultar Azure DevOps con tu propia configuración.",
    )


async def _validar_propiedad_usuario(usuario: Usuario, usuario_id: str | None) -> None:
    """Impide configurar el Azure DevOps de otra persona salvo al superadmin."""
    if not usuario_id:
        return
    if _es_superadmin_configurado(usuario):
        return
    if usuario_id != await _persona_de_usuario(usuario):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Solo puedes configurar tu propio Azure DevOps.",
        )


async def _resolver_proyecto_esquema(
    proyecto: str | None,
    cfg: AzdoConfig,
) -> str:
    proyecto_resuelto = (proyecto or "").strip() or (cfg.default_project or "").strip()
    if not proyecto_resuelto:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Falta configurar el proyecto por defecto de Azure DevOps.",
        )
    return proyecto_resuelto


def _mensaje_azure(exc: Exception, longitud_maxima: int = 300) -> str | None:
    """Extrae solo el mensaje seguro de Azure desde el RuntimeError del cliente."""
    if not isinstance(exc, RuntimeError):
        return None
    match = re.match(r"^Azure DevOps API \d+: (?P<mensaje>.*)", str(exc), re.DOTALL)
    if not match:
        return None
    mensaje = " ".join(match.group("mensaje").split())
    if len(mensaje) > longitud_maxima:
        return f"{mensaje[:longitud_maxima].rstrip()}..."
    return mensaje


def _mapear_error_esquema(exc: Exception, proyecto: str) -> ErrorDominio:
    """Traduce un fallo de la API de esquema a un error de dominio.

    Un 404 de Azure DevOps sobre una ruta de ámbito de proyecto casi siempre
    significa que el proyecto configurado no existe o no es accesible; ese caso
    merece un mensaje accionable. Para errores de API de Azure se muestra solo
    el mensaje acotado que devuelve Azure, sin trazas ni datos internos; los
    fallos de red conservan el mensaje neutro de ``ErrorIntegracion``.
    """
    mensaje_azure = _mensaje_azure(exc)
    if isinstance(exc, RuntimeError) and str(exc).startswith("Azure DevOps API 404:"):
        return NoEncontrado(
            f"El proyecto '{proyecto}' no existe o no es accesible en Azure DevOps. "
            "Revisa el proyecto por defecto configurado."
        )
    if not mensaje_azure:
        return ErrorIntegracion("No se pudo obtener el esquema de Azure DevOps.")
    if "VS402337" in mensaje_azure:
        return ErrorIntegracion(
            "La consulta supera el límite de 20.000 work items de Azure DevOps. "
            "Acótala configurando iteraciones para el squad. "
            f"Detalle de Azure: {mensaje_azure}"
        )
    if "TF51011" in mensaje_azure:
        return ErrorIntegracion(
            "La ruta de iteración configurada no existe en Azure DevOps. Escríbela "
            "completa, empezando por el nombre del proyecto. "
            f"Detalle de Azure: {mensaje_azure}"
        )
    return ErrorIntegracion(
        f"No se pudo obtener el esquema de Azure DevOps. Detalle de Azure: {mensaje_azure}"
    )


def _tipos_desde_jerarquia(jerarquia: list[dict]) -> list[str]:
    tipos: list[str] = []
    vistos: set[str] = set()
    for nivel in jerarquia:
        for tipo in nivel.get("tipos", []):
            if tipo and tipo not in vistos:
                tipos.append(tipo)
                vistos.add(tipo)
    return tipos


async def _tipos_esquema_por_defecto(svc: AzureDevOpsService, proyecto: str) -> list[str]:
    jerarquia = await svc.obtener_jerarquia_backlog(proyecto)
    tipos = _tipos_desde_jerarquia(jerarquia)
    if tipos:
        return tipos

    mapa_tipos = await svc.obtener_tipos_work_item(proyecto)
    tipos = [
        mapa_tipos[clave]
        for clave in ("feature", "userStory", "task", "bug")
        if mapa_tipos.get(clave)
    ]
    nombres_proceso = await svc.obtener_tipos_proceso(proyecto)
    epic = next(
        (tipo["nombre"] for tipo in nombres_proceso if tipo.get("nombre", "").lower() == "epic"),
        None,
    )
    if epic and epic not in tipos:
        tipos.insert(0, epic)
    return tipos


async def _tipos_esquema_activos(
    cfg: AzdoConfig,
    svc: AzureDevOpsService,
    proyecto: str,
) -> list[str]:
    """Devuelve tipos configurados o el valor por defecto histórico."""
    if cfg.tipos_esquema_activos:
        return cfg.tipos_esquema_activos
    return await _tipos_esquema_por_defecto(svc, proyecto)


def _construir_arbol(items: list[dict]) -> list[dict]:
    indice = {item["azdo_id"]: {**item, "hijos": []} for item in items}
    raices: list[dict] = []
    colocados: set[int] = set()

    def crea_ciclo(nodo_id: int, padre_id: int) -> bool:
        visitados = {nodo_id}
        actual_id: int | None = padre_id
        while actual_id is not None and actual_id in indice:
            if actual_id in visitados:
                return True
            visitados.add(actual_id)
            siguiente_id = indice[actual_id].get("parent_id")
            actual_id = siguiente_id if isinstance(siguiente_id, int) else None
        return False

    for nodo_id in sorted(indice):
        if nodo_id in colocados:
            continue
        nodo = indice[nodo_id]
        parent_id = nodo.get("parent_id")
        if (
            isinstance(parent_id, int)
            and parent_id in indice
            and not crea_ciclo(nodo_id, parent_id)
        ):
            indice[parent_id]["hijos"].append(nodo)
        else:
            raices.append(nodo)
        colocados.add(nodo_id)

    def ordenar(nodos: list[dict]) -> None:
        nodos.sort(key=lambda n: n["azdo_id"])
        for nodo in nodos:
            ordenar(nodo["hijos"])

    ordenar(raices)
    return raices


def _normalizar_iteracion_para_comparar(iteracion: str) -> str:
    return iteracion.strip(" \t\r\n\\").casefold()


def _ruta_empieza_por_proyecto(ruta: str, proyecto: str) -> bool:
    ruta_normalizada = _normalizar_iteracion_para_comparar(ruta)
    proyecto_normalizado = _normalizar_iteracion_para_comparar(proyecto)
    return bool(
        ruta_normalizada
        and proyecto_normalizado
        and (
            ruta_normalizada == proyecto_normalizado
            or ruta_normalizada.startswith(f"{proyecto_normalizado}\\")
        )
    )


def _normalizar_iteracion_con_proyecto(iteracion: str, proyecto: str) -> str:
    """Completa rutas cortas porque Azure exige iteraciones con nombre de proyecto.

    Los administradores pueden escribir ``CRM`` por comodidad, pero WIQL necesita
    ``Proyecto\\CRM``. Una ruta que ya empieza por el proyecto se conserva intacta.
    """
    ruta = iteracion.strip(" \t\r\n\\")
    proyecto_limpio = proyecto.strip(" \t\r\n\\")
    if not ruta or not proyecto_limpio or _ruta_empieza_por_proyecto(ruta, proyecto_limpio):
        return ruta
    return f"{proyecto_limpio}\\{ruta}"


def _normalizar_iteraciones_con_proyecto(iteraciones: list[str], proyecto: str) -> list[str]:
    normalizadas: list[str] = []
    vistas: set[str] = set()
    for iteracion in iteraciones:
        normalizada = _normalizar_iteracion_con_proyecto(iteracion, proyecto)
        if normalizada and normalizada not in vistas:
            normalizadas.append(normalizada)
            vistas.add(normalizada)
    return normalizadas


def _iteracion_habilitada(iteracion: str, permitida: str) -> bool:
    """Indica si una iteración coincide con una permitida o cuelga de ella."""
    pedida = _normalizar_iteracion_para_comparar(iteracion)
    base = _normalizar_iteracion_para_comparar(permitida)
    return bool(pedida and base and (pedida == base or pedida.startswith(f"{base}\\")))


async def _iteraciones_permitidas_contexto(ctx: ContextoAplicacion) -> list[str]:
    """Une las iteraciones habilitadas de las aplicaciones del contexto."""
    aplicaciones = await Aplicacion.find({"codigo": {"$in": ctx.codigos}}).to_list()
    por_codigo = {app.codigo: app for app in aplicaciones}
    permitidas: list[str] = []
    vistas: set[str] = set()
    for codigo in ctx.codigos:
        app = por_codigo.get(codigo)
        if app is None:
            continue
        for iteracion in app.iteraciones_lista():
            if iteracion not in vistas:
                permitidas.append(iteracion)
                vistas.add(iteracion)
    return permitidas


def _resolver_iteraciones_consulta(
    iteraciones_permitidas: list[str],
    iteration_path: str | None,
    proyecto: str,
) -> tuple[list[str] | None, bool]:
    """Resuelve las rutas de iteración que se enviarán a WIQL."""
    permitidas = _normalizar_iteraciones_con_proyecto(iteraciones_permitidas, proyecto)
    pedida = (
        _normalizar_iteracion_con_proyecto(iteration_path, proyecto) if iteration_path else ""
    )
    if not permitidas:
        return ([pedida] if pedida else None), False

    if pedida:
        habilitada = any(_iteracion_habilitada(pedida, permitida) for permitida in permitidas)
        if not habilitada:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "La iteración solicitada no está habilitada para el squad.",
            )
        return [pedida], True

    return permitidas, True


# ── Endpoints de configuración ──

@router.get("/config", dependencies=[permiso("azure_devops.ver")])
async def obtener_config(
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Devuelve la config AzDO por target (hitss|epm) y jerarquía user > squad > app."""
    target = _normalizar_target(target)
    await _validar_propiedad_usuario(usuario, usuario_id)
    cfg, _ = await _resolver_config_contexto(ctx, target, squad_id, usuario_id)
    if not cfg:
        return {
            "scope": "app",
            "target": target,
            "org_url": "",
            "pat_guardado": False,
            "pat": "",
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
        "pat": cfg.pat or "",
        "default_project": cfg.default_project,
        "sync_interval": cfg.sync_interval,
        "squad_id": cfg.squad_id,
        "usuario_id": cfg.usuario_id,
        "learned_fields": cfg.learned_fields,
    }


@router.get("/config/all", dependencies=[permiso("azure_devops.ver")])
async def listar_configs(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    """Lista todas las configuraciones AzDO de la aplicación (app, squads, users)."""
    configs = await AzdoConfig.find(ctx.filtro()).sort("scope").to_list()
    return [
        {
            "id": str(c.id),
            "aplicacion_id": c.aplicacion_id,
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
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: object = permiso("azure_devops.editar"),
):
    """Guarda la config AzDO para HITSS o EPM según ``target``."""
    target = _normalizar_target(datos.target)
    await _validar_propiedad_usuario(usuario, datos.usuario_id)
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
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: object = permiso("azure_devops.editar"),
):
    """Elimina una config de squad o usuario (no permite eliminar la de app)."""
    if not squad_id and not usuario_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Solo se pueden eliminar configs de squad o usuario, no la global.",
        )
    await _validar_propiedad_usuario(usuario, usuario_id)
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


@router.get("/personas-config", dependencies=[permiso("azure_devops.ver")])
async def personas_config(
    target: str = "hitss",
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    """Lista las personas que el usuario puede configurar y su estado de config.

    Solo el superadmin puede elegir cualquier persona; el resto solo se ve a sí
    mismo. Para cada persona se indica si ya tiene config de Azure DevOps para el
    ``target`` dado, sin exponer nunca el PAT.
    """
    target = _normalizar_target(target)
    puede_elegir_cualquiera = _es_superadmin_configurado(usuario)
    persona_propia_id = await _persona_de_usuario(usuario)

    if puede_elegir_cualquiera:
        personas = (
            await Persona.find(ctx.filtro(), Persona.activo == True)  # noqa: E712
            .sort("nombre")
            .to_list()
        )
    elif persona_propia_id:
        persona = await Persona.get(persona_propia_id)
        personas = [persona] if persona else []
    else:
        personas = []

    scope_user = _scope_config("user", target)
    configs = await AzdoConfig.find(ctx.filtro(), AzdoConfig.scope == scope_user).to_list()
    mapa_config = {c.usuario_id: c for c in configs if c.usuario_id}

    salida = []
    for persona in personas:
        cfg = mapa_config.get(str(persona.id))
        salida.append(
            {
                "id": str(persona.id),
                "nombre": persona.nombre,
                "email": persona.email or "",
                "tiene_config": cfg is not None,
                "org_url": cfg.org_url if cfg else "",
                "default_project": cfg.default_project if cfg else "",
            }
        )

    return {
        "puede_elegir_cualquiera": puede_elegir_cualquiera,
        "persona_propia_id": persona_propia_id,
        "personas": salida,
    }


# ── Test de conexión ──

@router.get("/test", dependencies=[permiso("azure_devops.ver")])
async def test_conexion(
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    """Verifica la conexión con Azure DevOps usando la config resuelta."""
    usuario_id_efectivo = await _usuario_id_efectivo(usuario, usuario_id)
    cfg, _ = await _resolver_config_contexto(ctx, target, squad_id, usuario_id_efectivo)
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
    _: object = permiso("azure_devops.editar"),
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

        campos_lista: list[dict[str, Any]] = []
        # Campos estándar siempre requeridos
        standard: dict[str, dict[str, Any]] = {
            "System.Title": {
                "name": "Title",
                "type": "string",
                "default": "(nombre de la tarea)",
            },
        }
        if logical_name == "task":
            standard.update({
                "Microsoft.VSTS.Common.Activity": {
                    "name": "Activity",
                    "type": "string",
                    "default": "Development",
                },
                "Microsoft.VSTS.Scheduling.OriginalEstimate": {
                    "name": "Original Estimate",
                    "type": "double",
                    "default": 0,
                },
                "Microsoft.VSTS.Scheduling.RemainingWork": {
                    "name": "Remaining Work",
                    "type": "double",
                    "default": 0,
                },
                "Microsoft.VSTS.Scheduling.CompletedWork": {
                    "name": "Completed Work",
                    "type": "double",
                    "default": 0,
                },
                "Microsoft.VSTS.Scheduling.StartDate": {
                    "name": "Start Date",
                    "type": "dateTime",
                    "default": "(fecha actual)",
                },
                "Microsoft.VSTS.Scheduling.FinishDate": {
                    "name": "Finish Date",
                    "type": "dateTime",
                    "default": "(fecha actual)",
                },
            })
        elif logical_name == "userStory":
            standard.update({
                "System.Description": {
                    "name": "Description",
                    "type": "html",
                    "default": "<div>(título)</div>",
                },
                "Microsoft.VSTS.Common.AcceptanceCriteria": {
                    "name": "Acceptance Criteria",
                    "type": "html",
                    "default": "<div>(título)</div>",
                },
                "Microsoft.VSTS.Scheduling.StartDate": {
                    "name": "Start Date",
                    "type": "dateTime",
                    "default": "(fecha actual)",
                },
                "Microsoft.VSTS.Scheduling.FinishDate": {
                    "name": "Finish Date",
                    "type": "dateTime",
                    "default": "(fecha actual)",
                },
            })
        elif logical_name == "feature":
            standard.update({
                "Microsoft.VSTS.Scheduling.StartDate": {
                    "name": "Start Date",
                    "type": "dateTime",
                    "default": "(fecha actual)",
                },
                "Microsoft.VSTS.Scheduling.TargetDate": {
                    "name": "Target Date",
                    "type": "dateTime",
                    "default": "(fecha actual)",
                },
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

@router.get("/proyectos", dependencies=[permiso("azure_devops.ver")])
async def proyectos(
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> list[dict]:
    usuario_id_efectivo = await _usuario_id_efectivo(usuario, usuario_id)
    cfg, _ = await _resolver_config_contexto(ctx, target, squad_id, usuario_id_efectivo)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin configuración de Azure DevOps.")
    svc = await _crear_servicio_desde_config(cfg)
    try:
        return await svc.obtener_proyectos()
    except RuntimeError as exc:
        # El mensaje de RuntimeError incluye el cuerpo crudo de la respuesta de
        # Azure DevOps (ADR-0008 E4): ErrorIntegracion queda >=500, así que el
        # handler global de app/errors.py lo registra completo (con la cadena
        # `from exc`) y al cliente solo le llega un mensaje neutro + error_id.
        raise ErrorIntegracion("No se pudo obtener los proyectos de Azure DevOps.") from exc


@router.get("/iteraciones", dependencies=[permiso("azure_devops.ver")])
async def iteraciones(
    proyecto: str,
    target: str = "hitss",
    squad_id: str | None = None,
    usuario_id: str | None = None,
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> list[dict]:
    usuario_id_efectivo = await _usuario_id_efectivo(usuario, usuario_id)
    cfg, _ = await _resolver_config_contexto(ctx, target, squad_id, usuario_id_efectivo)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin configuración de Azure DevOps.")
    svc = await _crear_servicio_desde_config(cfg)
    try:
        return await svc.obtener_iteraciones(proyecto)
    except RuntimeError as exc:
        raise ErrorIntegracion("No se pudo obtener las iteraciones de Azure DevOps.") from exc


# ── Esquema de Azure DevOps (solo lectura en vivo) ──

@router.get("/esquema/tipos", dependencies=[permiso("azure_devops.ver")])
async def esquema_tipos(
    target: str = "hitss",
    proyecto: str | None = None,
    usuario_id: str | None = None,
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    target = _normalizar_target(target)
    usuario_id_efectivo = await _usuario_id_efectivo(usuario, usuario_id)
    cfg, _ = await _resolver_config_contexto(ctx, target, None, usuario_id_efectivo)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin configuración de Azure DevOps.")
    proyecto_resuelto = await _resolver_proyecto_esquema(proyecto, cfg)
    svc = await _crear_servicio_desde_config(cfg)
    try:
        return {
            "proyecto": proyecto_resuelto,
            "tipos": await svc.obtener_tipos_proceso(proyecto_resuelto),
            "jerarquia": await svc.obtener_jerarquia_backlog(proyecto_resuelto),
        }
    except (RuntimeError, httpx.HTTPError) as exc:
        raise _mapear_error_esquema(exc, proyecto_resuelto) from exc


@router.get("/esquema/iteraciones-permitidas", dependencies=[permiso("azure_devops.ver")])
async def esquema_iteraciones_permitidas(
    target: str = "hitss",
    proyecto: str | None = None,
    usuario_id: str | None = None,
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    target = _normalizar_target(target)
    usuario_id_efectivo = await _usuario_id_efectivo(usuario, usuario_id)
    cfg, _ = await _resolver_config_contexto(ctx, target, None, usuario_id_efectivo)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin configuración de Azure DevOps.")
    proyecto_resuelto = await _resolver_proyecto_esquema(proyecto, cfg)
    iteraciones = _normalizar_iteraciones_con_proyecto(
        await _iteraciones_permitidas_contexto(ctx),
        proyecto_resuelto,
    )
    return {"proyecto": proyecto_resuelto, "iteraciones": iteraciones}


@router.get("/esquema/tipos-config", dependencies=[permiso("azure_devops.ver")])
async def esquema_tipos_config(
    target: str = "hitss",
    proyecto: str | None = None,
    usuario_id: str | None = None,
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    target = _normalizar_target(target)
    usuario_id_efectivo = await _usuario_id_efectivo(usuario, usuario_id)
    cfg, _ = await _resolver_config_contexto(ctx, target, None, usuario_id_efectivo)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin configuración de Azure DevOps.")
    proyecto_resuelto = await _resolver_proyecto_esquema(proyecto, cfg)
    svc = await _crear_servicio_desde_config(cfg)
    try:
        disponibles = await svc.obtener_tipos_proceso(proyecto_resuelto)
        activos = await _tipos_esquema_activos(cfg, svc, proyecto_resuelto)
        return {"disponibles": disponibles, "activos": activos}
    except (RuntimeError, httpx.HTTPError) as exc:
        raise _mapear_error_esquema(exc, proyecto_resuelto) from exc


@router.put("/esquema/tipos-config")
async def guardar_esquema_tipos_config(
    datos: TiposEsquemaConfigIn,
    target: str = "hitss",
    proyecto: str | None = None,
    usuario_id: str | None = None,
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: object = permiso("azure_devops.editar"),
) -> dict:
    target = _normalizar_target(target)
    usuario_id_efectivo = await _usuario_id_efectivo(usuario, usuario_id)
    cfg, _ = await _resolver_config_contexto(ctx, target, None, usuario_id_efectivo)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin configuración de Azure DevOps.")
    proyecto_resuelto = await _resolver_proyecto_esquema(proyecto, cfg)
    activos: list[str] = []
    vistos: set[str] = set()
    for tipo in datos.activos:
        nombre = tipo.strip()
        if nombre and nombre not in vistos:
            activos.append(nombre)
            vistos.add(nombre)
    cfg.tipos_esquema_activos = activos
    cfg.marcar_actualizado()
    await cfg.save()
    return {"proyecto": proyecto_resuelto, "activos": cfg.tipos_esquema_activos}


@router.get("/esquema/arbol", dependencies=[permiso("azure_devops.ver")])
async def esquema_arbol(
    target: str = "hitss",
    proyecto: str | None = None,
    tipos: str | None = None,
    area_path: str | None = None,
    iteration_path: str | None = None,
    estados: str | None = None,
    limite: int = 2000,
    usuario_id: str | None = None,
    usuario: Usuario = Depends(usuario_actual),
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
) -> dict:
    target = _normalizar_target(target)
    usuario_id_efectivo = await _usuario_id_efectivo(usuario, usuario_id)
    cfg, aplicacion_id = await _resolver_config_contexto(ctx, target, None, usuario_id_efectivo)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Sin configuración de Azure DevOps.")
    proyecto_resuelto = await _resolver_proyecto_esquema(proyecto, cfg)
    svc = await _crear_servicio_desde_config(cfg)
    limite = min(limite, 5000)
    tipos_consultados = _separar_csv(tipos)
    estados_consultados = _separar_csv(estados)
    iteraciones_permitidas = await _iteraciones_permitidas_contexto(ctx)
    iteraciones_consulta, filtrado_por_squad = _resolver_iteraciones_consulta(
        iteraciones_permitidas,
        iteration_path,
        proyecto_resuelto,
    )

    try:
        if not tipos_consultados:
            tipos_consultados = await _tipos_esquema_activos(cfg, svc, proyecto_resuelto)
            if not tipos_consultados:
                logger.warning(
                    "No se pudo determinar ningún tipo de work item para el proyecto "
                    "(proyecto=%s, aplicacion_id=%s); se consultará el esquema sin "
                    "filtro de tipo.",
                    proyecto_resuelto,
                    aplicacion_id,
                )
        items, truncado = await svc.obtener_work_items_esquema(
            proyecto_resuelto,
            tipos_consultados,
            area_path=area_path,
            iteration_paths=iteraciones_consulta,
            estados=estados_consultados or None,
            limite=limite,
        )
        return {
            "proyecto": proyecto_resuelto,
            "total": len(items),
            "truncado": truncado,
            "tipos_consultados": tipos_consultados,
            "iteraciones_aplicadas": iteraciones_consulta or [],
            "filtrado_por_squad": filtrado_por_squad,
            "nodos": _construir_arbol(items),
        }
    except (RuntimeError, httpx.HTTPError) as exc:
        raise _mapear_error_esquema(exc, proyecto_resuelto) from exc


# ── Work items y sync ──

@router.get("/work-items", dependencies=[permiso("azure_devops.ver")])
async def listar_work_items(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    return await AzdoWorkItem.find(ctx.filtro()).to_list()


@router.get("/sync-log", dependencies=[permiso("azure_devops.ver")])
async def listar_sync_log(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    return await AzdoSyncLog.find(ctx.filtro()).sort("-iniciado_en").to_list()


@router.post("/sync")
async def sincronizar(
    datos: SyncIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    _: object = permiso("azure_devops.editar"),
) -> dict:
    """Sincroniza los work items de una iteración de Azure DevOps.

    Un ``ValueError`` (falta configurar org_url/PAT) lo traduce a 400 el
    handler global. Antes también se atrapaba cualquier ``Exception`` y se
    devolvía ``f"Error de Azure DevOps: {exc}"`` en un 502 (ADR-0008 E4): eso
    filtraba al cliente el cuerpo crudo de la respuesta de Azure DevOps y,
    además, un bug de programación propio (no de Azure DevOps) también salía
    como "Error de Azure DevOps" (ADR-0008 E3). Ahora solo se traducen a
    ``ErrorIntegracion`` los fallos de red/API reales; cualquier otra
    excepción cae en la red de seguridad de ``main.py`` (500 genérico).
    """
    try:
        return await sincronizar_iteracion(
            ctx.codigo, datos.azdo_project, datos.iteration_path, datos.target
        )
    except (RuntimeError, httpx.HTTPError) as exc:
        raise ErrorIntegracion("No se pudo sincronizar con Azure DevOps.") from exc
