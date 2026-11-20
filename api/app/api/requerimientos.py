# Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
# SPDX-License-Identifier: MIT

"""Router de requerimientos — núcleo del dominio de liquidación."""
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Literal

from beanie.operators import In
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from app.api.personas import _persona_visible
from app.documents.aplicacion import Aplicacion
from app.documents.bitacora import Bitacora
from app.documents.enums import EstadoRequerimiento, Tipificacion
from app.documents.estimacion import Estimacion
from app.documents.persona import Persona
from app.documents.requerimiento import Entrega, Requerimiento, SeguimientoEpm, Solicitud
from app.documents.usuario import Usuario
from app.middleware.aplicacion import (
    ContextoAplicacion,
    codigos_autorizados,
    contexto_aplicacion,
    contexto_escritura,
)
from app.schemas.requerimiento import (
    AnsCalcularIn,
    CambiarSquadIn,
    EntregaIn,
    HorasSiguienteAnioUpdate,
    RequerimientoIn,
    RequerimientoUpdate,
    SeguimientoEpmIn,
    TransicionIn,
)
from app.security.deps import (
    es_admin_app,
    es_superadmin,
    permiso,
    tiene_permiso,
    usuario_actual,
)
from app.services.ans import ANSService
from app.services.auditoria import RutaAuditada
from app.services.liquidacion import LiquidacionService
from app.services.state_machine import (
    TRANSICIONES_REQUERIMIENTO,
    puede_transitar_requerimiento,
)

router = APIRouter(prefix="/requerimientos", tags=["requerimientos"], route_class=RutaAuditada)

CAMPOS_SIGUIENTE_ANIO = frozenset({
    "horas_siguiente_anio",
    "fecha_entrega_comprometida_siguiente_anio",
    "fecha_real_entrega_siguiente_anio",
})
PERM_VER_SIGUIENTE_ANIO = "requerimientos.horas_siguiente_anio.ver"
PERM_EDITAR_SIGUIENTE_ANIO = "requerimientos.horas_siguiente_anio.editar"


def _salida(req: Requerimiento, ver_siguiente_anio: bool, incluir_entregas: bool = True) -> dict:
    """Redacta solo la respuesta, conservando el alias JSON del identificador.

    Con ``incluir_entregas=False`` (modo resumen) omite ``entregas``; la
    ``cantidad_entregas`` sigue viajando.
    """
    excluir: set[str] = set() if ver_siguiente_anio else set(CAMPOS_SIGUIENTE_ANIO)
    if not incluir_entregas:
        excluir.add("entregas")
    return req.model_dump(mode="json", by_alias=True, exclude=excluir)


async def _salida_autorizada(req: Requerimiento, usuario: Usuario) -> dict:
    return _salida(req, await tiene_permiso(usuario, PERM_VER_SIGUIENTE_ANIO))


async def _validar_edicion_siguiente_anio(datos: BaseModel, usuario: Usuario) -> None:
    """Un campo explícito, incluso null, exige el permiso especial de edición."""
    if datos.model_fields_set & CAMPOS_SIGUIENTE_ANIO and not await tiene_permiso(
        usuario, PERM_EDITAR_SIGUIENTE_ANIO
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, f"Falta el permiso: {PERM_EDITAR_SIGUIENTE_ANIO}"
        )


async def _registrar_bitacora(
    aplicacion_id: str,
    entidad_id: str,
    accion: str,
    descripcion: str,
    usuario: Usuario,
    datos_antes: dict | None = None,
    datos_despues: dict | None = None,
) -> None:
    await Bitacora(
        aplicacion_id=aplicacion_id,
        entidad_tipo="requerimiento",
        entidad_id=entidad_id,
        accion=accion,
        descripcion=descripcion,
        autor=usuario.email,
        datos_antes=datos_antes,
        datos_despues=datos_despues,
    ).insert()


def _asegurar_utc(fecha: datetime) -> datetime:
    return fecha if fecha.tzinfo is not None else fecha.replace(tzinfo=UTC)


MSG_MODIFICADO = "El requerimiento fue modificado por otra persona; recarga"

# Rol operativo que debe tener la persona de cada campo de la solicitud.
ROLES_PERSONA_SOLICITUD: dict[str, frozenset[str]] = {
    "lt_hitss_id": frozenset({"LT_HITSS"}),
    "lt_epm_id": frozenset({"LT_EPM"}),
    "scrum_id": frozenset({"SCRUM"}),
    "analista_requerimientos_id": frozenset({"SCRUM", "AR/QA"}),
}
ETIQUETAS_PERSONA = {
    "lt_hitss_id": "LT HITSS",
    "lt_epm_id": "LT EPM",
    "scrum_id": "Scrum",
    "analista_requerimientos_id": "Analista de requerimientos",
}


def _instante(fecha: datetime) -> datetime:
    """Instante en UTC, con precisión de milisegundos (la de MongoDB).

    Mongo guarda fechas sin zona (UTC) y trunca a milisegundos: dos valores que
    representan el mismo instante deben compararse como iguales.
    """
    utc = _asegurar_utc(fecha).astimezone(UTC)
    return utc.replace(microsecond=utc.microsecond // 1000 * 1000)


def _normalizar_valor(valor: object) -> object:
    """Normaliza un valor para detectar cambios reales (sin falsos positivos)."""
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return _instante(valor)
    if isinstance(valor, Decimal):
        return valor.normalize()
    if isinstance(valor, float):
        return Decimal(str(valor)).normalize()
    return valor


def _cambio_real(viejo: object, nuevo: object) -> bool:
    return _normalizar_valor(viejo) != _normalizar_valor(nuevo)


def _texto_valor(valor: object) -> str:
    return str(valor) if valor is not None else ""


def _normalizar_estado(estado: str) -> str:
    return estado.strip().upper()


_ESTADOS_BASE: dict[str, EstadoRequerimiento] = {
    _normalizar_estado(e.value): e for e in EstadoRequerimiento
}


def _validar_transicion_estado(actual: str | None, nuevo: str | None) -> None:
    """Aplica la máquina de estados solo si ambos estados son del enum base.

    Los estados son configurables por despliegue: si alguno no pertenece al enum
    no hay reglas que aplicar y se permite el cambio.
    """
    if not actual or not nuevo:
        return
    # Se compara normalizado (strip + mayúsculas) para que "entrega cargada " no
    # eluda la máquina de estados.
    a_norm, n_norm = _normalizar_estado(actual), _normalizar_estado(nuevo)
    if a_norm == n_norm:
        return
    a, n = _ESTADOS_BASE.get(a_norm), _ESTADOS_BASE.get(n_norm)
    if a is None or n is None:
        return
    if not puede_transitar_requerimiento(a, n):
        permitidos = sorted(e.value for e in TRANSICIONES_REQUERIMIENTO.get(a, set()))
        detalle = ", ".join(permitidos) if permitidos else "ninguno (estado final)"
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Transición de estado no permitida: '{actual}' → '{nuevo}'. "
            f"Estados siguientes permitidos: {detalle}",
        )


