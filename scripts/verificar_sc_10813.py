#!/usr/bin/env python3
"""Script para verificar el SC 10813 en MongoDB."""
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

def main():
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    client = MongoClient(mongo_uri)
    db = client.sistema_integrado
    
    # Buscar el requerimiento con SC 10813
    print("🔍 Buscando SC 10813 en requerimientos...")
    req = db.requerimiento.find_one({"solicitud.codigo_sc": "10813"})
    
    if req:
        print(f"✅ SC 10813 encontrado!")
        print(f"   - _id: {req.get('_id')}")
        print(f"   - codigo_req: {req.get('codigo_req')}")
        print(f"   - aplicacion_id: {req.get('aplicacion_id')}")
        print(f"   - estado: {req.get('estado')}")
        print(f"   - solicitud.squad_id: {req.get('solicitud', {}).get('squad_id')}")
        print(f"   - solicitud.codigo_sc: {req.get('solicitud', {}).get('codigo_sc')}")
    else:
        print("❌ SC 10813 NO encontrado")
    
    # Buscar cuántos requerimientos hay con aplicacion_id = "1"
    print("\n📊 Estadísticas de aplicacion_id...")
    app1_count = db.requerimiento.count_documents({"aplicacion_id": "1"})
    print(f"   - Requerimientos con aplicacion_id='1' (CRM): {app1_count}")
    
    # Buscar por aplicacion_id
    apps = db.requerimiento.distinct("aplicacion_id")
    print(f"   - Aplicaciones únicas: {apps}")
    
    # Si el SC existe, verificar por qué no filtra
    if req:
        print("\n🔧 Verificando filtro...")
        resultado = db.requerimiento.find_one({"aplicacion_id": "1", "solicitud.codigo_sc": "10813"})
        if resultado:
            print("   ✅ Requerimiento existe con filtro aplicacion_id='1'")
        else:
            print(f"   ❌ Requerimiento NO encontrado con filtro aplicacion_id='1'")
            print(f"      El SC 10813 tiene aplicacion_id: {req.get('aplicacion_id')}")

if __name__ == "__main__":
    main()

