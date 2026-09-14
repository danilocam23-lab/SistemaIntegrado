"""Router de categorías — globales al proyecto."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.documents.categoria import Categoria
from app.security.deps import requiere_permiso, usuario_actual

# F1.1 (ADR-0008 S1): el router entero exigía cero autenticación; ahora toda
# operación requiere JWT válido, y las de escritura además el permiso de
# configuración administrativa.
router = APIRouter(
    prefix="/categorias", tags=["categorias"], dependencies=[Depends(usuario_actual)]
)

_APP_GLOBAL = "global"


class CategoriaIn(BaseModel):
    nombre: str
    color: str = "#6366f1"
    orden: int = 0


@router.get("")
async def listar():
    return await Categoria.find_all().sort("orden").to_list()


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requiere_permiso("admin.configuracion.editar"))],
)
async def crear(datos: CategoriaIn):
    categoria = Categoria(aplicacion_id=_APP_GLOBAL, **datos.model_dump())
    await categoria.insert()
    return categoria


@router.put(
    "/{categoria_id}",
    dependencies=[Depends(requiere_permiso("admin.configuracion.editar"))],
)
async def actualizar(categoria_id: str, datos: CategoriaIn):
    categoria = await Categoria.get(categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoría no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(categoria, campo, valor)
    categoria.marcar_actualizado()
    await categoria.save()
    return categoria


@router.delete(
    "/{categoria_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requiere_permiso("admin.configuracion.editar"))],
)
async def eliminar(categoria_id: str) -> None:
    categoria = await Categoria.get(categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoría no encontrada")
    await categoria.delete()
