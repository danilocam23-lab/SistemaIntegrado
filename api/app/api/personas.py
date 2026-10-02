# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de personas (directorio operativo del dominio)."""
import re
import unicodedata
from collections import defaultdict
from datetime import datetime

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.errors import OperationFailure

from app.db import obtener_cliente
from app.documents.aplicacion import Aplicacion
from app.documents.asignacion import Asignacion
from app.documents.azdo import AzdoWorkItem
from app.documents.base import ahora
from app.documents.bitacora import Bitacora
from app.documents.capacidad import Capacidad
from app.documents.persona import Persona
from app.documents.squad import Squad
from app.documents.usuario import Usuario
from app.middleware.aplicacion import (
    ContextoAplicacion,
    _codigos_autorizados,
    contexto_aplicacion,
    contexto_escritura,
)
from app.security.deps import (
    es_superadmin,
    permiso,
    tiene_permiso,
    usuario_actual,
)
from app.security.rbac import PERM_ADMIN_ACCESO, PERM_PERSONAS_VER_VALORES

router = APIRouter(prefix="/personas", tags=["personas"])

ROLES_PERSONA_DEFAULT = ["DEV", "LT_HITSS", "LT_EPM", "SCRUM", "EPM", "COORD", "LECTOR"]
TIPOS_CONTRATACION_DEFAULT = ["TERMINO INDEFINIDO", "TERMINO FIJO", "PRESTACION DE SERVICIOS", "OBRA O LABOR"]


class PersonaIn(BaseModel):
    nombre: str
    email: str | None = None
    rol_operativo: str = "DEV"
    tipo_contratacion: str | None = None
    activo: bool = True
    squads: list[str] = []
    es_lider_tecnico: bool = False
    permite_sobrecarga: bool = False
    usuario_id: str | None = None
    valor_persona: float | None = None
    valor_perifericos: float | None = None
    # Solo se acepta para completar una persona ya inactiva que no tiene fecha (dato legado)
    fecha_desactivacion: datetime | None = None
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


CAMPOS_VALOR = ("valor_persona", "valor_perifericos")


def _salida(persona: Persona, ver_valores: bool) -> dict:
    """DTO de salida: misma forma que la serialización del documento, pero sin los
    valores económicos cuando el usuario no tiene ``personas.ver_valores``."""
    datos = persona.model_dump(mode="json", by_alias=True)
    if not ver_valores:
        for campo in CAMPOS_VALOR:
            datos.pop(campo, None)
    return datos


async def _validar_correo_unico(
    aplicacion_id: str, email: str | None, excluir_id: str | None = None
) -> None:
    """409 si ya existe otra persona de la aplicación con el mismo correo (sin
    distinguir mayúsculas). Un correo vacío no se valida."""
    correo = (email or "").strip()
    if not correo:
        return
    filtro: dict = {
        "aplicacion_id": aplicacion_id,
        "email": {"$regex": f"^{re.escape(correo)}$", "$options": "i"},
    }
    if excluir_id:
        filtro["_id"] = {"$ne": PydanticObjectId(excluir_id)}
    if await Persona.get_pymongo_collection().count_documents(filtro, limit=1):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe una persona con ese correo en la aplicación.",
        )


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


@router.get("/tipos-contratacion")
async def obtener_tipos_contratacion():
    """Devuelve la lista de tipos de contratación configurados para personas (global)."""
    from app.documents.configuracion import Configuracion
    config = await Configuracion.find_one(
        Configuracion.clave == "tipos_contratacion",
    )
    if config and config.valor:
        return [t.strip() for t in config.valor.split(",") if t.strip()]
    return TIPOS_CONTRATACION_DEFAULT


# ── GET /duplicados ────────────────────────────────────────────────────────────
@router.get("/duplicados", dependencies=[permiso(PERM_ADMIN_ACCESO)])
async def listar_duplicados(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    limite: int = Query(100, ge=1, le=500),
    omitir: int = Query(0, ge=0),
) -> list[dict]:
    """Devuelve grupos de personas duplicadas (mismo nombre + rol_operativo).

    Solo considera las aplicaciones del contexto (``ctx.codigos``: la activa, o todas
    las accesibles en modo consolidado). Los grupos se paginan con ``limite``/``omitir``.
    """
    todas = await Persona.find(ctx.filtro()).to_list()
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

    resultado.sort(key=lambda x: (x["nombre"], x["rol"]))
    return resultado[omitir : omitir + limite]


