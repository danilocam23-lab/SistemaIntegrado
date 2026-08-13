"""Acceso a datos para Solicitudes Fábrica."""
from datetime import datetime
 
from bson import ObjectId

from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabrica
 

ANS_DETALLE_KEYS = (
    "Se_levanto_ANS_Oportunidad",
    "Observaciones_ANS_Oportunidad",
    "Se_levanto_ANS_Cumplimiento",
    "Observaciones_ANS_Cumplimiento",
    "Se_levanto_ANS_inicio_trabajo",
    "Observaciones_ANS_inicio_trabajo",
)

 
class SoporteSolicitudesFabricaRepository:
    @staticmethod
    async def listar(codigos: list[str]) -> list[SoporteSolicitudFabrica]:
        return await SoporteSolicitudFabrica.find({"aplicacion_id": {"$in": codigos}}).to_list()

    @staticmethod
    async def listar_paginado(
        codigos: list[str],
        pagina: int = 1,
        tamanio: int = 100,
        filtro_wo: str | None = None,
    ) -> tuple[list[SoporteSolicitudFabrica], int]:
        """Devuelve (registros_pagina, total) con paginación servidor."""
        import re
        query: dict = {"aplicacion_id": {"$in": codigos}}
        if filtro_wo:
            query["datos.Work Order ID"] = {"$regex": re.escape(filtro_wo), "$options": "i"}
        total = await SoporteSolicitudFabrica.find(query).count()
        skip = (pagina - 1) * tamanio
        registros = await SoporteSolicitudFabrica.find(query).skip(skip).limit(tamanio).to_list()
        return registros, total

    @staticmethod
    async def reemplazar_todo(aplicacion_id: str, filas: list[dict]) -> int:
        """Reemplaza todos los registros de la aplicación."""
        ahora = datetime.utcnow()
        existentes = await SoporteSolicitudFabrica.find({"aplicacion_id": aplicacion_id}).to_list()
        anotaciones_por_wo = {
            (doc.datos or {}).get("Work Order ID", "").strip(): {
                key: (doc.datos or {}).get(key, "")
                for key in ANS_DETALLE_KEYS
                if key in (doc.datos or {})
            }
            for doc in existentes
            if (doc.datos or {}).get("Work Order ID", "").strip()
        }
 
        docs: list[SoporteSolicitudFabrica] = []
        for item in filas:
            datos = dict(item["datos"])
            work_order = datos.get("Work Order ID", "").strip()
            if work_order in anotaciones_por_wo:
                datos.update(anotaciones_por_wo[work_order])
            docs.append(
                SoporteSolicitudFabrica(
                    aplicacion_id=aplicacion_id,
                    fila_origen=int(item["fila_origen"]),
                    lider=str(item["lider"]),
                    squad=str(item["squad"]),
                    datos=datos,
                    sincronizado_en=ahora,
                    creado_en=ahora,
                    actualizado_en=ahora,
                )
            )

        await SoporteSolicitudFabrica.find({"aplicacion_id": aplicacion_id}).delete()
        if docs:
            await SoporteSolicitudFabrica.insert_many(docs)
        return len(docs)

    @staticmethod
    async def reemplazar_por_aplicacion(filas_por_aplicacion: dict[str, list[dict]]) -> int:
        """Reemplaza registros por múltiples aplicaciones."""
        total = 0
        for aplicacion_id, filas in filas_por_aplicacion.items():
            if not aplicacion_id:
                continue
            total += await SoporteSolicitudesFabricaRepository.reemplazar_todo(aplicacion_id, filas)
        return total

    @staticmethod
    async def obtener(registro_id: str, codigos: list[str]) -> SoporteSolicitudFabrica | None:
        if not ObjectId.is_valid(registro_id):
            return None
        return await SoporteSolicitudFabrica.find_one({
            "_id": ObjectId(registro_id),
            "aplicacion_id": {"$in": codigos},
        })

    @staticmethod
    async def guardar(doc: SoporteSolicitudFabrica) -> SoporteSolicitudFabrica:
        doc.actualizado_en = datetime.utcnow()
        await doc.save()
        return doc
