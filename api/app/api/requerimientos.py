"""Router de requerimientos — núcleo del dominio de liquidación."""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.documents.bitacora import Bitacora
from app.documents.enums import RolUsuario
from app.documents.estimacion import Estimacion
from app.documents.requerimiento import Entrega, Requerimiento, Solicitud
from app.documents.usuario import Usuario
from app.middleware.aplicacion import ContextoAplicacion, contexto_aplicacion, contexto_escritura
from app.schemas.requerimiento import (
    AnsCalcularIn,
    EntregaIn,
    RequerimientoIn,
    RequerimientoUpdate,
    TransicionIn,
)
from app.security.deps import usuario_actual
from app.services.ans import ANSService
from app.services.liquidacion import LiquidacionService

router = APIRouter(prefix="/requerimientos", tags=["requerimientos"])


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


async def _buscar(ctx: ContextoAplicacion, codigo_req: str) -> Requerimiento:
    from bson import ObjectId
    from bson.errors import InvalidId
    # Busca primero por _id (ObjectId) para soportar URLs únicas globalmente
    try:
        oid = ObjectId(codigo_req)
        req = await Requerimiento.find_one({**ctx.filtro(), "_id": oid})
        if req is not None:
            return req
    except InvalidId:
        pass
    # Fallback: buscar por codigo_req (compatibilidad con URLs antiguas)
    req = await Requerimiento.find_one({**ctx.filtro(), "codigo_req": codigo_req})
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requerimiento no encontrado")
    return req


@router.get("")
async def listar(
    estado: str | None = None,
    ctx: ContextoAplicacion = Depends(contexto_aplicacion),
):
    """Lista requerimientos de la aplicación activa (o de todas en modo consolidado)."""
    consulta = ctx.filtro()
    if estado is not None:
        consulta["estado"] = estado
    return await Requerimiento.find(consulta).sort("-creado_en").to_list()


@router.post("/ans/calcular")
async def calcular_ans(
    datos: AnsCalcularIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
) -> dict:
    """Calcula el ANS por días hábiles entre dos fechas."""
    try:
        resultado = await ANSService.calcular(
            ctx.codigo, datos.fecha_inicio, datos.fecha_fin, datos.umbral_dias_habiles
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {"resultado": resultado.value}


@router.get("/{codigo_req}")
async def obtener(codigo_req: str, ctx: ContextoAplicacion = Depends(contexto_aplicacion)):
    return await _buscar(ctx, codigo_req)


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear(
    datos: RequerimientoIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Crea un requerimiento con su solicitud embebida."""
    if usuario.rol != RolUsuario.SUPERADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo superadmin puede crear requerimientos")
    existe = await Requerimiento.find_one({
        "aplicacion_id": ctx.codigo,
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
        fecha_real_entrega_estimacion=datos.fecha_real_entrega_estimacion,
        ans_estimacion=datos.ans_estimacion,
        fecha_solicitud_acta=datos.fecha_solicitud_acta,
        motivo_cierre=datos.motivo_cierre,
        seguimiento=datos.seguimiento,
        monto_pactado=datos.monto_pactado,
        acta_trabajo=datos.acta_trabajo,
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
    except DuplicateKeyError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Ya existe un requerimiento con el mismo Código REQ, Squad y SC",
        )
    await _registrar_bitacora(
        ctx.codigo, str(req.id), "crear", f"Requerimiento {req.codigo_req} creado", usuario
    )
    return req


@router.put("/{codigo_req}")
async def actualizar(
    codigo_req: str,
    datos: RequerimientoUpdate,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Actualiza los campos enviados de un requerimiento."""
    if usuario.rol != RolUsuario.SUPERADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo superadmin puede editar requerimientos")
    from app.documents.enums import AnsResultado
    from app.services.fecha_limite import calcular_fecha_limite

    req = await _buscar(ctx, codigo_req)
    cambios = datos.model_dump(exclude_unset=True)
    solicitud = cambios.pop("solicitud", None)

    # Registrar qué campos cambiaron para la bitácora
    _ETIQUETAS = {
        "nombre": "Nombre de acta",
        "total_horas_estimadas": "Horas estimadas",
        "fecha_solicitud_acta": "Fecha solicitud acta",
        "fecha_real_entrega_estimacion": "Fecha real entrega",
        "seguimiento": "Seguimiento",
        "motivo_cierre": "Motivo cierre",
        "acta_trabajo": "Acta de trabajo",
        "monto_pactado": "Monto pactado",
        "cantidad_entregas": "Cantidad entregas",
        "estado": "Estado",
    }
    detalle_cambios: list[str] = []
    if solicitud is not None:
        sol_vieja = req.solicitud.model_dump()
        _SOL_ETIQUETAS = {
            "codigo_sc": "Código SC", "tipo_costo": "Tipo costo",
            "squad_id": "Squad", "lt_hitss_id": "LT HITSS",
            "lt_epm_id": "LT EPM", "scrum_id": "Scrum",
        }
        for k, label in _SOL_ETIQUETAS.items():
            v_old = str(sol_vieja.get(k) or "")
            v_new = str(solicitud.get(k) or "")
            if v_old != v_new:
                detalle_cambios.append(f"{label}: '{v_old}' → '{v_new}'")
        req.solicitud = Solicitud(**solicitud)

    for campo, valor in cambios.items():
        viejo = getattr(req, campo, None)
        if str(viejo or "") != str(valor or ""):
            label = _ETIQUETAS.get(campo, campo)
            detalle_cambios.append(f"{label}: '{viejo or ''}' → '{valor or ''}'")
        setattr(req, campo, valor)

    # Recalcular fecha_limite si hay fecha_solicitud_acta y horas
    if req.fecha_solicitud_acta is not None:
        horas = float(req.total_horas_estimadas) if req.total_horas_estimadas else None
        req.fecha_limite = await calcular_fecha_limite(
            req.aplicacion_id, req.fecha_solicitud_acta, horas
        )
        # Calcular ANS ACTA: si hay fecha real de entrega, comparar con fecha_limite
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
    await req.save()
    desc = f"Requerimiento {req.codigo_req} actualizado"
    if detalle_cambios:
        desc += ": " + "; ".join(detalle_cambios)
    await _registrar_bitacora(ctx.codigo, str(req.id), "actualizar", desc, usuario)
    return req


@router.post("/{codigo_req}/transicion")
async def transicion(
    codigo_req: str,
    datos: TransicionIn,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
):
    """Cambia el estado del requerimiento validando la máquina de estados."""
    req = await _buscar(ctx, codigo_req)
    anterior = req.estado
    req.estado = datos.nuevo_estado
    req.marcar_actualizado()
    await req.save()
    await _registrar_bitacora(
        ctx.codigo,
        str(req.id),
        "transicion",
        datos.descripcion or f"Estado {anterior} -> {datos.nuevo_estado}",
        usuario,
    )
    return req


@router.post("/{codigo_req}/entregas")
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
    descripcion = f"Entrega {nueva.numero} {'actualizada' if entrega_anterior is not None else 'registrada'}"
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
    return req


@router.delete("/{codigo_req}/entregas/{numero}")
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
    return req


@router.get("/{codigo_req}/liquidacion")
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


@router.delete("/{codigo_req}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    codigo_req: str,
    ctx: ContextoAplicacion = Depends(contexto_escritura),
    usuario: Usuario = Depends(usuario_actual),
) -> None:
    if usuario.rol != RolUsuario.SUPERADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo superadmin puede eliminar requerimientos")
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