# ── POST /deduplicar ───────────────────────────────────────────────────────────
class FusionPersonas(BaseModel):
    """Una fusión concreta: conservar ``ganador_id`` y eliminar ``perdedor_ids``."""

    ganador_id: str
    perdedor_ids: list[str]


class DeduplicarIn(BaseModel):
    fusiones: list[FusionPersonas]


async def _fusionar_personas(
    fusiones: list[FusionPersonas],
    autor: str,
    session: AsyncClientSession | None = None,
    codigos_permitidos: list[str] | None = None,
) -> dict:
    """Aplica la lista explícita de fusiones dentro de la sesión dada (o sin sesión).

    Si se indica ``codigos_permitidos``, el ganador y cada perdedor deben pertenecer a
    esas aplicaciones; si no, la persona se trata como inexistente (404, sin filtrar
    la existencia de datos de otras aplicaciones).
    """
    from app.documents.requerimiento import Requerimiento

    fusionados = 0
    refs_actualizadas = 0

    for fusion in fusiones:
        ganador = await Persona.get(fusion.ganador_id, session=session)
        if ganador is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, f"Persona ganadora {fusion.ganador_id} no encontrada"
            )
        if codigos_permitidos is not None and ganador.aplicacion_id not in codigos_permitidos:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, f"Persona ganadora {fusion.ganador_id} no encontrada"
            )

        for perdedor_id in fusion.perdedor_ids:
            if perdedor_id == fusion.ganador_id:
                continue
            perdedor = await Persona.get(perdedor_id, session=session)
            if perdedor is None:
                continue
            if codigos_permitidos is not None and perdedor.aplicacion_id not in codigos_permitidos:
                raise HTTPException(
                    status.HTTP_404_NOT_FOUND, f"Persona perdedora {perdedor_id} no encontrada"
                )
            gid = str(ganador.id)
            pid = str(perdedor.id)

            # Fusionar squads, email y usuario_id al ganador
            squads_union = list(ganador.squads or [])
            for sq in (perdedor.squads or []):
                if sq not in squads_union:
                    squads_union.append(sq)
            # Si el perdedor es de otra app, agregar el nombre de esa app como squad
            if perdedor.aplicacion_id and perdedor.aplicacion_id != ganador.aplicacion_id:
                app_doc = await Aplicacion.find_one(
                    Aplicacion.codigo == perdedor.aplicacion_id, session=session
                )
                if app_doc and app_doc.nombre and app_doc.nombre not in squads_union:
                    squads_union.append(app_doc.nombre)
            if not ganador.email and perdedor.email:
                ganador.email = perdedor.email
            if not ganador.usuario_id and perdedor.usuario_id:
                ganador.usuario_id = perdedor.usuario_id
            ganador.squads = squads_union
            ganador.marcar_actualizado()
            await ganador.save(session=session)

            # Redirigir referencias sin rehidratar documentos completos; algunos
            # registros históricos pueden tener esquemas parciales.
            for campo in ("solicitud.lt_hitss_id", "solicitud.lt_epm_id", "solicitud.scrum_id"):
                resultado = await Requerimiento.get_pymongo_collection().update_many(
                    {campo: pid}, {"$set": {campo: gid}}, session=session
                )
                refs_actualizadas += resultado.modified_count

            await Requerimiento.get_pymongo_collection().update_many(
                {"developers_asignados": pid},
                {"$addToSet": {"developers_asignados": gid}},
                session=session,
            )
            desarrolladores = await Requerimiento.get_pymongo_collection().update_many(
                {"developers_asignados": pid},
                {"$pull": {"developers_asignados": pid}},
                session=session,
            )
            refs_actualizadas += desarrolladores.modified_count

            squads_upd = await Squad.get_pymongo_collection().update_many(
                {"lt_hitss_id": pid}, {"$set": {"lt_hitss_id": gid}}, session=session
            )
            refs_actualizadas += squads_upd.modified_count

            # Redirigir asignaciones, capacidades y work items (no eliminar, reasignar)
            asignaciones = await Asignacion.get_pymongo_collection().update_many(
                {"persona_id": pid}, {"$set": {"persona_id": gid}}, session=session
            )
            capacidades = await Capacidad.get_pymongo_collection().update_many(
                {"persona_id": pid}, {"$set": {"persona_id": gid}}, session=session
            )
            work_items = await AzdoWorkItem.get_pymongo_collection().update_many(
                {"persona_id": pid}, {"$set": {"persona_id": gid}}, session=session
            )
            refs_actualizadas += (
                asignaciones.modified_count
                + capacidades.modified_count
                + work_items.modified_count
            )

            await perdedor.delete(session=session)
            fusionados += 1

            await Bitacora(
                aplicacion_id=ganador.aplicacion_id,
                entidad_tipo="persona",
                entidad_id=gid,
                accion="deduplicar",
                descripcion=(
                    f"Persona '{perdedor.nombre}' ({pid}) fusionada en "
                    f"'{ganador.nombre}' ({gid})"
                ),
                autor=autor,
            ).insert(session=session)

    return {"fusionados": fusionados, "referencias_actualizadas": refs_actualizadas}


