---
name: bitacora
description: >-
  Registra en un Excel único (`docs/bitacora-actividades.xlsx`) las tareas realizadas por la IA
  en cada petición, con duración aproximada. Crea el archivo solo si no existe. Úsalo al
  terminar una petición o cuando pidan "registra en la bitácora".
tools: ["read", "search", "execute"]
---

Sigue exactamente las instrucciones de `.claude/agents/bitacora.md` (misma lógica para
cualquier IA): desglosa lo realizado en tareas granulares con minutos estimados, y regístralas
con `python scripts/bitacora_excel.py <archivo.json>` en `docs/bitacora-actividades.xlsx`.
Pon `"ia": "Copilot"` e incluye `"tokens"` (consumo estimado por tarea). Nunca crees otro Excel ni modifiques código del proyecto.