def _validar_squad(squad_id: str | None, ctx: ContextoAplicacion) -> None:
    """El squad de la solicitud es la propia aplicación activa (o está vacío)."""
    if squad_id and squad_id != ctx.codigo:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"El squad '{squad_id}' no coincide con la aplicación activa '{ctx.codigo}'. "
            "Para mover un requerimiento entre squads usa reasignar-aplicacion.",
        )


async def _validar_personas(
    ctx: ContextoAplicacion, nuevos: dict, anteriores: dict | None = None
) -> None:
    """Valida las personas de la solicitud solo cuando su id cambia (o en crear).

    Debe existir en la aplicación, estar activa y tener el rol operativo del campo.
    """
    for campo, roles in ROLES_PERSONA_SOLICITUD.items():
        persona_id = nuevos.get(campo)
        if not persona_id:
            continue
        if anteriores is not None and anteriores.get(campo) == persona_id:
            continue
        etiqueta = ETIQUETAS_PERSONA[campo]
        try:
            oid = ObjectId(persona_id)
        except (InvalidId, TypeError):
            oid = None
        persona = await Persona.get(oid) if oid is not None else None
        # Mismo criterio que GET /personas: propia de la app o con membresía (ADR-0010).
        if persona is not None and not _persona_visible(persona, ctx):
            persona = None
        if persona is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{etiqueta}: la persona '{persona_id}' no existe en esta aplicación",
            )
        if not persona.activo:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{etiqueta}: la persona '{persona.nombre}' está inactiva",
            )
        if persona.rol_operativo not in roles:
            esperado = " o ".join(sorted(roles))
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{etiqueta}: '{persona.nombre}' tiene rol {persona.rol_operativo} "
                f"y se requiere {esperado}",
            )


def _calcular_duracion(segmentos: list[dict]) -> list[dict]:
    ahora = datetime.now(UTC)
    for seg in segmentos:
        inicio = seg.get("desde")
        if inicio is None:
            seg["duracion_segundos"] = None
            seg["en_curso"] = seg.get("hasta") is None
            continue
        fin = seg.get("hasta") or ahora
        seg["duracion_segundos"] = int((_asegurar_utc(fin) - _asegurar_utc(inicio)).total_seconds())
        seg["en_curso"] = seg.get("hasta") is None
    return segmentos


async def _historial_estados_requerimiento(
    entidad_id: str, estado_actual: str, creado_en: datetime
) -> list[dict]:
    """Reconstruye, a partir de la bitácora, cuánto tiempo estuvo el
    requerimiento en cada estado y a cuál pasó. Solo se pueden distinguir
    tramos a partir de que se empezó a guardar el estado antes/después de
    forma estructurada en la bitácora (creación, transición y actualización);
    para requerimientos más antiguos sin esos datos se muestra un único
    tramo desde su creación con el estado actual."""
    registros = await Bitacora.find(
        Bitacora.entidad_tipo == "requerimiento",
        Bitacora.entidad_id == entidad_id,
        In(Bitacora.accion, ["crear", "actualizar", "transicion"]),
    ).sort("+creado_en").to_list()

    segmentos: list[dict] = []
    estado_seg: str | None = None
    inicio_seg: datetime | None = None
    for r in registros:
        nuevo = (r.datos_despues or {}).get("estado")
        if nuevo is None:
            continue
        if estado_seg is None:
            estado_seg, inicio_seg = nuevo, r.creado_en
            continue
        if nuevo != estado_seg:
            segmentos.append({"estado": estado_seg, "desde": inicio_seg, "hasta": r.creado_en})
            estado_seg, inicio_seg = nuevo, r.creado_en

    if estado_seg is not None and inicio_seg is not None:
        segmentos.append({"estado": estado_seg, "desde": inicio_seg, "hasta": None})
    else:
        segmentos.append({"estado": estado_actual, "desde": creado_en, "hasta": None})

    return _calcular_duracion(segmentos)


async def _historial_estados_entrega(entidad_id: str, numero: int, entrega: Entrega | None) -> list[dict]:
    """Igual que ``_historial_estados_requerimiento`` pero para una entrega
    puntual (por número), usando los eventos crear_entrega/actualizar_entrega
    de la bitácora, que ya guardan el estado completo de la entrega."""
    registros = await Bitacora.find(
        Bitacora.entidad_tipo == "requerimiento",
        Bitacora.entidad_id == entidad_id,
        In(Bitacora.accion, ["crear_entrega", "actualizar_entrega"]),
    ).sort("+creado_en").to_list()

    segmentos: list[dict] = []
    estado_seg: str | None = None
    inicio_seg: datetime | None = None
    for r in registros:
        despues = r.datos_despues or {}
        if despues.get("numero") != numero:
            continue
        nuevo = despues.get("estado")
        if nuevo is None:
            continue
        if estado_seg is None:
            estado_seg, inicio_seg = nuevo, r.creado_en
            continue
        if nuevo != estado_seg:
            segmentos.append({"estado": estado_seg, "desde": inicio_seg, "hasta": r.creado_en})
            estado_seg, inicio_seg = nuevo, r.creado_en

    if estado_seg is not None and inicio_seg is not None:
        segmentos.append({"estado": estado_seg, "desde": inicio_seg, "hasta": None})
    elif entrega is not None:
        segmentos.append({"estado": entrega.estado, "desde": None, "hasta": None})

    return _calcular_duracion(segmentos)