@router.post("/deduplicar")
async def deduplicar_personas(
    body: DeduplicarIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = permiso(PERM_ADMIN_ACCESO),
) -> dict:
    """Fusiona personas duplicadas según una lista explícita de fusiones.

    F1.6 (ADR-0008 C5): antes recalculaba los grupos de duplicados en cada
    llamada y los fusionaba TODOS sin confirmación, sobre ``Persona.find({})``
    -es decir, TODAS las aplicaciones, ignorando ``ctx``-, sin dry-run, sin
    transacción y sin bitácora, protegido solo con ``personas.editar``. Un
    error de agrupación era irreversible.

    Ahora exige la lista explícita de fusiones a aplicar (el plan que ya
    entrega ``GET /personas/duplicados``), el permiso ``admin.acceso``, y
    ``contexto_escritura`` (rechaza el modo consolidado). Cada fusión queda
    registrada en ``Bitacora``. Si el despliegue es un replica set (o
    mongos), toda la operación corre dentro de una transacción Mongo; si es
    un mongod standalone (no soporta transacciones multi-documento), se
    ejecuta igual pero sin esa garantía transaccional -mismo comportamiento
    que tenía antes este endpoint, ahora explícito en vez de silencioso-.
    """
    # ``contexto_escritura`` bloquea el modo consolidado. Las fusiones traen ids
    # explícitos: todas las personas deben pertenecer a aplicaciones accesibles del
    # usuario (la activa más las demás autorizadas, para fusionar duplicados cross-app).
    if not body.fusiones:
        return {"fusionados": 0, "referencias_actualizadas": 0}
    permitidos = sorted(set(await _codigos_autorizados(usuario)) | set(ctx.codigos))

    cliente = obtener_cliente()
    try:
        async with cliente.start_session() as session:
            async with await session.start_transaction():
                return await _fusionar_personas(
                    body.fusiones, usuario.email, session=session, codigos_permitidos=permitidos
                )
    except OperationFailure as exc:
        if exc.code != 20:  # 20 = IllegalOperation: no es un replica set/mongos
            raise
        return await _fusionar_personas(
            body.fusiones, usuario.email, session=None, codigos_permitidos=permitidos
        )


@router.get("", dependencies=[permiso("personas.ver")])
async def listar(
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
) -> list[dict]:
    """Lista las personas del contexto. Sin ``personas.ver_valores`` se omiten
    ``valor_persona`` y ``valor_perifericos`` de cada elemento."""
    ver_valores = await tiene_permiso(usuario, PERM_PERSONAS_VER_VALORES)
    if ctx.modo_consolidado:
        personas = await Persona.find(ctx.filtro()).sort("nombre").to_list()
        return [_salida(p, ver_valores) for p in personas]
    # Query por aplicacion_id + query por squad (nombre del app), unión sin duplicados
    por_id = await Persona.find(ctx.filtro()).to_list()
    if ctx.nombre_app:
        por_squad = await Persona.find({"squads": ctx.nombre_app}).to_list()
        vistos = {str(p.id) for p in por_id}
        for p in por_squad:
            if str(p.id) not in vistos:
                por_id.append(p)
    por_id.sort(key=lambda p: p.nombre)
    return [_salida(p, ver_valores) for p in por_id]


