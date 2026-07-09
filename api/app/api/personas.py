"""Router de personas (directorio operativo del dominio)."""
import unicodedata
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.asignacion import Asignacion
from app.documents.azdo import AzdoWorkItem
from app.documents.capacidad import Capacidad
from app.documents.persona import Persona
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion
from app.security.deps import es_superadmin, requiere_permiso, usuario_actual

router = APIRouter(prefix="/personas", tags=["personas"])

ROLES_PERSONA_DEFAULT = ["DEV", "LT_HITSS", "LT_EPM", "SCRUM", "EPM", "COORD", "LECTOR"]


class PersonaIn(BaseModel):
    nombre: str
    email: str | None = None
    rol_operativo: str = "DEV"
    activo: bool = True
    squads: list[str] = []
    es_lider_tecnico: bool = False
    permite_sobrecarga: bool = False
    usuario_id: str | None = None
    aplicacion_id: str | None = None  # requerido en modo consolidado; derivado del squad si no se indica


# ── helpers deduplicación ──────────────────────────────────────────────────────

def _norm_nombre(s: str) -> str:
    """Normaliza nombre: sin acentos, sin mayúsculas, sin espacios extra."""
    n = unicodedata.normalize("NFKD", (s or "").strip().lower())
    n = "".join(c for c in n if not unicodedata.combining(c))
    return " ".join(n.split())  # colapsa espacios múltiples


def _score_persona(p: Persona) -> tuple:
    """Puntuación para elegir cuál persona conservar (mayor = más completa)."""
    score = (3 if p.email else 0) + (2 if p.usuario_id else 0) + len(p.squads or []) + (1 if p.activo else 0)
    ts = p.creado_en.timestamp() if p.creado_en else 0
    return (score, -ts)  # más antiguo gana en caso de empate


def _persona_resumen(p: Persona) -> dict:
    score = (3 if p.email else 0) + (2 if p.usuario_id else 0) + len(p.squads or []) + (1 if p.activo else 0)
    return {
        "id": str(p.id),
        "nombre": p.nombre,
        "email": p.email,
        "squads": p.squads or [],
        "activo": p.activo,
        "aplicacion_id": p.aplicacion_id,
        "score": score,
    }


def _agrupar_duplicados(todas: list[Persona]) -> dict[tuple, list[Persona]]:
    grupos: dict[tuple, list[Persona]] = defaultdict(list)
    for p in todas:
        # Normaliza nombre (sin acentos, sin mayúsculas, sin espacios extra)
        # y rol (siempre MAYÚSCULAS) para agrupar correctamente
        clave = (_norm_nombre(p.nombre), (p.rol_operativo or "").strip().upper())
        grupos[clave].append(p)
    return grupos


@router.get("/roles")
async def obtener_roles():
    """Devuelve la lista de roles configurados para personas (global)."""
    from app.documents.configuracion import Configuracion
    config = await Configuracion.find_one(
        Configuracion.clave == "roles_persona",
    )
    if config and config.valor:
        return [r.strip() for r in config.valor.split(",") if r.strip()]
    return ROLES_PERSONA_DEFAULT


# ── GET /duplicados ────────────────────────────────────────────────────────────
@router.get("/duplicados")
async def listar_duplicados(ctx: ContextoAplicacion = Depends(contexto_aplicacion)) -> list[dict]:
    """Devuelve grupos de personas duplicadas (mismo nombre + rol_operativo) en todas las apps accesibles."""
    # Siempre busca en TODAS las apps del tenant para no perderse duplicados cross-app
    todas = await Persona.find({}).to_list()
    grupos = _agrupar_duplicados(todas)

    resultado = []
    for (_, rol), lista in grupos.items():
        if len(lista) < 2:
            continue
        ordenada = sorted(lista, key=_score_persona, reverse=True)
        ganador = ordenada[0]
        resultado.append({
            "nombre": ganador.nombre,
            "rol": rol,
            "total": len(lista),
            "ganador": _persona_resumen(ganador),
            "duplicados": [_persona_resumen(p) for p in ordenada[1:]],
        })

    return sorted(resultado, key=lambda x: (x["nombre"], x["rol"]))