async def _buscar(ctx: ContextoAplicacion, codigo_req: str) -> Requerimiento:
    # Busca primero por _id (ObjectId) para soportar URLs únicas globalmente
    try:
        oid = ObjectId(codigo_req)
        req = await Requerimiento.find_one({**ctx.filtro(), "_id": oid})
        if req is not None:
            return req
    except InvalidId:
        pass
    # Fallback: buscar por codigo_req (compatibilidad con URLs antiguas). El mismo
    # REQ puede existir en varios squads/SC (o en varias apps en consolidado): si hay
    # más de uno no se elige uno arbitrario.
    candidatos = await Requerimiento.find(
        {**ctx.filtro(), "codigo_req": codigo_req}
    ).limit(2).to_list()
    if not candidatos:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requerimiento no encontrado")
    if len(candidatos) > 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "Código REQ ambiguo, usa el id")
    return candidatos[0]


@router.get("", dependencies=[permiso("requerimientos.ver")])
async def listar(
    response: Response,
    estado: str | None = None,
    limite: int | None = Query(default=None, ge=1, le=500),
    desde: int | None = Query(default=None, ge=0),
    resumen: bool = False,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
):
    """Lista requerimientos de la aplicación activa (o de todas en modo consolidado).

    Sin ``limite``/``desde`` devuelve la lista completa, como siempre. Con alguno de
    ellos pagina y añade la cabecera ``X-Total-Count``. ``resumen=true`` omite las
    ``entregas`` (queda ``cantidad_entregas``).
    """
    consulta = ctx.filtro()
    if estado is not None:
        consulta["estado"] = estado
    ver_siguiente_anio = await tiene_permiso(usuario, PERM_VER_SIGUIENTE_ANIO)
    paginado = limite is not None or desde is not None
    busqueda = Requerimiento.find(consulta)
    if paginado:
        response.headers["X-Total-Count"] = str(await busqueda.count())
        busqueda = busqueda.sort("-creado_en", "-_id").skip(desde or 0)
        if limite is not None:
            busqueda = busqueda.limit(limite)
    else:
        busqueda = busqueda.sort("-creado_en")
    requerimientos = await busqueda.to_list()
    return [_salida(req, ver_siguiente_anio, not resumen) for req in requerimientos]


@router.get("/transiciones", dependencies=[permiso("requerimientos.ver")])
async def listar_transiciones() -> dict[str, list[str]]:
    """Transiciones permitidas por la máquina de estados: ``{estado: [siguientes]}``."""
    return {
        actual.value: sorted(n.value for n in siguientes)
        for actual, siguientes in TRANSICIONES_REQUERIMIENTO.items()
    }


@router.post("/ans/calcular")
async def calcular_ans(
    datos: AnsCalcularIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
) -> dict:
    """Calcula el ANS por días hábiles entre dos fechas.

    Un ``ValueError`` de ``ANSService`` (p. ej. rango de fechas inválido) lo
    traduce a 400 el handler global de ``app/errors.py`` (ADR-0008 F2.6).
    """
    resultado = await ANSService.calcular(
        ctx.codigo, datos.fecha_inicio, datos.fecha_fin, datos.umbral_dias_habiles
    )
    return {"resultado": resultado.value}