def _persona_visible(persona: Persona, ctx: ContextoAplicacion) -> bool:
    """Determina si la persona es accesible en el contexto actual: por aplicacion_id
    propia o porque su lista de squads incluye el nombre de la app/squad activo
    (igual criterio usado en el listado, para no perder personas cross-app)."""
    if ctx.modo_consolidado:
        return persona.aplicacion_id in ctx.codigos
    if persona.aplicacion_id in ctx.codigos:
        return True
    if ctx.nombre_app and ctx.nombre_app in (persona.squads or []):
        return True
    return False


async def _cargar_para_escritura(
    persona_id: str, ctx: ContextoAplicacion, usuario: Usuario
) -> tuple[Persona, list[str]]:
    """Carga la persona para modificarla/eliminarla. Además de ser visible en el
    contexto, su ``aplicacion_id`` debe estar entre las aplicaciones autorizadas del
    usuario (una persona visible solo por squad de otra app ajena no se toca).
    Devuelve la persona y los códigos autorizados."""
    try:
        persona = await Persona.get(persona_id)
    except Exception:  # id mal formado
        persona = None
    if persona is None or not _persona_visible(persona, ctx):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    autorizadas = await _codigos_autorizados(usuario)
    if persona.aplicacion_id not in autorizadas:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    return persona, autorizadas


@router.get("/{persona_id}", dependencies=[permiso("personas.ver")])
async def obtener(
    persona_id: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
) -> dict:
    try:
        persona = await Persona.get(persona_id)
    except Exception:  # id mal formado
        persona = None
    if persona is None or not _persona_visible(persona, ctx):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    return _salida(persona, await tiene_permiso(usuario, PERM_PERSONAS_VER_VALORES))


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
    _: Usuario = permiso("personas.crear"),
) -> dict:
    """Crea una persona. En modo consolidado exige ``aplicacion_id`` en el cuerpo.
    Sin ``personas.ver_valores`` los valores del cuerpo se ignoran (quedan en 0) y la
    respuesta no los incluye. 409 si el correo ya existe en la aplicación."""
    app_id = await _resolver_app_id(datos, ctx, usuario)
    ver_valores = await tiene_permiso(usuario, PERM_PERSONAS_VER_VALORES)
    data = datos.model_dump(exclude={"aplicacion_id", "fecha_desactivacion"})
    # `None` = no enviado: se conserva el valor por defecto (0) del documento.
    # Sin permiso para ver/editar valores se descartan siempre.
    for campo_valor in CAMPOS_VALOR:
        if not ver_valores or data.get(campo_valor) is None:
            data.pop(campo_valor, None)
    await _validar_correo_unico(app_id, data.get("email"))
    persona = Persona(aplicacion_id=app_id, **data)
    if not persona.activo:
        persona.fecha_desactivacion = ahora()
    await persona.insert()
    return _salida(persona, ver_valores)


@router.put("/{persona_id}")
async def actualizar(
    persona_id: str,
    datos: PersonaIn,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
    _: Usuario = permiso("personas.editar"),
) -> dict:
    """Actualización parcial: solo cambian los campos presentes en el cuerpo
    (``model_fields_set``); el resto (líder técnico, sobrecarga, usuario, squads,
    valores...) se conserva.

    * Los valores económicos exigen ``personas.ver_valores``; sin él se ignoran.
    * ``aplicacion_id`` solo se reasigna si cambia el primer squad y éste corresponde a
      otra aplicación autorizada para el usuario (403 si no); la respuesta incluye
      ``aplicacion_movida`` cuando ocurre.
    * 409 si el correo ya pertenece a otra persona de la aplicación.
    """
    persona, autorizadas = await _cargar_para_escritura(persona_id, ctx, usuario)
    ver_valores = await tiene_permiso(usuario, PERM_PERSONAS_VER_VALORES)
    enviados = datos.model_fields_set
    activo_previo = persona.activo
    fecha_previa = persona.fecha_desactivacion
    squad_principal_previo = persona.squads[0] if persona.squads else None
    email_previo = (persona.email or "").strip().lower()

    for campo in enviados - {"aplicacion_id", "fecha_desactivacion"}:
        valor = getattr(datos, campo)
        if campo in CAMPOS_VALOR and (valor is None or not ver_valores):
            continue
        if campo in ("nombre", "rol_operativo", "activo", "squads") and valor is None:
            continue
        setattr(persona, campo, valor)

    # `fecha_desactivacion` se calcula automáticamente al cambiar el estado `activo`:
    # se marca al desactivar y se limpia al reactivar. Sin transición, solo se acepta
    # la del body si la persona sigue inactiva y no tenía fecha (dato legado).
    if activo_previo and not persona.activo:
        persona.fecha_desactivacion = ahora()
    elif not activo_previo and persona.activo:
        persona.fecha_desactivacion = None
    elif not persona.activo and fecha_previa is None and datos.fecha_desactivacion is not None:
        persona.fecha_desactivacion = datos.fecha_desactivacion
    else:
        persona.fecha_desactivacion = fecha_previa

    # Si cambió el squad principal (el primero), la persona pasa a la aplicación de ese
    # squad, siempre que el usuario tenga acceso a ella.
    movida: dict | None = None
    if "squads" in enviados and persona.squads and persona.squads[0] != squad_principal_previo:
        app_doc = await Aplicacion.find_one({"nombre": persona.squads[0]})
        if app_doc and app_doc.codigo != persona.aplicacion_id:
            if app_doc.codigo not in autorizadas:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Sin acceso a la aplicación del squad principal elegido.",
                )
            movida = {"desde": persona.aplicacion_id, "hacia": app_doc.codigo}
            persona.aplicacion_id = app_doc.codigo

    correo_cambia = (persona.email or "").strip().lower() != email_previo
    if correo_cambia or movida:
        await _validar_correo_unico(persona.aplicacion_id, persona.email, str(persona.id))
    persona.marcar_actualizado()
    await persona.save()
    salida = _salida(persona, ver_valores)
    if movida:
        salida["aplicacion_movida"] = movida
    return salida