# ── POST /deduplicar ───────────────────────────────────────────────────────────
@router.post("/deduplicar")
async def deduplicar_personas(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: Usuario = Depends(requiere_permiso("personas.editar")),
) -> dict:
    """Fusiona personas duplicadas conservando la más completa y redirige sus referencias."""
    from app.documents.requerimiento import Requerimiento

    # Opera sobre TODAS las apps para eliminar duplicados cross-app
    todas = await Persona.find({}).to_list()
    grupos = _agrupar_duplicados(todas)

    fusionados = 0
    refs_actualizadas = 0

    for lista in grupos.values():
        if len(lista) < 2:
            continue

        ordenada = sorted(lista, key=_score_persona, reverse=True)
        ganador = ordenada[0]
        perdedores = ordenada[1:]
        gid = str(ganador.id)

        # Fusionar squads, email y usuario_id al ganador
        squads_union = list(ganador.squads or [])
        for p in perdedores:
            for sq in (p.squads or []):
                if sq not in squads_union:
                    squads_union.append(sq)
            if not ganador.email and p.email:
                ganador.email = p.email
            if not ganador.usuario_id and p.usuario_id:
                ganador.usuario_id = p.usuario_id
        ganador.squads = squads_union
        ganador.marcar_actualizado()
        await ganador.save()

        for perdedor in perdedores:
            pid = str(perdedor.id)

            # Redirigir referencias en requerimientos en TODAS las apps
            reqs = await Requerimiento.find({
                "$or": [
                    {"solicitud.lt_hitss_id": pid},
                    {"solicitud.lt_epm_id": pid},
                    {"solicitud.scrum_id": pid},
                ],
            }).to_list()
            for req in reqs:
                cambio = False
                if req.solicitud.lt_hitss_id == pid:
                    req.solicitud.lt_hitss_id = gid
                    cambio = True
                if req.solicitud.lt_epm_id == pid:
                    req.solicitud.lt_epm_id = gid
                    cambio = True
                if req.solicitud.scrum_id == pid:
                    req.solicitud.scrum_id = gid
                    cambio = True
                if cambio:
                    await req.save()
                    refs_actualizadas += 1

            # Redirigir asignaciones, capacidades y work items (no eliminar, reasignar)
            await Asignacion.get_motor_collection().update_many(
                {"persona_id": pid}, {"$set": {"persona_id": gid}}
            )
            await Capacidad.get_motor_collection().update_many(
                {"persona_id": pid}, {"$set": {"persona_id": gid}}
            )
            await AzdoWorkItem.get_motor_collection().update_many(
                {"persona_id": pid}, {"$set": {"persona_id": gid}}
            )

            await perdedor.delete()
            fusionados += 1

    return {"fusionados": fusionados, "referencias_actualizadas": refs_actualizadas}


@router.get("")
async def listar(ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    if ctx.modo_consolidado:
        return await Persona.find({"aplicacion_id": {"$in": ctx.codigos}}).sort("nombre").to_list()
    # Query por aplicacion_id + query por squad (nombre del app), unión sin duplicados
    por_id = await Persona.find({"aplicacion_id": ctx.codigo}).to_list()
    if ctx.nombre_app:
        por_squad = await Persona.find({"squads": ctx.nombre_app}).to_list()
        vistos = {str(p.id) for p in por_id}
        for p in por_squad:
            if str(p.id) not in vistos:
                por_id.append(p)
    por_id.sort(key=lambda p: p.nombre)
    return por_id


@router.get("/{persona_id}")
async def obtener(persona_id: str, ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    persona = await Persona.get(persona_id)
    if persona is None or persona.aplicacion_id not in ctx.codigos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    return persona


async def _resolver_app_id(datos: PersonaIn, ctx: ContextoAplicacion, usuario: Usuario) -> str:
    """Determina aplicacion_id: usa el explícito del body; si no, ctx.codigo.
    El superadmin puede crear en cualquier aplicación sin restricción de contexto.
    """
    if datos.aplicacion_id:
        if not await es_superadmin(usuario) and datos.aplicacion_id not in ctx.codigos:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso a esa aplicación.")
        return datos.aplicacion_id
    if ctx.modo_consolidado:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "En modo consolidado indique 'aplicacion_id' en el cuerpo.",
        )
    return ctx.codigo


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(
    datos: PersonaIn,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
    _: Usuario = Depends(requiere_permiso("personas.crear")),
):
    app_id = await _resolver_app_id(datos, ctx, usuario)
    data = datos.model_dump(exclude={"aplicacion_id"})
    persona = Persona(aplicacion_id=app_id, **data)
    await persona.insert()
    return persona


@router.put("/{persona_id}")
async def actualizar(
    persona_id: str,
    datos: PersonaIn,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: Usuario = Depends(requiere_permiso("personas.editar")),
):
    persona = await Persona.get(persona_id)
    if persona is None or persona.aplicacion_id not in ctx.codigos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    # Actualiza solo los campos operativos, preserva aplicacion_id original
    for campo, valor in datos.model_dump(exclude={"aplicacion_id"}).items():
        setattr(persona, campo, valor)
    persona.marcar_actualizado()
    await persona.save()
    return persona


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    persona_id: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    _: Usuario = Depends(requiere_permiso("personas.eliminar")),
) -> None:
    persona = await Persona.get(persona_id)
    if persona is None or persona.aplicacion_id not in ctx.codigos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    # Cascade: eliminar registros relacionados antes de borrar la persona
    await Asignacion.find(Asignacion.persona_id == persona_id).delete()
    await Capacidad.find(
        Capacidad.scope == "persona", Capacidad.persona_id == persona_id
    ).delete()
    await AzdoWorkItem.find(AzdoWorkItem.persona_id == persona_id).delete()
    await persona.delete()
