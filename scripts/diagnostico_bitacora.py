#!/usr/bin/env python
"""Script de diagnóstico para la colección Bitácora."""
import asyncio
from motor.motor_asyncio import AsyncClient
from pymongo.errors import OperationFailure

async def diagnosticar():
    """Conectar a MongoDB e intentar diagnosticar el problema."""
    try:
        # Conectar a MongoDB
        client = AsyncClient("mongodb://localhost:27017")
        db = client["sistema_integrado"]
        
        print("✓ Conectado a MongoDB")
        
        # Listar colecciones
        colecciones = await db.list_collection_names()
        print(f"✓ Colecciones: {colecciones}")
        
        # Verificar si bitacora existe
        if "bitacora" not in colecciones:
            print("⚠️ AVISO: Colección 'bitacora' no existe")
            return
        
        bitacora_col = db["bitacora"]
        
        # Contar documentos
        count = await bitacora_col.count_documents({})
        print(f"✓ Documentos en bitacora: {count}")
        
        # Listar índices
        indices = await bitacora_col.index_information()
        print(f"✓ Índices: {list(indices.keys())}")
        
        # Intentar una consulta simple
        try:
            resultado = await bitacora_col.find_one({})
            if resultado:
                print(f"✓ Documento de ejemplo encontrado")
                print(f"  - ID: {resultado.get('_id')}")
                print(f"  - Aplicación: {resultado.get('aplicacion_id')}")
                print(f"  - Creado en: {resultado.get('creado_en')}")
            else:
                print("⚠️ AVISO: No hay documentos en bitácora")
        except OperationFailure as e:
            print(f"❌ Error en consulta simple: {str(e)}")
        
        # Intentar una consulta con sort
        try:
            resultado = await bitacora_col.find({}).sort("_id", -1).limit(1).to_list(1)
            print(f"✓ Sort por _id funcionó: {len(resultado)} documento(s)")
        except OperationFailure as e:
            print(f"❌ Error en sort por _id: {str(e)}")
        
        # Intentar sort por creado_en
        try:
            resultado = await bitacora_col.find({}).sort("creado_en", -1).limit(1).to_list(1)
            print(f"✓ Sort por creado_en funcionó: {len(resultado)} documento(s)")
        except OperationFailure as e:
            print(f"❌ Error en sort por creado_en: {str(e)}")
            print("   Posible causa: Índice corrupto o documentos sin ese campo")
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error de conexión: {str(e)}")

if __name__ == "__main__":
    asyncio.run(diagnosticar())