async def _contar_referencias(persona_id: str) -> tuple[int, int]:
    """Cuenta requerimientos y squads que referencian a la persona (bloquean el borrado)."""
    from app.documents.requerimiento import Requerimiento

    requerimientos = await Requerimiento.get_pymongo_collection().count_documents({
        "$or": [
            {"solicitud.lt_hitss_id": persona_id},
            {"solicitud.lt_epm_id": persona_id},
            {"solicitud.scrum_id": persona_id},
            {"developers_asignados": persona_id},
        ],
    })
    squads = await Squad.get_pymongo_collection().count_documents({"lt_hitss_id": persona_id})
    return requerimientos, squads


@router.get("/{persona_id}/impacto", dependencies=[permiso("personas.eliminar")])
async def impacto_eliminacion(
    persona_id: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
) -> dict:
    """Qué ocurriría al eliminar la persona (para el modal de confirmación).

    Devuelve los conteos de lo que la cascada borraría (asignaciones, capacidades de
    persona y work items de Azure) y las referencias que bloquean el borrado
    (requerimientos y squads; si hay alguna, ``eliminable`` es ``False`` y el DELETE
    responde 409).
    """
    persona, _autorizadas = await _cargar_para_escritura(persona_id, ctx, usuario)
    pid = str(persona.id)
    asignaciones = await Asignacion.find(Asignacion.persona_id == pid).count()
    capacidades = await Capacidad.find(
        Capacidad.scope == "persona", Capacidad.persona_id == pid
    ).count()
    work_items = await AzdoWorkItem.find(AzdoWorkItem.persona_id == pid).count()
    requerimientos, squads = await _contar_referencias(pid)
    return {
        "persona_id": pid,
        "nombre": persona.nombre,
        "cascada": {
            "asignaciones": asignaciones,
            "capacidades": capacidades,
            "work_items": work_items,
        },
        "referencias": {"requerimientos": requerimientos, "squads": squads},
        "eliminable": requerimientos == 0 and squads == 0,
    }


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    persona_id: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
    _: Usuario = permiso("personas.eliminar"),
) -> None:
    persona, _autorizadas = await _cargar_para_escritura(persona_id, ctx, usuario)
    persona_id = str(persona.id)

    referencias_requerimientos, referencias_squads = await _contar_referencias(persona_id)
    if referencias_requerimientos or referencias_squads:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "No se puede eliminar la persona porque está referenciada en requerimientos o squads. "
            "Reasigna esas referencias o usa la fusión de duplicados.",
        )

    # Cascade: eliminar registros relacionados antes de borrar la persona
    await Asignacion.find(Asignacion.persona_id == persona_id).delete()
    await Capacidad.find(
        Capacidad.scope == "persona", Capacidad.persona_id == persona_id
    ).delete()
    await AzdoWorkItem.find(AzdoWorkItem.persona_id == persona_id).delete()
    await persona.delete()