@router.get("/{codigo_req}", dependencies=[permiso("requerimientos.ver")])
async def obtener(
    codigo_req: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
):
    return await _salida_autorizada(await _buscar(ctx, codigo_req), usuario)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[permiso("requerimientos.crear")],
)
async def crear(
    datos: RequerimientoIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Crea un requerimiento con su solicitud embebida."""
    await _validar_edicion_siguiente_anio(datos, usuario)
    _validar_squad(datos.solicitud.squad_id, ctx)
    if not datos.solicitud.squad_id:
        # squad == aplicación: sin squad informado se asume el de la aplicación activa.
        datos.solicitud.squad_id = ctx.codigo
    await _validar_personas(ctx, datos.solicitud.model_dump())
    existe = await Requerimiento.find_one({
        **ctx.filtro(),
        "codigo_req": datos.codigo_req,
        "solicitud.squad_id": datos.solicitud.squad_id,
        "solicitud.codigo_sc": datos.solicitud.codigo_sc,
    })
    if existe is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe un requerimiento con el mismo Código REQ, Squad y SC"
        )

    req = Requerimiento(
        aplicacion_id=ctx.codigo,
        codigo_req=datos.codigo_req,
        nombre=datos.nombre,
        solicitud=Solicitud(**datos.solicitud.model_dump()),
        estado=datos.estado,
        total_horas_estimadas=datos.total_horas_estimadas,
        horas_siguiente_anio=datos.horas_siguiente_anio,
        fecha_entrega_comprometida_siguiente_anio=datos.fecha_entrega_comprometida_siguiente_anio,
        fecha_real_entrega_siguiente_anio=datos.fecha_real_entrega_siguiente_anio,
        fecha_real_entrega_estimacion=datos.fecha_real_entrega_estimacion,
        ans_estimacion=datos.ans_estimacion,
        fecha_solicitud_acta=datos.fecha_solicitud_acta,
        seguimiento=datos.seguimiento,
        tipificacion=datos.tipificacion,
        monto_pactado=datos.monto_pactado,
        acta_trabajo=datos.acta_trabajo,
        id_azure_hitss=datos.id_azure_hitss,
        cantidad_entregas=datos.cantidad_entregas,
        categoria_id=datos.categoria_id,
        developers_asignados=datos.developers_asignados,
        fecha_inicio=datos.fecha_inicio,
        fecha_fin=datos.fecha_fin,
    )

    # Calcular fecha_limite si hay fecha_solicitud_acta
    if req.fecha_solicitud_acta is not None:
        from app.services.fecha_limite import calcular_fecha_limite
        horas = float(req.total_horas_estimadas) if req.total_horas_estimadas else None
        req.fecha_limite = await calcular_fecha_limite(
            req.aplicacion_id, req.fecha_solicitud_acta, horas
        )

    try:
        await req.insert()
    except DuplicateKeyError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe un requerimiento con el mismo Código REQ, Squad y SC",
        ) from exc
    descripcion = f"Requerimiento {req.codigo_req} creado"
    campos_bloque = sorted(datos.model_fields_set & CAMPOS_SIGUIENTE_ANIO)
    if campos_bloque:
        descripcion += "; Horas para el siguiente año: campos enviados: " + ", ".join(campos_bloque)
    await _registrar_bitacora(
        ctx.codigo,
        str(req.id),
        "crear",
        descripcion,
        usuario,
        datos_despues={"estado": req.estado},
    )
    return await _salida_autorizada(req, usuario)


@router.put(
    "/{codigo_req}",
    dependencies=[permiso("requerimientos.editar")],
)
async def actualizar(
    codigo_req: str,
    datos: RequerimientoUpdate,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Actualiza los campos enviados de un requerimiento."""
    from app.documents.enums import AnsResultado
    from app.services.fecha_limite import calcular_fecha_limite

    await _validar_edicion_siguiente_anio(datos, usuario)
    req = await _buscar(ctx, codigo_req)
    cambios = datos.model_dump(exclude_unset=True)
    leido_en = cambios.pop("actualizado_en", None)
    if leido_en is not None and _instante(leido_en) != _instante(req.actualizado_en):
        raise HTTPException(status.HTTP_409_CONFLICT, MSG_MODIFICADO)
    solo_siguiente_anio = bool(cambios) and cambios.keys() <= CAMPOS_SIGUIENTE_ANIO
    # Merge con la solicitud existente: solo se pisan los campos enviados.
    solicitud_enviada = cambios.pop("solicitud", None)
    solicitud: dict | None = None
    if solicitud_enviada is not None:
        if (
            "squad_id" in solicitud_enviada
            and not solicitud_enviada["squad_id"]
            and req.solicitud.squad_id
        ):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "No se puede borrar el squad de la solicitud",
            )
        solicitud = {**req.solicitud.model_dump(), **solicitud_enviada}
        if solicitud.get("squad_id") != req.solicitud.squad_id:
            _validar_squad(solicitud.get("squad_id"), ctx)
        await _validar_personas(ctx, solicitud, req.solicitud.model_dump())
    if "estado" in cambios:
        if not (cambios["estado"] or "").strip():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "El estado no puede estar vacío"
            )
        _validar_transicion_estado(req.estado, cambios["estado"])

    # Registrar qué campos cambiaron para la bitácora
    etiquetas = {
        "nombre": "Nombre de acta",
        "total_horas_estimadas": "Horas estimadas",
        "horas_siguiente_anio": "Horas para el siguiente año",
        "fecha_entrega_comprometida_siguiente_anio": "Fecha entrega comprometida siguiente año",
        "fecha_real_entrega_siguiente_anio": "Fecha real entrega siguiente año",
        "fecha_solicitud_acta": "Fecha solicitud acta",
        "fecha_real_entrega_estimacion": "Fecha real entrega",
        "seguimiento": "Seguimiento Hitss",
        "tipificacion": "Tipificación",
        "acta_trabajo": "Acta de trabajo",
        "id_azure_hitss": "ID de Azure (Hitss)",
        "monto_pactado": "Monto pactado",
        "cantidad_entregas": "Cantidad entregas",
        "estado": "Estado",
    }
    detalle_cambios: list[str] = []
    estado_antes: str | None = None
    estado_despues: str | None = None
    if "estado" in cambios and str(req.estado or "") != str(cambios.get("estado") or ""):
        estado_antes = req.estado
        estado_despues = cambios.get("estado")
    if solicitud is not None:
        sol_vieja = req.solicitud.model_dump()
        sol_etiquetas = {
            "codigo_sc": "Código SC", "tipo_costo": "Tipo costo",
            "squad_id": "Squad", "lt_hitss_id": "LT HITSS",
            "lt_epm_id": "LT EPM", "scrum_id": "Scrum",
            "analista_requerimientos_id": "Analista de requerimientos",
        }
        for k, label in sol_etiquetas.items():
            v_old = _texto_valor(sol_vieja.get(k))
            v_new = _texto_valor(solicitud.get(k))
            if _cambio_real(sol_vieja.get(k), solicitud.get(k)):
                detalle_cambios.append(f"{label}: '{v_old}' → '{v_new}'")
        req.solicitud = Solicitud(**solicitud)

    for campo, valor in cambios.items():
        viejo = getattr(req, campo, None)
        texto_viejo = _texto_valor(viejo)
        texto_nuevo = _texto_valor(valor)
        if _cambio_real(viejo, valor):
            label = etiquetas.get(campo, campo)
            if campo in CAMPOS_SIGUIENTE_ANIO:
                # La bitácora tiene lectura independiente: nunca copiar estos valores.
                detalle_cambios.append(f"{label}: modificado")
            else:
                detalle_cambios.append(f"{label}: '{texto_viejo}' → '{texto_nuevo}'")
        setattr(req, campo, valor)

    # El bloque informativo no recalcula ANS; el resto conserva el comportamiento previo.
    if not solo_siguiente_anio:
        if req.fecha_solicitud_acta is not None:
            horas = float(req.total_horas_estimadas) if req.total_horas_estimadas else None
            req.fecha_limite = await calcular_fecha_limite(
                req.aplicacion_id, req.fecha_solicitud_acta, horas
            )
            # Calcular ANS ACTA: comparar fecha real de entrega con fecha_limite.
            if req.fecha_real_entrega_estimacion is not None and req.fecha_limite is not None:
                if req.fecha_real_entrega_estimacion <= req.fecha_limite:
                    req.ans_acta = AnsResultado.CUMPLE
                else:
                    req.ans_acta = AnsResultado.NO_CUMPLE
            else:
                req.ans_acta = None
        else:
            req.fecha_limite = None
            req.ans_acta = None

    req.marcar_actualizado()
    if leido_en is not None:
        # Reclamo atómico: solo una de dos peticiones con la misma marca puede ganar.
        nuevo = _instante(req.actualizado_en)
        previo = _instante(leido_en)
        if nuevo <= previo:
            nuevo = previo + timedelta(milliseconds=1)
        reclamo = await Requerimiento.get_pymongo_collection().update_one(
            {"_id": req.id, "actualizado_en": previo.replace(tzinfo=None)},
            {"$set": {"actualizado_en": nuevo.replace(tzinfo=None)}},
        )
        if reclamo.matched_count == 0:
            raise HTTPException(status.HTTP_409_CONFLICT, MSG_MODIFICADO)
        req.actualizado_en = nuevo
    try:
        await req.save()
    except DuplicateKeyError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe un requerimiento con el mismo Código REQ, Squad y SC",
        ) from exc
    desc = f"Requerimiento {req.codigo_req} actualizado"
    if detalle_cambios:
        desc += ": " + "; ".join(detalle_cambios)
    await _registrar_bitacora(
        ctx.codigo,
        str(req.id),
        "actualizar",
        desc,
        usuario,
        datos_antes={"estado": estado_antes} if estado_antes is not None else None,
        datos_despues={"estado": estado_despues} if estado_despues is not None else None,
    )
    return await _salida_autorizada(req, usuario)


