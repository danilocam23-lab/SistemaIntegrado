"""Provisión de la estructura base de una aplicación nueva.

Al crear una aplicación se clona la **estructura** (categorías, estados y
configuración base) pero NO se copia ningún dato de negocio. Una aplicación
nueva nace lista para usarse pero vacía de información operativa.
"""
from app.documents.categoria import Categoria
from app.documents.configuracion import Configuracion

# Categorías base que hereda toda aplicación nueva.
CATEGORIAS_BASE: list[tuple[str, str, int]] = [
    ("Fábrica", "#6366f1", 1),
    ("Soporte", "#10b981", 2),
    ("Infraestructura", "#f59e0b", 3),
    ("Capacitación", "#ec4899", 4),
    ("Gestión", "#8b5cf6", 5),
]

# Configuración base (clave, valor, grupo).
CONFIG_BASE: list[tuple[str, str, str]] = [
    ("registros_por_pagina", "50", "general"),
    ("horas_mes_default", "180", "capacidad"),
    ("estados_proyecto", "Activo,En progreso,Finalizado,Inactivo", "estados"),
    ("azdo_org_url", "https://dev.azure.com/HitssColombia", "azure_devops"),
    ("azdo_pat", "", "azure_devops"),
    ("azdo_sync_interval", "manual", "azure_devops"),
]


async def provisionar_aplicacion(codigo: str) -> None:
    """Crea la estructura base de la aplicación ``codigo``.

    Es completamente idempotente: verifica cada categoría y parámetro
    individualmente antes de insertarlos, por lo que puede llamarse en cada
    arranque sin riesgo de crear duplicados.
    """
    # Categorías: verificar cada una por nombre para evitar duplicados
    nombres_existentes = {
        cat.nombre
        for cat in await Categoria.find(Categoria.aplicacion_id == codigo).to_list()
    }
    for nombre, color, orden in CATEGORIAS_BASE:
        if nombre not in nombres_existentes:
            await Categoria(
                aplicacion_id=codigo,
                nombre=nombre,
                color=color,
                orden=orden,
                es_base=True,
            ).insert()

    # Parámetros de configuración: verificar por clave
    for clave, valor, grupo in CONFIG_BASE:
        existente = await Configuracion.find_one(
            Configuracion.aplicacion_id == codigo,
            Configuracion.clave == clave,
        )
        if existente is None:
            await Configuracion(
                aplicacion_id=codigo,
                clave=clave,
                valor=valor,
                grupo=grupo,
                es_base=True,
            ).insert()
