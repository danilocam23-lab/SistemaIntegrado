"""Sincronización requerimiento -> asignaciones de carga (portado de catalogSync.js).

Cuando un requerimiento tiene categoría y developers asignados, cada developer
debe tener una asignación de carga con un proyecto vinculado al requerimiento.
"""
from app.documents.asignacion import Asignacion, Proyecto
from app.documents.requerimiento import Requerimiento


async def sincronizar_requerimiento_a_carga(req: Requerimiento) -> int:
    """Proyecta el requerimiento sobre las asignaciones de sus developers.

    Devuelve cuántas asignaciones se crearon o actualizaron.
    """
    if not req.categoria_id or not req.developers_asignados:
        return 0

    tocadas = 0
    for persona_id in req.developers_asignados:
        asignacion = await Asignacion.find_one(
            Asignacion.aplicacion_id == req.aplicacion_id,
            Asignacion.persona_id == persona_id,
            Asignacion.categoria_id == req.categoria_id,
        )
        if asignacion is None:
            asignacion = Asignacion(
                aplicacion_id=req.aplicacion_id,
                persona_id=persona_id,
                categoria_id=req.categoria_id,
            )
            await asignacion.insert()

        ya_vinculado = any(p.requerimiento_id == str(req.id) for p in asignacion.proyectos)
        if not ya_vinculado:
            asignacion.proyectos.append(
                Proyecto(
                    nombre=req.codigo_req,
                    requerimiento_id=str(req.id),
                    fecha_inicio=req.fecha_inicio,
                    fecha_fin=req.fecha_fin,
                )
            )
            asignacion.marcar_actualizado()
            await asignacion.save()
            tocadas += 1
    return tocadas
