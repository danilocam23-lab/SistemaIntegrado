"""Pruebas del campo de iteraciones permitido para aplicaciones."""
from app.config import get_settings
from app.db import obtener_cliente
from app.documents.aplicacion import Aplicacion
from tests.conftest import headers_con_token

RUTA_REALISTA = (
    "EPM_FABRICA DE DESARROLLO_76805\\CRM\\Comercial\\Sprint 5- 10908 "
    "MGT-GTI-0291-PORTAL PORTALES AUTOGESTIÓN COMERCIALES-Migración de "
    "aprovisionador de epm a tu puerta CRM - Open"
)
OTRA_RUTA = "EPM_FABRICA DE DESARROLLO_76805\\CRM\\Soporte\\Sprint 6 - Gestión"


async def test_crear_squad_con_iteraciones_devuelve_valor(cliente, fabrica_usuario):
    _, token = await fabrica_usuario([], permisos=["aplicaciones.crear"])

    resp = await cliente.post(
        "/api/aplicaciones",
        json={
            "codigo": "squad-iteraciones",
            "nombre": "Squad iteraciones",
            "descripcion": "Squad con rutas permitidas",
            "iteraciones": f"  {RUTA_REALISTA}  ",
        },
        headers=headers_con_token(token),
    )

    assert resp.status_code == 201
    datos = resp.json()
    assert datos["iteraciones"] == RUTA_REALISTA


async def test_editar_squad_fija_iteraciones_y_persiste(
    cliente,
    fabrica_aplicacion,
    fabrica_usuario,
):
    app = await fabrica_aplicacion()
    _, token = await fabrica_usuario([], permisos=["aplicaciones.editar"])

    resp = await cliente.put(
        f"/api/aplicaciones/{app.codigo}",
        json={"iteraciones": f"\n{RUTA_REALISTA}\n"},
        headers=headers_con_token(token),
    )

    assert resp.status_code == 200
    assert resp.json()["iteraciones"] == RUTA_REALISTA
    recargada = await Aplicacion.find_one(Aplicacion.codigo == app.codigo)
    assert recargada is not None
    assert recargada.iteraciones == RUTA_REALISTA


async def test_editar_squad_con_iteraciones_nulas_no_borra_valor(
    cliente,
    fabrica_aplicacion,
    fabrica_usuario,
):
    app = await fabrica_aplicacion()
    app.iteraciones = RUTA_REALISTA
    await app.save()
    _, token = await fabrica_usuario([], permisos=["aplicaciones.editar"])

    resp = await cliente.put(
        f"/api/aplicaciones/{app.codigo}",
        json={"nombre": "Nombre actualizado", "iteraciones": None},
        headers=headers_con_token(token),
    )

    assert resp.status_code == 200
    assert resp.json()["iteraciones"] == RUTA_REALISTA
    recargada = await Aplicacion.find_one(Aplicacion.codigo == app.codigo)
    assert recargada is not None
    assert recargada.iteraciones == RUTA_REALISTA


async def test_documento_antiguo_sin_iteraciones_carga_y_serializa_cadena_vacia(
    cliente,
    superadmin_token,
):
    codigo = "app-antigua-sin-iteraciones"
    cliente_mongo = obtener_cliente()
    await cliente_mongo[get_settings().mongo_db]["aplicaciones"].insert_one(
        {
            "codigo": codigo,
            "nombre": "Aplicación antigua",
            "descripcion": "Documento previo al campo iteraciones",
            "activa": True,
            "creada_por": "tests",
        }
    )

    app = await Aplicacion.find_one(Aplicacion.codigo == codigo)
    assert app is not None
    assert app.iteraciones == ""

    resp = await cliente.get(
        "/api/aplicaciones",
        headers=headers_con_token(superadmin_token),
    )
    assert resp.status_code == 200
    antiguas = [item for item in resp.json() if item["codigo"] == codigo]
    assert antiguas[0]["iteraciones"] == ""


def test_iteraciones_lista_normaliza_sin_vacios_ni_duplicados():
    texto = f"  {RUTA_REALISTA}  ; ;\n{OTRA_RUTA}\n; {RUTA_REALISTA} ;\n  "
    app = Aplicacion(codigo="crm", nombre="CRM", iteraciones=texto)

    assert app.iteraciones_lista() == [RUTA_REALISTA, OTRA_RUTA]
