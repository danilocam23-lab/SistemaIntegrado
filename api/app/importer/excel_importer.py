"""Importador del Excel 'BITÁCORA GENERAL' (portado del Sistema Liquidador a Beanie).

Cada fila del Excel es un requerimiento + una entrega. Varias filas con el mismo
'COD. DEL REQ' representan distintas entregas del mismo requerimiento.
"""
from __future__ import annotations

import io
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import openpyxl

from app.documents.acta_trabajo import ActaTrabajo
from app.documents.aplicativo import Aplicativo, Direccion
from app.documents.bitacora import Bitacora
from app.documents.enums import AnsResultado, EstadoEntrega, EstadoRequerimiento, TipoCosto
from app.documents.festivo import Festivo
from app.documents.orden_compra import OrdenCompra
from app.documents.persona import Persona
from app.documents.requerimiento import Entrega, Facturacion, Requerimiento, Solicitud
from app.documents.squad import Squad
from app.documents.tarifa import Tarifa

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}


@dataclass
class ResultadoImportacion:
    filas_procesadas: int = 0
    requerimientos_creados: int = 0
    requerimientos_actualizados: int = 0
    entregas_creadas: int = 0
    entregas_actualizadas: int = 0
    festivos_cargados: int = 0
    errores: list[str] = field(default_factory=list)


