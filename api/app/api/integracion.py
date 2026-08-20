"""Router de integración externa (Power Automate, etc.).

Expone datos aplanados con autenticación por API Key (header ``X-API-Key``).
No requiere JWT ni sesión de usuario.
"""
from datetime import date, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel

from app.config import get_settings
from app.documents.aplicacion import Aplicacion
from app.documents.enums import EstadoEntrega, EstadoRequerimiento
from app.documents.persona import Persona
from app.documents.requerimiento import Requerimiento
from app.documents.squad import Squad

router = APIRouter(prefix="/integracion", tags=["integracion"])

ESTADO_REQUERIMIENTO_ENTREGA_PENDIENTE = (
    EstadoRequerimiento.ESTIMACION_APROBADA_ENTREGA_PENDIENTE.value
)
ESTADO_ENTREGA_PENDIENTE = EstadoEntrega.PENDIENTE.value


# ── Autenticación por API Key ──────────────────────────────────────────────────

async def _verificar_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
) -> str:
    """Valida que el header X-API-Key coincida con la clave configurada."""
    settings = get_settings()
    if not settings.api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "API Key no configurada en el servidor. Agregue API_KEY en .env",
        )
    if x_api_key != settings.api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API Key inválida")
    return x_api_key


async def _verificar_api_key_requerimientos(
    x_api_key: str = Header(..., alias="X-API-Key"),
) -> str:
    """Valida la API Key independiente para integración de requerimientos."""
    settings = get_settings()
    if not settings.api_key_requerimientos:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "API Key de requerimientos no configurada. Agregue API_KEY_REQUERIMIENTOS en .env",
        )
    if x_api_key != settings.api_key_requerimientos:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API Key inválida")
    return x_api_key


async def _verificar_api_key_solicitudes(
    x_api_key: str = Header(..., alias="X-API-Key"),
) -> str:
    """Valida la API Key independiente para integración de solicitudes."""
    settings = get_settings()
    if not settings.api_key_solicitudes:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "API Key de solicitudes no configurada. Agregue API_KEY_SOLICITUDES en .env",
        )
    if x_api_key != settings.api_key_solicitudes:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API Key inválida")
    return x_api_key


# ── Esquema de respuesta ──────────────────────────────────────────────────────

class EntregaPlana(BaseModel):
    """Una fila por cada entrega de cada requerimiento (formato plano)."""
    codigo: str
    cod_del_req: str
    aplicacion: str
    lt_hitss: str | None = None
    fecha_comprometida_entregas_dllo: datetime | None = None
    dias_transcurridos: int | None = None
    cant_entregas: int = 0
    horas_a_entregar: float | None = None
    tipo_de_costo: str | None = None


class RequerimientoPlano(BaseModel):
    """Una fila por cada requerimiento (formato plano)."""
    codigo: str
    cod_del_req: str
    aplicacion: str
    nombre: str | None = None
    estado_requerimiento: str
    estado_solicitud: str | None = None
    lt_hitss: str | None = None
    fecha_solicitud: datetime | None = None
    fecha_real_entrega_estimacion: datetime | None = None
    total_horas_estimadas: float | None = None
    cant_entregas: int = 0
    tipo_de_costo: str | None = None


class SolicitudPlana(BaseModel):
    """Una fila por cada requerimiento con los datos mínimos de su solicitud."""
    fecha_solicitud: date | None = None
    codigo_sc: str
    cod_del_req: str
    squad: str | None = None
    estado: str
    ans_acta: str | None = None
    fecha_real_entrega_estimacion: datetime | None = None
    horas_estimadas: float | None = None


class EntregaSolicitudPlana(BaseModel):
    """Una fila por cada entrega de un requerimiento (para el dashboard de solicitudes)."""
    codigo_sc: str
    cod_del_req: str
    numero_entrega: int
    horas: float | None = None
    fecha_comprometida: date | None = None
    fecha_real: date | None = None
    estado: str | None = None
    mes_aprobacion: str | None = None
    ans: str | None = None
    garantia: bool | None = None
    numero_garantia: int | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_oid(valor: str) -> ObjectId | None:
    """Convierte un string a ObjectId; devuelve None si no es válido."""
    try:
        return ObjectId(valor)
    except Exception:  # noqa: BLE001
        return None


def _es_entrega_pendiente(estado: str | None) -> bool:
    return (estado or "").strip().upper() == ESTADO_ENTREGA_PENDIENTE


def _dias_transcurridos(
    fecha_comprometida: datetime | None,
    fecha_real: datetime | None,
) -> int | None:
    if fecha_comprometida is None:
        return None

    inicio = fecha_comprometida.date()
    fin = fecha_real.date() if fecha_real is not None else date.today()
    dias = abs((fin - inicio).days)
    return -dias if fin > inicio else dias


def _primer_dia_mes_siguiente(hoy: date | None = None) -> datetime:
    fecha = hoy or date.today()
    if fecha.month == 12:
        return datetime(fecha.year + 1, 1, 1)
    return datetime(fecha.year, fecha.month + 1, 1)


