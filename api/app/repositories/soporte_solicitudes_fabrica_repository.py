"""Acceso a datos para Solicitudes Fábrica."""
from datetime import datetime

from app.documents.soporte_solicitud_fabrica import SoporteSolicitudFabrica


class SoporteSolicitudesFabricaRepository:
    @staticmethod
    async def listar(codigos: list[str]) -> list[SoporteSolicitudFabrica]:
        return await SoporteSolicitudFabrica.find({"aplicacion_id": {"$in": codigos}}).to_list()

    @staticmethod
    async def reemplazar_todo(aplicacion_id: str, filas: list[dict]) -> int:
        """Reemplaza todos los registros de la aplicación."""
        ahora = datetime.utcnow()

        docs: list[SoporteSolicitudFabrica] = []
        for item in filas:
            docs.append(
                SoporteSolicitudFabrica(
                    aplicacion_id=aplicacion_id,
                    fila_origen=int(item["fila_origen"]),
                    lider=str(item["lider"]),
                    squad=str(item["squad"]),
                    datos=item["datos"],
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