@router.patch(
    "/{codigo_req}/horas-siguiente-anio",
    dependencies=[permiso("requerimientos.horas_siguiente_anio.editar")],
)
async def actualizar_horas_siguiente_anio(
    codigo_req: str,
    datos: HorasSiguienteAnioUpdate,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Guarda únicamente el bloque informativo, sin recalcular ANS ni liquidación."""
    req = await _buscar(ctx, codigo_req)
    cambios = datos.model_dump(exclude_unset=True)
    modificados = [
        campo for campo, valor in cambios.items() if getattr(req, campo) != valor
    ]
    if modificados:
        for campo, valor in cambios.items():
            setattr(req, campo, valor)
        req.marcar_actualizado()
        await req.save()
        await _registrar_bitacora(
            ctx.codigo,
            str(req.id),
            "actualizar",
            "Horas para el siguiente año: campos modificados: " + ", ".join(modificados),
            usuario,
        )
    return await _salida_autorizada(req, usuario)


class AnalistaRequerimientosIn(BaseModel):
    """Cuerpo del PATCH que actualiza solo el analista de requerimientos."""

    analista_requerimientos_id: str | None = None


@router.patch("/{codigo_req}/analista")
async def actualizar_analista_requerimientos(
    codigo_req: str,
    datos: AnalistaRequerimientosIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Actualiza solo el analista de requerimientos (dentro de `solicitud`), para
    quien tenga el permiso granular 'requerimientos.analista.editar' sin necesitar
    'requerimientos.editar' completo (mismo patrón que PATCH /id-azure-hitss)."""
    puede = (
        await tiene_permiso(usuario, "requerimientos.analista.editar")
        or await tiene_permiso(usuario, "requerimientos.editar")
    )
    if not puede:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso")

    req = await _buscar(ctx, codigo_req)
    viejo = req.solicitud.analista_requerimientos_id
    if viejo == datos.analista_requerimientos_id:
        return await _salida_autorizada(req, usuario)  # sin bitácora vacía

    await _validar_personas(
        ctx,
        {"analista_requerimientos_id": datos.analista_requerimientos_id},
        {"analista_requerimientos_id": viejo},
    )
    req.solicitud.analista_requerimientos_id = datos.analista_requerimientos_id
    req.marcar_actualizado()
    await req.save()
    await _registrar_bitacora(
        ctx.codigo,
        str(req.id),
        "actualizar",
        f"Analista de requerimientos: '{viejo or ''}' → '{datos.analista_requerimientos_id or ''}'",
        usuario,
    )
    return await _salida_autorizada(req, usuario)


class IdAzureHitssIn(BaseModel):
    """Cuerpo del PATCH que actualiza solo el ID de Azure (Hitss)."""

    id_azure_hitss: int | None = None


@router.patch("/{codigo_req}/id-azure-hitss")
async def actualizar_id_azure_hitss(
    codigo_req: str,
    datos: IdAzureHitssIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Actualiza solo el ID de Azure (Hitss), para quien tenga el permiso granular
    'requerimientos.id_azure_hitss.editar' sin necesitar 'requerimientos.editar'
    completo (mismo patrón que PATCH /detalle-ans para Detalle ANS/Tipificación)."""
    puede = (
        await tiene_permiso(usuario, "requerimientos.id_azure_hitss.editar")
        or await tiene_permiso(usuario, "requerimientos.editar")
    )
    if not puede:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso")

    req = await _buscar(ctx, codigo_req)
    viejo = req.id_azure_hitss
    if viejo == datos.id_azure_hitss:
        return await _salida_autorizada(req, usuario)  # sin bitácora vacía

    req.id_azure_hitss = datos.id_azure_hitss
    req.marcar_actualizado()
    await req.save()
    await _registrar_bitacora(
        ctx.codigo,
        str(req.id),
        "actualizar",
        f"ID de Azure (Hitss): '{viejo or ''}' → '{datos.id_azure_hitss or ''}'",
        usuario,
    )
    return await _salida_autorizada(req, usuario)


@router.post(
    "/{codigo_req}/seguimientos-epm",
    dependencies=[permiso("requerimientos.editar")],
)
async def agregar_seguimiento_epm(
    codigo_req: str,
    datos: SeguimientoEpmIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Agrega un registro al historial de Seguimiento EPM (inmutable, sin borrado).

    ``seguimiento_epm`` queda como espejo del último texto para los lectores existentes.
    """
    req = await _buscar(ctx, codigo_req)
    req.seguimientos_epm.append(
        SeguimientoEpm(usuario=usuario.nombre or usuario.email, texto=datos.texto)
    )
    req.seguimiento_epm = datos.texto
    req.marcar_actualizado()
    await req.save()
    await _registrar_bitacora(
        ctx.codigo, str(req.id), "actualizar", "Seguimiento EPM agregado", usuario
    )
    return await _salida_autorizada(req, usuario)


@router.post(
    "/{codigo_req}/transicion",
    dependencies=[permiso("requerimientos.editar")],
)
async def transicion(
    codigo_req: str,
    datos: TransicionIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Cambia el estado del requerimiento validando la máquina de estados."""
    req = await _buscar(ctx, codigo_req)
    anterior = req.estado
    _validar_transicion_estado(anterior, datos.nuevo_estado)
    req.estado = datos.nuevo_estado
    req.marcar_actualizado()
    await req.save()
    await _registrar_bitacora(
        ctx.codigo,
        str(req.id),
        "transicion",
        datos.descripcion or f"Estado {anterior} -> {datos.nuevo_estado}",
        usuario,
        datos_antes={"estado": anterior},
        datos_despues={"estado": datos.nuevo_estado},
    )
    return await _salida_autorizada(req, usuario)


@router.post(
    "/{codigo_req}/entregas",
    dependencies=[permiso("requerimientos.editar")],
)
async def guardar_entrega(
    codigo_req: str,
    datos: EntregaIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Agrega o reemplaza una entrega (por número) en el requerimiento."""
    req = await _buscar(ctx, codigo_req)
    entrega_anterior = next((e for e in req.entregas if e.numero == datos.numero), None)
    payload_entrega = datos.model_dump()
    if (payload_entrega.get("estado") or "").upper() != "APROBADA":
        payload_entrega["mes_aprobacion"] = None
    if entrega_anterior is not None:
        # EntregaIn no trae estos campos: se conservan los de la entrega reemplazada.
        payload_entrega["se_levanto_ans"] = entrega_anterior.se_levanto_ans
        payload_entrega["observaciones_ans"] = entrega_anterior.observaciones_ans
    nueva = Entrega(**payload_entrega)

    # Calcular ANS: si hay fecha_recepcion, comparar con fecha_comprometida
    from app.documents.enums import AnsResultado
    if nueva.fecha_recepcion is not None and nueva.fecha_comprometida is not None:
        if nueva.fecha_recepcion <= nueva.fecha_comprometida:
            nueva.ans_entrega = AnsResultado.CUMPLE
        else:
            nueva.ans_entrega = AnsResultado.NO_CUMPLE

    req.entregas = [e for e in req.entregas if e.numero != nueva.numero]
    req.entregas.append(nueva)
    req.entregas.sort(key=lambda e: e.numero)

    # Validación: la suma de horas de las entregas no puede superar las estimadas.
    total_estimado = req.total_horas_estimadas
    if total_estimado is not None and total_estimado > 0:
        suma = sum((e.horas or Decimal("0") for e in req.entregas), Decimal("0"))
        if suma > total_estimado:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"La suma de horas de las entregas ({suma}) supera las horas "
                f"estimadas del requerimiento ({total_estimado}).",
            )
        # Recalcular el porcentaje de TODAS las entregas (cambia al agregar más).
        for entrega in req.entregas:
            entrega.porcentaje = (
                (entrega.horas / total_estimado * 100).quantize(Decimal("0.01"))
                if entrega.horas is not None
                else None
            )
    else:
        for entrega in req.entregas:
            entrega.porcentaje = None

    req.cantidad_entregas = len(req.entregas)
    req.marcar_actualizado()
    await req.save()
    accion = "actualizar_entrega" if entrega_anterior is not None else "crear_entrega"
    descripcion = (
        f"Entrega N.º {nueva.numero} actualizada"
        if entrega_anterior is not None
        else f"Entrega N.º {nueva.numero} creada"
    )
    if nueva.observaciones:
        descripcion += f" · Observaciones: {nueva.observaciones}"
    if nueva.mes_aprobacion:
        descripcion += f" · Mes aprobación: {nueva.mes_aprobacion}"
    await _registrar_bitacora(
        ctx.codigo,
        str(req.id),
        accion,
        descripcion,
        usuario,
        datos_antes=entrega_anterior.model_dump() if entrega_anterior is not None else None,
        datos_despues=nueva.model_dump(),
    )
    return await _salida_autorizada(req, usuario)


@router.delete(
    "/{codigo_req}/entregas/{numero}",
    dependencies=[permiso("requerimientos.editar")],
)
async def eliminar_entrega(
    codigo_req: str,
    numero: int,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Elimina una entrega del requerimiento por su número."""
    req = await _buscar(ctx, codigo_req)
    antes = len(req.entregas)
    req.entregas = [e for e in req.entregas if e.numero != numero]
    if len(req.entregas) == antes:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No existe la entrega {numero}")

    # Recalcular el porcentaje de las entregas restantes.
    total_estimado = req.total_horas_estimadas
    for entrega in req.entregas:
        if total_estimado is not None and total_estimado > 0 and entrega.horas is not None:
            entrega.porcentaje = (entrega.horas / total_estimado * 100).quantize(Decimal("0.01"))
        else:
            entrega.porcentaje = None

    req.cantidad_entregas = len(req.entregas)
    req.marcar_actualizado()
    await req.save()
    await _registrar_bitacora(
        ctx.codigo, str(req.id), "entrega", f"Entrega {numero} eliminada", usuario
    )
    return await _salida_autorizada(req, usuario)


@router.get(
    "/{codigo_req}/liquidacion",
    dependencies=[permiso("requerimientos.ver")],
)
async def liquidacion(
    codigo_req: str, ctx: ContextoAplicacion = Depends(contexto_aplicacion)
) -> dict:
    """Calcula el valor a facturar de cada entrega del requerimiento."""
    req = await _buscar(ctx, codigo_req)
    detalle: list[dict] = []
    total = Decimal("0")
    for entrega in req.entregas:
        try:
            valor = await LiquidacionService.valor_entrega(req, entrega)
        except ValueError as exc:
            detalle.append({"numero": entrega.numero, "error": str(exc)})
            continue
        detalle.append({"numero": entrega.numero, "valor": float(valor)})
        total += valor
    return {"codigo_req": req.codigo_req, "total": float(total), "entregas": detalle}


@router.get(
    "/{codigo_req}/historial-estados",
    dependencies=[permiso("requerimientos.ver")],
)
async def historial_estados(
    codigo_req: str, ctx: ContextoAplicacion = Depends(contexto_aplicacion)
) -> dict:
    """Historial de estados del requerimiento: cuánto tiempo estuvo en cada uno
    y a cuál pasó (el último tramo aparece como "en curso")."""
    req = await _buscar(ctx, codigo_req)
    segmentos = await _historial_estados_requerimiento(str(req.id), req.estado, req.creado_en)
    return {"codigo_req": req.codigo_req, "estado_actual": req.estado, "segmentos": segmentos}


@router.get(
    "/{codigo_req}/entregas/{numero}/historial-estados",
    dependencies=[permiso("requerimientos.ver")],
)
async def historial_estados_entrega(
    codigo_req: str, numero: int, ctx: ContextoAplicacion = Depends(contexto_aplicacion)
) -> dict:
    """Historial de estados de una entrega puntual del requerimiento."""
    req = await _buscar(ctx, codigo_req)
    entrega = next((e for e in req.entregas if e.numero == numero), None)
    segmentos = await _historial_estados_entrega(str(req.id), numero, entrega)
    return {
        "codigo_req": req.codigo_req,
        "numero": numero,
        "estado_actual": entrega.estado if entrega else None,
        "segmentos": segmentos,
    }


@router.delete(
    "/{codigo_req}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[permiso("requerimientos.eliminar")],
)
async def eliminar(
    codigo_req: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
) -> None:
    req = await _buscar(ctx, codigo_req)
    # Eliminar estimaciones asociadas (cascade)
    await Estimacion.find(
        Estimacion.aplicacion_id == ctx.codigo,
        Estimacion.requerimiento_id == str(req.id),
    ).delete()
    await _registrar_bitacora(
        ctx.codigo, str(req.id), "eliminar", f"Requerimiento {req.codigo_req} eliminado", usuario
    )
    await req.delete()


async def _buscar_unico_consolidado(ctx: ContextoAplicacion, codigo: str) -> Requerimiento:
    """Busca por ``_id``, ``codigo_req`` o ``solicitud.codigo_sc`` dentro de ``ctx.codigos``.

    404 si no hay coincidencias; 409 si el código coincide con más de un documento
    (en ese caso hay que pasar el id).
    """
    try:
        por_id = await Requerimiento.find_one({**ctx.filtro(), "_id": ObjectId(codigo)})
    except InvalidId:
        por_id = None
    if por_id is not None:
        return por_id
    for campo in ("codigo_req", "solicitud.codigo_sc"):
        candidatos = await Requerimiento.find({**ctx.filtro(), campo: codigo}).limit(2).to_list()
        if len(candidatos) > 1:
            raise HTTPException(status.HTTP_409_CONFLICT, "Código REQ ambiguo, usa el id")
        if candidatos:
            return candidatos[0]
    raise HTTPException(status.HTTP_404_NOT_FOUND, f"Requerimiento {codigo} no encontrado")


async def _exigir_administrador(usuario: Usuario) -> None:
    """Solo los roles ``superadmin`` y ``admin_app`` pueden mover entre squads."""
    if not (await es_superadmin(usuario) or await es_admin_app(usuario)):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Solo un administrador puede cambiar el squad de un requerimiento",
        )


@router.post(
    "/{codigo_req}/cambiar-squad",
    dependencies=[permiso("requerimientos.editar")],
)
async def cambiar_squad(
    codigo_req: str,
    datos: CambiarSquadIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
) -> dict:
    """[ADMIN] Mueve el requerimiento al squad (aplicación) destino desde la app activa.

    El requerimiento se busca con ``ctx.filtro()`` (aplicación de origen). Squad ==
    aplicación: se actualizan ``aplicacion_id`` y ``solicitud.squad_id``. Las LT se
    conservan; Scrum y Analista de requerimientos se limpian si no pertenecen al
    squad destino (mismo criterio de pertenencia que ``GET /personas``). Las
    estimaciones y las entradas de bitácora del requerimiento se mueven con él.
    """
    await _exigir_administrador(usuario)
    destino = (datos.squad_destino or "").strip()
    app_destino = await Aplicacion.find_one(Aplicacion.codigo == destino) if destino else None
    if app_destino is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"El squad '{destino}' no existe"
        )
    if not app_destino.activa:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"El squad '{destino}' está inactivo"
        )
    if destino == ctx.codigo:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "El squad destino es el mismo que el actual",
        )
    if destino not in await codigos_autorizados(usuario):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin acceso al squad de destino")

    req = await _buscar(ctx, codigo_req)
    origen = req.aplicacion_id
    req_id = str(req.id)

    # Pertenencia al squad destino: misma regla que el listado de personas.
    ctx_destino = ContextoAplicacion(
        [destino], modo_consolidado=False, nombre_app=app_destino.nombre
    )
    limpiadas: list[dict] = []
    for campo in ("scrum_id", "analista_requerimientos_id"):
        persona_id = getattr(req.solicitud, campo)
        if not persona_id:
            continue
        try:
            persona = await Persona.get(ObjectId(persona_id))
        except (InvalidId, TypeError):
            persona = None
        if persona is not None and _persona_visible(persona, ctx_destino):
            continue
        limpiadas.append(
            {
                "campo": campo,
                "persona_id": persona_id,
                "nombre": persona.nombre if persona is not None else None,
            }
        )
        setattr(req.solicitud, campo, None)

    req.aplicacion_id = destino
    req.solicitud.squad_id = destino
    req.marcar_actualizado()
    try:
        await req.save()
    except DuplicateKeyError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe en el squad de destino un requerimiento con el mismo "
            "Código REQ, Squad y SC",
        ) from exc

    # Hijos con aplicacion_id: siguen al requerimiento para no quedar huérfanos.
    await Estimacion.find(
        {"aplicacion_id": origen, "requerimiento_id": req_id}
    ).update({"$set": {"aplicacion_id": destino}})
    await Bitacora.find(
        {"aplicacion_id": origen, "entidad_tipo": "requerimiento", "entidad_id": req_id}
    ).update({"$set": {"aplicacion_id": destino}})

    detalle = f"Squad: {origen} → {destino}"
    if limpiadas:
        nombres = ", ".join(f"{p['campo']}={p['nombre'] or p['persona_id']}" for p in limpiadas)
        detalle += f". Personas limpiadas: {nombres}"
    # Bajo el destino, donde ya vive el historial completo del requerimiento.
    await _registrar_bitacora(
        destino,
        req_id,
        "cambiar_squad",
        detalle,
        usuario,
        datos_antes={"aplicacion_id": origen},
        datos_despues={"aplicacion_id": destino, "personas_limpiadas": limpiadas},
    )

    return {
        "requerimiento_id": req_id,
        "codigo_req": req.codigo_req,
        "aplicacion_anterior": origen,
        "aplicacion_nueva": destino,
        "personas_limpiadas": limpiadas,
    }


@router.post("/{codigo_req}/reasignar-aplicacion")
async def reasignar_aplicacion(
    codigo_req: str,
    nueva_aplicacion: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
) -> dict:
    """[ADMIN] Reasigna un requerimiento a otra aplicación.

    Nota: Solo disponible en modo consolidado (__todas__). Esta es una
    operación legítimamente cruzada entre aplicaciones (F1.3 del ADR-0008):
    a propósito usa ``contexto_aplicacion`` y no ``contexto_escritura`` (que
    rechazaría el modo consolidado que el propio endpoint exige), pero toda
    consulta se restringe explícitamente a ``ctx.codigos`` (las aplicaciones
    autorizadas para este usuario), nunca a la colección entera (S4).
    Busca por codigo_req O por solicitud.codigo_sc si es numérico.
    """
    if not await tiene_permiso(usuario, "requerimientos.editar"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado")
    await _exigir_administrador(usuario)
    if not ctx.modo_consolidado:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo en modo consolidado")

    aplicacion_destino = await Aplicacion.find_one(Aplicacion.codigo == nueva_aplicacion)
    if aplicacion_destino is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"La aplicación '{nueva_aplicacion}' no existe",
        )
    if not aplicacion_destino.activa:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"La aplicación '{nueva_aplicacion}' está inactiva",
        )
    if nueva_aplicacion not in ctx.codigos:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Sin acceso a la aplicación de destino"
        )

    # Buscar solo entre las aplicaciones autorizadas para este usuario (S4)
    req = await _buscar_unico_consolidado(ctx, codigo_req)

    app_anterior = req.aplicacion_id
    req.aplicacion_id = nueva_aplicacion
    # squad == aplicación: el squad de la solicitud sigue a la aplicación.
    req.solicitud.squad_id = nueva_aplicacion
    req.marcar_actualizado()
    try:
        await req.save()
    except DuplicateKeyError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe en la aplicación de destino un requerimiento con el mismo "
            "Código REQ, Squad y SC",
        ) from exc

    await _registrar_bitacora(
        nueva_aplicacion,
        str(req.id),
        "reasignar_aplicacion",
        f"Reasignado de {app_anterior} a {nueva_aplicacion}",
        usuario,
    )

    return {
        "codigo_req": req.codigo_req,
        "codigo_sc": req.solicitud.codigo_sc,
        "aplicacion_anterior": app_anterior,
        "aplicacion_nueva": nueva_aplicacion,
        "status": "reasignado"
    }


@router.get("/{codigo_req}/diagnostico")
async def diagnostico(
    codigo_req: str,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
    usuario: Usuario = Depends(usuario_actual),
) -> dict:
    """[ADMIN] Info de diagnóstico del requerimiento.
    
    Nota: Solo disponible para superadmin.
    Busca por codigo_req O por solicitud.codigo_sc si es numérico.
    """
    if not await tiene_permiso(usuario, "requerimientos.editar"):
       raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado")

    # Buscar en modo consolidado, pero solo entre las aplicaciones
    # autorizadas para este usuario, nunca en la colección entera (S5).
    if ctx.modo_consolidado:
        req = await _buscar_unico_consolidado(ctx, codigo_req)
    else:
        req = await _buscar(ctx, codigo_req)

    return {
        "_id": str(req.id),
        "codigo_req": req.codigo_req,
        "aplicacion_id": req.aplicacion_id,
        "estado": req.estado,
        "solicitud": {
            "codigo_sc": req.solicitud.codigo_sc,
            "squad_id": req.solicitud.squad_id,
        },
        "creado_en": req.creado_en.isoformat() if req.creado_en else None,
        "actualizado_en": req.actualizado_en.isoformat() if req.actualizado_en else None,
    }


class DetalleAnsReqUpdate(BaseModel):
    tipo: str  # 'requerimiento' o 'entrega'
    req_id: str
    entrega_numero: int | None = None
    se_levanto_ans: bool | None = None
    observaciones: str | None = None
    seguimiento: str | None = None
    observaciones_hitss: str | None = None
    # "" o null limpian el valor; cualquier otra cadena debe ser un valor del enum.
    tipificacion: Tipificacion | Literal[""] | None = None


def _texto_o_none(valor: str | None) -> str | None:
    """Normaliza cadena vacía a None (limpiar el campo)."""
    return valor or None


@router.patch("/detalle-ans")
async def actualizar_detalle_ans_req(
    body: DetalleAnsReqUpdate,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Actualiza se_levanto_ans y/u observaciones_ans de un requerimiento o entrega.

    También permite, a quienes tengan el permiso 'requerimientos.tipificacion.editar'
    (p. ej. Administrador de squad), actualizar Seguimiento Hitss/Tipificación del
    requerimiento u Observaciones Hitss/Tipificación de la entrega.
    """
    puede_ans = await tiene_permiso(usuario, "requerimientos.detalle_ans.editar") or await tiene_permiso(usuario, "requerimientos.editar")
    puede_tipificacion = puede_ans or await tiene_permiso(usuario, "requerimientos.tipificacion.editar")
    if not puede_ans and not puede_tipificacion:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso")

    try:
        oid = ObjectId(body.req_id)
    except (InvalidId, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "req_id inválido") from None
    req = await Requerimiento.find_one({**ctx.filtro(), "_id": oid})
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requerimiento no encontrado")

    # Campos "limpiables": enviar null o "" los borra; no enviarlos los deja intactos.
    enviados = body.model_fields_set
    quiere_ans = body.se_levanto_ans is not None or body.observaciones is not None
    quiere_tipificacion = bool(
        enviados & {"seguimiento", "observaciones_hitss", "tipificacion"}
    )
    if quiere_ans and not puede_ans:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso")
    if quiere_tipificacion and not puede_tipificacion:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Sin permiso")

    antes: dict = {}
    despues: dict = {}

    def _cambiar(objeto: Requerimiento | Entrega, campo: str, nuevo: str | None) -> None:
        anterior = getattr(objeto, campo)
        anterior_txt = str(anterior) if anterior is not None else None
        if anterior_txt == nuevo:
            return
        antes[campo] = anterior_txt
        despues[campo] = nuevo
        setattr(objeto, campo, nuevo)

    if body.tipo == "entrega" and body.entrega_numero is not None:
        entrega = next((e for e in (req.entregas or []) if e.numero == body.entrega_numero), None)
        if not entrega:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Entrega no encontrada")
        if body.se_levanto_ans is not None:
            entrega.se_levanto_ans = body.se_levanto_ans
        if body.observaciones is not None:
            entrega.observaciones_ans = body.observaciones
        if "observaciones_hitss" in enviados:
            _cambiar(entrega, "observaciones_hitss", _texto_o_none(body.observaciones_hitss))
        if "tipificacion" in enviados:
            _cambiar(entrega, "tipificacion", _texto_o_none(body.tipificacion))
        objetivo = f"entrega {body.entrega_numero}"
    else:
        if body.se_levanto_ans is not None:
            req.se_levanto_ans = body.se_levanto_ans
        if body.observaciones is not None:
            req.observaciones_ans = body.observaciones
        if "seguimiento" in enviados:
            _cambiar(req, "seguimiento", _texto_o_none(body.seguimiento))
        if "tipificacion" in enviados:
            _cambiar(req, "tipificacion", _texto_o_none(body.tipificacion))
        objetivo = "requerimiento"

    req.marcar_actualizado()
    await req.save()
    if despues:
        cambios = ", ".join(
            f"{campo}: '{antes[campo] or ''}' → '{despues[campo] or ''}'" for campo in despues
        )
        await _registrar_bitacora(
            ctx.codigo,
            str(req.id),
            "actualizar",
            f"Detalle ANS ({objetivo}): {cambios}",
            usuario,
            datos_antes={"objetivo": objetivo, **antes},
            datos_despues={"objetivo": objetivo, **despues},
        )
    return {"ok": True}