def _es_mes_actual_o_anterior(
    fecha_comprometida: datetime | None,
    limite_exclusivo: datetime,
) -> bool:
    return fecha_comprometida is not None and fecha_comprometida < limite_exclusivo


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get(
    "/entregas",
    response_model=list[EntregaPlana],
    summary="Entregas aplanadas para Power Automate",
    description=(
        "Devuelve un array plano donde cada objeto es **una entrega pendiente** "
        "de un requerimiento en estado **ESTIMACION APROBADA ENTREGA PENDIENTE**. "
        "Requerimientos sin entregas se omiten. "
        "Autenticación: header `X-API-Key`."
    ),
)
async def listar_entregas(
    aplicacion: str | None = Query(
        default=None,
        description="Código de aplicación (squad). Si se omite, devuelve todas.",
    ),
    _: str = Depends(_verificar_api_key),
) -> list[EntregaPlana]:
    limite_fecha = _primer_dia_mes_siguiente()
    filtro: dict = {
        "estado": ESTADO_REQUERIMIENTO_ENTREGA_PENDIENTE,
        "entregas": {
            "$elemMatch": {
                "estado": {
                    "$regex": rf"^\s*{ESTADO_ENTREGA_PENDIENTE}\s*$",
                    "$options": "i",
                },
                "fecha_comprometida": {"$lt": limite_fecha},
            }
        },
    }
    if aplicacion:
        filtro["aplicacion_id"] = aplicacion

    reqs = await Requerimiento.find(filtro).to_list()

    # Resolver nombres de LT HITSS en lote
    lt_ids_raw = {
        req.solicitud.lt_hitss_id
        for req in reqs
        if req.solicitud.lt_hitss_id
    }
    personas_map: dict[str, str] = {}
    if lt_ids_raw:
        oids = [oid for v in lt_ids_raw if (oid := _to_oid(v)) is not None]
        if oids:
            personas = await Persona.find({"_id": {"$in": oids}}).to_list()
            for p in personas:
                personas_map[str(p.id)] = p.nombre

    # Construir respuesta plana: una fila por entrega
    resultado: list[EntregaPlana] = []
    for req in reqs:
        sol = req.solicitud
        lt_nombre = personas_map.get(sol.lt_hitss_id or "")
        entregas_pendientes = [
            entrega
            for entrega in req.entregas
            if _es_entrega_pendiente(entrega.estado)
            and _es_mes_actual_o_anterior(entrega.fecha_comprometida, limite_fecha)
        ]
        tipo_costo = sol.tipo_costo.value if sol.tipo_costo else None

        for entrega in entregas_pendientes:
            resultado.append(EntregaPlana(
                codigo=sol.codigo_sc,
                cod_del_req=req.codigo_req,
                aplicacion=req.aplicacion_id,
                lt_hitss=lt_nombre,
                fecha_comprometida_entregas_dllo=entrega.fecha_comprometida,
                dias_transcurridos=_dias_transcurridos(
                    entrega.fecha_comprometida,
                    entrega.fecha_recepcion,
                ),
                cant_entregas=entrega.numero,
                horas_a_entregar=float(entrega.horas) if entrega.horas is not None else None,
                tipo_de_costo=tipo_costo,
            ))

    return resultado


@router.get(
    "/requerimientos",
    response_model=list[RequerimientoPlano],
    summary="Requerimientos aplanados para Power Automate",
    description=(
        "Devuelve un array plano donde cada objeto es **un requerimiento**. "
        "Autenticación: header `X-API-Key` usando `API_KEY_REQUERIMIENTOS`."
    ),
)
async def listar_requerimientos(
    aplicacion: str | None = Query(
        default=None,
        description="Código de aplicación (squad). Si se omite, devuelve todas.",
    ),
    estado: str | None = Query(
        default=None,
        description="Estado del requerimiento. Si se omite, devuelve todos.",
    ),
    _: str = Depends(_verificar_api_key_requerimientos),
) -> list[RequerimientoPlano]:
    filtro: dict = {}
    if aplicacion:
        filtro["aplicacion_id"] = aplicacion
    if estado:
        filtro["estado"] = estado

    reqs = await Requerimiento.find(filtro).to_list()

    lt_ids_raw = {
        req.solicitud.lt_hitss_id
        for req in reqs
        if req.solicitud.lt_hitss_id
    }
    personas_map: dict[str, str] = {}
    if lt_ids_raw:
        oids = [oid for v in lt_ids_raw if (oid := _to_oid(v)) is not None]
        if oids:
            personas = await Persona.find({"_id": {"$in": oids}}).to_list()
            for p in personas:
                personas_map[str(p.id)] = p.nombre

    resultado: list[RequerimientoPlano] = []
    for req in reqs:
        sol = req.solicitud
        resultado.append(RequerimientoPlano(
            codigo=sol.codigo_sc,
            cod_del_req=req.codigo_req,
            aplicacion=req.aplicacion_id,
            nombre=req.nombre,
            estado_requerimiento=req.estado,
            estado_solicitud=sol.estado,
            lt_hitss=personas_map.get(sol.lt_hitss_id or ""),
            fecha_solicitud=sol.fecha_solicitud,
            fecha_real_entrega_estimacion=req.fecha_real_entrega_estimacion,
            total_horas_estimadas=(
                float(req.total_horas_estimadas)
                if req.total_horas_estimadas is not None
                else None
            ),
            cant_entregas=len(req.entregas),
            tipo_de_costo=sol.tipo_costo.value if sol.tipo_costo else None,
        ))

    return resultado