class ImportadorExcel:
    """Lee un libro de Excel y vuelca los requerimientos a MongoDB."""

    def __init__(self, aplicacion_id: str, contenido: bytes, hoja: str | None = None) -> None:
        self.aplicacion_id = aplicacion_id
        self.workbook = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
        self.hoja = hoja or self._hoja_principal()
        self.anio = self._inferir_anio(self.hoja)
        self.resultado = ResultadoImportacion()
        self._cache_persona: dict = {}
        self._cache_squad: dict = {}
        self._cache_aplicativo: dict = {}
        self._cache_acta: dict = {}
        self._cache_orden: dict = {}

    # ---- ejecución ----

    async def ejecutar(self) -> ResultadoImportacion:
        await self._importar_festivos()
        if self.hoja not in self.workbook.sheetnames:
            raise ValueError(f"La hoja '{self.hoja}' no existe en el archivo")
        ws = self.workbook[self.hoja]
        headers = self._headers(ws)
        for fila in ws.iter_rows(min_row=2, values_only=True):
            payload = dict(zip(headers, fila))
            if not self._txt(payload.get("COD. DEL REQ")):
                continue
            try:
                await self._upsert_fila(payload)
                self.resultado.filas_procesadas += 1
            except Exception as exc:  # noqa: BLE001 - se acumula y se reporta
                self.resultado.errores.append(f"{payload.get('COD. DEL REQ')}: {exc}")
        return self.resultado

    async def _importar_festivos(self) -> None:
        hoja = next(
            (h for h in self.workbook.sheetnames if "festivo" in self._ident(h)), None
        )
        if hoja is None:
            return
        for fila in self.workbook[hoja].iter_rows(min_row=2, values_only=True):
            valor = fila[0] if fila else None
            fecha = self._dt(valor)
            if fecha is None:
                continue
            existe = await Festivo.find_one(
                Festivo.aplicacion_id == self.aplicacion_id, Festivo.fecha == fecha
            )
            if existe is None:
                await Festivo(aplicacion_id=self.aplicacion_id, fecha=fecha).insert()
                self.resultado.festivos_cargados += 1

    # ---- fila ----

    async def _upsert_fila(self, payload: dict) -> None:
        codigo_req = self._txt(payload.get("COD. DEL REQ"))
        numero = self._parse_numero_entrega(payload.get("CANT. DE ENTREGAS"))
        req = await Requerimiento.find_one(
            Requerimiento.aplicacion_id == self.aplicacion_id,
            Requerimiento.codigo_req == codigo_req,
        )
        creado = req is None
        estado = self._parse_estado_requerimiento(payload.get("ESTADO DE REQUERIMIENTOS"))
        if req is None:
            codigo_sc = self._txt(payload.get("CODIGO DE SOLICITUD DE COTIZACION")) or codigo_req
            req = Requerimiento(
                aplicacion_id=self.aplicacion_id,
                codigo_req=codigo_req,
                solicitud=Solicitud(codigo_sc=codigo_sc),
                estado=estado,
                entregas=[],
            )

        await self._hidratar_solicitud(req.solicitud, payload)
        self._hidratar_requerimiento(req, payload)
        req.estado = estado

        entrega = next((e for e in req.entregas if e.numero == numero), None)
        if entrega is None:
            entrega = Entrega(numero=numero, estado=EstadoEntrega.PENDIENTE)
            req.entregas.append(entrega)
            self.resultado.entregas_creadas += 1
        else:
            self.resultado.entregas_actualizadas += 1
        await self._hidratar_entrega(entrega, payload)
        self._hidratar_facturacion(entrega, payload)

        req.entregas.sort(key=lambda e: e.numero)
        req.cantidad_entregas = len(req.entregas)
        req.marcar_actualizado()

        if creado:
            await req.insert()
            self.resultado.requerimientos_creados += 1
            await Bitacora(
                aplicacion_id=self.aplicacion_id,
                entidad_tipo="requerimiento",
                entidad_id=str(req.id),
                accion="importacion",
                descripcion=f"Requerimiento importado desde Excel (estado: {estado.value})",
                autor="IMPORTADOR",
            ).insert()
        else:
            await req.save()
            self.resultado.requerimientos_actualizados += 1

    async def _hidratar_solicitud(self, sol: Solicitud, payload: dict) -> None:
        sol.codigo_sc = (
            self._txt(payload.get("CODIGO DE SOLICITUD DE COTIZACION")) or sol.codigo_sc
        )
        sol.fecha_solicitud = self._dt(
            self._campo(payload, "FECHA DE SOLICITUD", "FECHA DE SOLICITUD ")
        )
        direccion = self._campo(payload, "DIRECCIÓN", "DIRECCIÓN ", "DIRECCION", "DIRECCION SOLUCION")
        sol.aplicativo_id = await self._aplicativo(
            self._campo(payload, "APLICACIÓN", "APLICACION"), direccion
        )
        sol.squad_id = await self._squad(payload.get("Squad"), payload.get("LT HITSS"))
        sol.lt_hitss_id = await self._persona(payload.get("LT HITSS"), "LT_HITSS")
        sol.lt_epm_id = await self._persona(payload.get("LT EPM"), "LT_EPM")
        sol.tipo_costo = self._parse_tipo_costo(payload.get("TIPO DE COSTO"))
        sol.estado = self._txt(payload.get("ESTADO DE REQUERIMIENTOS"))
        sol.anio_tarifa = self.anio
        sol.tecnologia = self._campo(payload, "TECNOLOGIA", "TECNOLOGÍA")
        sol.tarifa_id = await self._tarifa(payload, sol.lt_hitss_id)

    def _hidratar_requerimiento(self, req: Requerimiento, payload: dict) -> None:
        req.total_horas_estimadas = self._dec(payload.get("TOTAL HORAS ESTIMADAS"))
        req.fecha_real_entrega_estimacion = self._dt(payload.get("FECHA REAL ENTREGA DE ESTIMACIONES"))
        req.ans_estimacion = self._parse_ans(payload.get("ANS ESTIMACIONES"))
        req.mes_objetivo = self._parse_mes(payload.get("Mes"))
        req.seguimiento = self._txt(payload.get("SEGUIMIENTO"))

    async def _hidratar_entrega(self, entrega: Entrega, payload: dict) -> None:
        entrega.horas = self._dec(payload.get("HORAS A ENTREGAR"))
        entrega.porcentaje = self._dec(payload.get("% DE ENTREGA"))
        entrega.fecha_comprometida = self._dt(payload.get("FECHA COMPROMETIDA DE ENTREGAS DLLO"))
        entrega.fecha_recepcion = self._dt(payload.get("FECHA RECEPCION DE ENTREGAS"))
        entrega.fecha_cargue = self._dt(payload.get("FECHA DE CARGUE ENTREGAS"))
        entrega.fecha_aprobacion = self._dt(payload.get("FECHA APROBACIÓN DE ENTREGAS"))
        entrega.fecha_ejecucion = self._dt(self._campo(payload, "FECHA EJECUCION", "FECHA EJECUCION "))
        entrega.ans_entrega = self._parse_ans(payload.get("ANS ENTREGAS DLLO"))
        entrega.garantia = self._parse_bool(payload.get("GARANTIA"))
        entrega.acta_trabajo_id = await self._acta(payload.get("ACTA DE TRABAJO"))
        entrega.orden_compra_id = await self._orden(payload.get("ORDEN DE COMPRA"))
        entrega.estado = self._parse_estado_entrega(payload.get("ESTADO ENTREGAS"), entrega)

    def _hidratar_facturacion(self, entrega: Entrega, payload: dict) -> None:
        raw = self._txt(payload.get("FACTURACIÓN"))
        if not raw:
            return
        mes = None
        for nombre, numero in MESES.items():
            if nombre in raw.lower():
                mes = datetime(self.anio, numero, 1)
                break
        from app.documents.enums import EstadoFacturacion
        entrega.facturacion = Facturacion(mes_facturacion=mes, estado=EstadoFacturacion.FACTURADA)

    # ---- get-or-create ----

    async def _persona(self, raw: object, rol: str) -> str | None:
        nombre = self._txt(raw)
        if not nombre:
            return None
        clave = (nombre, rol)
        if clave in self._cache_persona:
            return self._cache_persona[clave]
        doc = await Persona.find_one(
            Persona.aplicacion_id == self.aplicacion_id,
            Persona.nombre == nombre,
            Persona.rol_operativo == rol,
        )
        if doc is None:
            doc = await Persona(
                aplicacion_id=self.aplicacion_id, nombre=nombre, rol_operativo=rol
            ).insert()
        self._cache_persona[clave] = str(doc.id)
        return str(doc.id)

    async def _squad(self, raw: object, raw_lt: object) -> str | None:
        nombre = self._txt(raw)
        if not nombre:
            return None
        if nombre in self._cache_squad:
            return self._cache_squad[nombre]
        lt_id = await self._persona(raw_lt, "LT_HITSS")
        doc = await Squad.find_one(
            Squad.aplicacion_id == self.aplicacion_id, Squad.nombre == nombre
        )
        if doc is None:
            doc = await Squad(
                aplicacion_id=self.aplicacion_id, nombre=nombre, lt_hitss_id=lt_id
            ).insert()
        self._cache_squad[nombre] = str(doc.id)
        return str(doc.id)

    async def _aplicativo(self, raw: object, raw_direccion: object) -> str | None:
        nombre = self._txt(raw)
        if not nombre:
            return None
        if nombre in self._cache_aplicativo:
            return self._cache_aplicativo[nombre]
        doc = await Aplicativo.find_one(
            Aplicativo.aplicacion_id == self.aplicacion_id, Aplicativo.nombre == nombre
        )
        if doc is None:
            direccion = self._txt(raw_direccion)
            doc = await Aplicativo(
                aplicacion_id=self.aplicacion_id,
                nombre=nombre,
                direccion=Direccion(nombre=direccion) if direccion else None,
            ).insert()
        self._cache_aplicativo[nombre] = str(doc.id)
        return str(doc.id)

    async def _acta(self, raw: object) -> str | None:
        codigo = self._txt(raw)
        if not codigo:
            return None
        if codigo in self._cache_acta:
            return self._cache_acta[codigo]
        doc = await ActaTrabajo.find_one(
            ActaTrabajo.aplicacion_id == self.aplicacion_id, ActaTrabajo.codigo == codigo
        )
        if doc is None:
            doc = await ActaTrabajo(aplicacion_id=self.aplicacion_id, codigo=codigo).insert()
        self._cache_acta[codigo] = str(doc.id)
        return str(doc.id)

    async def _orden(self, raw: object) -> str | None:
        numero = self._txt(raw)
        if not numero:
            return None
        if numero in self._cache_orden:
            return self._cache_orden[numero]
        doc = await OrdenCompra.find_one(
            OrdenCompra.aplicacion_id == self.aplicacion_id, OrdenCompra.numero == numero
        )
        if doc is None:
            doc = await OrdenCompra(aplicacion_id=self.aplicacion_id, numero=numero).insert()
        self._cache_orden[numero] = str(doc.id)
        return str(doc.id)

    async def _tarifa(self, payload: dict, lt_id: str | None) -> str | None:
        valor = self._dec(self._campo(payload, "VALOR HORA", " VALOR HORA"))
        if valor is None:
            return None
        ramificacion = self._txt(self._campo(payload, "TECNOLOGIA", "TECNOLOGÍA"))
        doc = await Tarifa.find_one(
            Tarifa.anio == self.anio,
            Tarifa.ramificacion == ramificacion,
        )
        if doc is None:
            doc = await Tarifa(
                aplicacion_id="global",
                anio=self.anio,
                valor_hora=valor,
                ramificacion=ramificacion,
            ).insert()
        else:
            doc.valor_hora = valor
            await doc.save()
        return str(doc.id)

    # ---- utilidades ----

    def _hoja_principal(self) -> str:
        for hoja in self.workbook.sheetnames:
            if "estimacion" in self._ident(hoja):
                return hoja
        return self.workbook.sheetnames[0]

    @staticmethod
    def _headers(ws) -> list[str]:
        fila = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
        return [str(v).strip() if v is not None else "" for v in fila]

    @staticmethod
    def _campo(payload: dict, *claves: str) -> object:
        for clave in claves:
            valor = payload.get(clave)
            if valor not in (None, ""):
                return valor
        return None

    @staticmethod
    def _txt(valor: object) -> str | None:
        if valor is None:
            return None
        texto = str(valor).replace("\xa0", " ").strip()
        return " ".join(texto.split()) or None

    @staticmethod
    def _ident(valor: object) -> str:
        raw = ImportadorExcel._txt(valor) or ""
        normalizado = unicodedata.normalize("NFKD", raw)
        return "".join(c for c in normalizado.lower() if c.isalnum())

    @staticmethod
    def _dt(valor: object) -> datetime | None:
        if valor is None or valor == "":
            return None
        if isinstance(valor, datetime):
            return valor
        if isinstance(valor, date):
            return datetime(valor.year, valor.month, valor.day)
        texto = ImportadorExcel._txt(valor)
        if texto is None:
            return None
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(texto, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(texto)
        except ValueError:
            return None

    @staticmethod
    def _dec(valor: object) -> Decimal | None:
        texto = ImportadorExcel._txt(valor)
        if texto is None:
            return None
        texto = texto.replace("%", "").replace(",", "")
        try:
            return Decimal(texto)
        except InvalidOperation:
            return None

    @staticmethod
    def _parse_bool(valor: object) -> bool:
        texto = ImportadorExcel._txt(valor)
        return bool(texto) and texto.lower() in {
            "si", "sí", "true", "x", "1", "garantia", "garantía"
        }

    @staticmethod
    def _parse_ans(valor: object) -> AnsResultado | None:
        texto = ImportadorExcel._txt(valor)
        if texto is None:
            return None
        try:
            return AnsResultado(texto.replace(" ", "_").upper())
        except ValueError:
            return None

    @staticmethod
    def _parse_tipo_costo(valor: object) -> TipoCosto | None:
        texto = ImportadorExcel._txt(valor)
        if texto is None:
            return None
        bajo = texto.lower()
        if bajo == "tiempo y materiales":
            return TipoCosto.TYM
        if bajo == "fijo":
            return TipoCosto.FIJO
        return None

    @staticmethod
    def _parse_estado_requerimiento(valor: object) -> EstadoRequerimiento:
        texto = ImportadorExcel._txt(valor)
        if texto is None:
            return EstadoRequerimiento.ESTIMACION_EN_CURSO_POR_HITSS
        for candidato in EstadoRequerimiento:
            if candidato.value == texto:
                return candidato
        if texto == "REQUERIMIENTO SUSPENDIDO":
            return EstadoRequerimiento.REQUERIMIENTO_SUSPENDIDO_POR_EPM
        return EstadoRequerimiento.ESTIMACION_EN_CURSO_POR_HITSS

    @staticmethod
    def _parse_estado_entrega(valor: object, entrega: Entrega) -> EstadoEntrega:
        texto = ImportadorExcel._txt(valor)
        if texto is None:
            return EstadoEntrega.PENDIENTE
        if texto.startswith("APROBADA"):
            return EstadoEntrega.APROBADA
        for candidato in EstadoEntrega:
            if candidato.value == texto:
                return candidato
        if entrega.garantia:
            return EstadoEntrega.EN_GARANTIA
        return EstadoEntrega.PENDIENTE

    @staticmethod
    def _parse_numero_entrega(valor: object) -> int:
        texto = ImportadorExcel._txt(valor)
        if texto is None:
            return 1
        if texto.upper() in ("UNICA", "ENTREGA UNICA", "ÚNICA"):
            return 1
        match = re.search(r"(\d+)", texto)
        return int(match.group(1)) if match else 1

    def _parse_mes(self, valor: object) -> datetime | None:
        texto = self._txt(valor)
        if texto is None:
            return None
        mes = MESES.get(texto.lower())
        return datetime(self.anio, mes, 1) if mes else None

    @staticmethod
    def _inferir_anio(hoja: str) -> int:
        match = re.search(r"(20\d{2})", hoja or "")
        return int(match.group(1)) if match else date.today().year
