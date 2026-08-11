"""Router de integración externa (Power Automate, etc.).

Expone datos aplanados con autenticación por API Key (header ``X-API-Key``).
No requiere JWT ni sesión de usuario.
"""
from datetime import date, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel

from app.config import get_settings
from app.documents.enums import EstadoEntrega, EstadoRequerimiento
from app.documents.persona import Persona
from app.documents.requerimiento import Requerimiento

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