@router.get(
    "/solicitudes",
    response_model=list[SolicitudPlana],
    summary="Solicitudes aplanadas para Power Automate",
    description=(
        "Devuelve un array plano donde cada objeto es **una solicitud**: fecha y hora "
        "de solicitud, Código SC, Código REQ, Squad, Estado, ANS ACTA, fecha real de "
        "entrega de estimaciones y horas estimadas. "
        "Autenticación: header `X-API-Key` usando `API_KEY_SOLICITUDES`."
    ),
)
async def listar_solicitudes(
    aplicacion: str | None = Query(
        default=None,
        description="Código de aplicación (squad). Si se omite, devuelve todas.",
    ),
    _: str = Depends(_verificar_api_key_solicitudes),
) -> list[SolicitudPlana]:
    filtro: dict = {}
    if aplicacion:
        filtro["aplicacion_id"] = aplicacion

    reqs = await Requerimiento.find(filtro).to_list()

    # Resolver nombre de squad en lote: prioriza el código de Aplicación (fuente
    # real de squad_id en la mayoría de los casos) y usa la colección Squad como
    # respaldo para registros importados con _id numérico. Mismo criterio que
    # usa el frontend (Requerimientos.tsx).
    squad_ids_raw = {
        req.solicitud.squad_id for req in reqs if req.solicitud.squad_id
    }
    squad_nombre_por_id: dict[str, str] = {}
    if squad_ids_raw:
        squads = await Squad.find({"_id": {"$in": [oid for v in squad_ids_raw if (oid := _to_oid(v)) is not None]}}).to_list()
        for s in squads:
            squad_nombre_por_id[str(s.id)] = s.nombre
        aplicaciones = await Aplicacion.find({"codigo": {"$in": list(squad_ids_raw)}}).to_list()
        for a in aplicaciones:
            squad_nombre_por_id[a.codigo] = a.nombre

    resultado: list[SolicitudPlana] = []
    for req in reqs:
        squad_id = req.solicitud.squad_id
        resultado.append(SolicitudPlana(
            fecha_solicitud=req.fecha_solicitud_acta.date() if req.fecha_solicitud_acta else None,
            codigo_sc=req.solicitud.codigo_sc,
            cod_del_req=req.codigo_req,
            squad=squad_nombre_por_id.get(squad_id or "", squad_id),
            estado=req.estado,
            ans_acta=req.ans_acta.value if req.ans_acta else None,
            fecha_real_entrega_estimacion=req.fecha_real_entrega_estimacion,
            horas_estimadas=float(req.total_horas_estimadas) if req.total_horas_estimadas is not None else None,
        ))

    return resultado


@router.get(
    "/solicitudes-entregas",
    response_model=list[EntregaSolicitudPlana],
    summary="Entregas aplanadas para el dashboard de solicitudes",
    description=(
        "Devuelve un array plano donde cada objeto es **una entrega** de un requerimiento: "
        "Código SC, Código REQ, N° Entrega, Horas, F. Comprometida, F. Real, Estado, Mes "
        "de aprobación, ANS (de la entrega), Garantía y N° Garantía. Las fechas se devuelven sin hora. "
        "Autenticación: header `X-API-Key` usando `API_KEY_SOLICITUDES`."
    ),
)
async def listar_solicitudes_entregas(
    aplicacion: str | None = Query(
        default=None,
        description="Código de aplicación (squad). Si se omite, devuelve todas.",
    ),
    _: str = Depends(_verificar_api_key_solicitudes),
) -> list[EntregaSolicitudPlana]:
    filtro: dict = {}
    if aplicacion:
        filtro["aplicacion_id"] = aplicacion

    reqs = await Requerimiento.find(filtro).to_list()

    resultado: list[EntregaSolicitudPlana] = []
    for req in reqs:
        for entrega in req.entregas:
            resultado.append(EntregaSolicitudPlana(
                codigo_sc=req.solicitud.codigo_sc,
                cod_del_req=req.codigo_req,
                numero_entrega=entrega.numero,
                horas=float(entrega.horas) if entrega.horas is not None else None,
                fecha_comprometida=entrega.fecha_comprometida.date() if entrega.fecha_comprometida else None,
                fecha_real=entrega.fecha_recepcion.date() if entrega.fecha_recepcion else None,
                estado=entrega.estado,
                mes_aprobacion=entrega.mes_aprobacion,
                ans=entrega.ans_entrega.value if entrega.ans_entrega else None,
                garantia=entrega.garantia,
                numero_garantia=entrega.numero_garantia,
            ))

    return resultado
