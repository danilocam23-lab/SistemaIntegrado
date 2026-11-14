// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import { gestorConsentimiento as gestor } from '../analitica/gestor'
import type { DecisionConsentimiento } from '../analitica/consentimiento'
import { iniciarAnalitica } from '../analitica'
import { Aviso, Boton } from './ui'

export default function PreferenciasAnalitica() {
  const [estado, setEstado] = useState(gestor.obtenerEstado)
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    const cancelar = gestor.suscribir(() => setEstado(gestor.obtenerEstado()))
    iniciarAnalitica()
    setEstado(gestor.obtenerEstado())
    return cancelar
  }, [])

  if (!import.meta.env.PROD) return null

  function decidir(decision: DecisionConsentimiento) {
    if (gestor.decidir(decision)) setEditando(false)
  }

  const mostrarOpciones = estado.decision === null || editando

  return (
    <section data-analytics-private="" aria-label="Preferencias de analítica" className="bg-white px-4 py-2">
      <div className="mx-auto max-w-[1600px] space-y-2">
        {estado.error && (
          <div role="alert">
            <Aviso tono="error">{estado.error}</Aviso>
          </div>
        )}
        {mostrarOpciones ? (
          <Aviso tono="info">
            <div className="space-y-2">
              <p id="descripcion-analitica">
                Con su permiso usaremos Google Tag Manager y posibles etiquetas de Google
                Analytics para analítica. Puede rechazar sin afectar el uso del sistema
                y cambiar su preferencia después.
              </p>
              {estado.decision === 'aceptado' && (
                <p>Al rechazar se recargará esta misma página para detener las etiquetas ya iniciadas.</p>
              )}
              <div className="flex flex-wrap gap-2" aria-describedby="descripcion-analitica">
                <Boton variante="secundario" onClick={() => decidir('aceptado')}>Aceptar</Boton>
                <Boton variante="secundario" onClick={() => decidir('rechazado')}>Rechazar</Boton>
                {estado.decision !== null && (
                  <Boton variante="fantasma" onClick={() => setEditando(false)}>Cerrar preferencias</Boton>
                )}
              </div>
            </div>
          </Aviso>
        ) : (
          <Boton
            variante="fantasma"
            tamano="sm"
            aria-expanded={editando}
            onClick={() => setEditando(true)}
          >
            Preferencias de analítica: {estado.decision === 'aceptado' ? 'aceptada' : 'rechazada'}
          </Boton>
        )}
      </div>
    </section>
  )
}
