// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import { Aviso, Boton, Interruptor, Tarjeta } from '../../components/ui'
import { SelectorPersonaAzure } from '../../components/azure/SelectorPersonaAzure'
import { useConfigPersonaAzure } from '../../components/azure/useConfigPersonaAzure'
import { useAuth } from '../../context/AuthContext'
import type { RespuestaTiposConfigAzure } from '../../types'

const TARGET_AZURE = 'hitss'

const AVISO_CACHE_DEFECTO =
  'Mostrando la última lista conocida de tipos: no se pudo consultar Azure DevOps, así que puede estar incompleta o desactualizada. Revísala antes de guardar.'

function paramsTipos(usuarioId: string): URLSearchParams {
  const params = new URLSearchParams()
  params.set('target', TARGET_AZURE)
  if (usuarioId) params.set('usuario_id', usuarioId)
  return params
}

export function SeccionAzureDevOps() {
  const { tienePermiso } = useAuth()
  const puedeEditar = tienePermiso('azure_devops.editar')
  const { usuarioId, puedeElegir, personasConConfig, personaSeleccionada, cambiarUsuario } =
    useConfigPersonaAzure(TARGET_AZURE)
  const [disponibles, setDisponibles] = useState<RespuestaTiposConfigAzure['disponibles']>([])
  const [activos, setActivos] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [ok, setOk] = useState('')
  const [avisoCache, setAvisoCache] = useState('')

  const activosOrdenados = useMemo(() => {
    const nombresDisponibles = new Set(disponibles.map((tipo) => tipo.nombre))
    const visibles = disponibles.map((tipo) => tipo.nombre).filter((nombre) => activos.has(nombre))
    // Preservamos los activos que NO están en `disponibles`. Cuando la lista viene
    // cacheada (Azure no respondió) puede estar incompleta, y enviar solo la
    // intersección borraría tipos que la vista nunca pudo mostrar (p. ej.
    // "Contextualización"). No es redundante: sin esto, "Guardar" destruiría
    // configuración que el usuario no vio ni tocó.
    const ocultosActivos = [...activos].filter((nombre) => !nombresDisponibles.has(nombre))
    return [...visibles, ...ocultosActivos]
  }, [activos, disponibles])

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setAviso('')
    setAvisoCache('')
    client
      .get<RespuestaTiposConfigAzure>(`/azdo/esquema/tipos-config?${paramsTipos(usuarioId).toString()}`)
      .then(({ data }) => {
        if (cancelado) return
        setDisponibles(data.disponibles)
        setActivos(new Set(data.activos))
        setAvisoCache(data.cacheado ? data.aviso || AVISO_CACHE_DEFECTO : '')
      })
      .catch((error) => {
        if (!cancelado) setAviso(mensajeError(error))
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [usuarioId])

  function alternarTipo(nombre: string): void {
    setActivos((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(nombre)) siguiente.delete(nombre)
      else siguiente.add(nombre)
      return siguiente
    })
    setOk('')
    setAviso('')
  }

  async function guardar(): Promise<void> {
    setGuardando(true)
    setAviso('')
    setOk('')
    try {
      const { data } = await client.put<RespuestaTiposConfigAzure>(
        `/azdo/esquema/tipos-config?${paramsTipos(usuarioId).toString()}`,
        { activos: activosOrdenados },
      )
      setDisponibles(data.disponibles)
      setActivos(new Set(data.activos))
      setAvisoCache(data.cacheado ? data.aviso || AVISO_CACHE_DEFECTO : '')
      setOk('Configuración de tipos de work item guardada.')
    } catch (error) {
      setAviso(mensajeError(error))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Activa los tipos de work item que se consultan en el Esquema de Azure para el proyecto HITSS.
      </p>

      <SelectorPersonaAzure
        puedeElegir={puedeElegir}
        personasConConfig={personasConConfig}
        usuarioId={usuarioId}
        personaSeleccionada={personaSeleccionada}
        onCambiar={cambiarUsuario}
      />

      {avisoCache && <Aviso tono="info">{avisoCache}</Aviso>}
      {aviso && <Aviso tono="error">{aviso}</Aviso>}
      {ok && <Aviso tono="exito">{ok}</Aviso>}
      {!puedeEditar && (
        <Aviso tono="info">No tienes permiso de edición; los tipos se muestran en modo solo lectura.</Aviso>
      )}

      <Tarjeta className="divide-y divide-slate-100" padding={false}>
        {cargando ? (
          <div className="p-4 text-sm text-slate-500">Cargando tipos de work item…</div>
        ) : disponibles.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">No hay tipos de work item disponibles.</div>
        ) : (
          disponibles.map((tipo) => {
            const activo = activos.has(tipo.nombre)
            return (
              <div key={tipo.nombre} className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-slate-300"
                    style={tipo.color ? { backgroundColor: tipo.color } : undefined}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium text-slate-700">{tipo.nombre}</span>
                </div>
                <Interruptor
                  activo={activo}
                  etiquetaActivo={`Desactivar ${tipo.nombre}`}
                  etiquetaInactivo={`Activar ${tipo.nombre}`}
                  disabled={!puedeEditar || cargando || guardando}
                  onClick={() => alternarTipo(tipo.nombre)}
                />
              </div>
            )
          })
        )}
      </Tarjeta>

      <div className="flex justify-end">
        <Boton
          variante="primario"
          onClick={() => void guardar()}
          disabled={!puedeEditar || cargando || guardando}
        >
          {guardando ? 'Guardando…' : 'Guardar tipos activos'}
        </Boton>
      </div>
    </div>
  )
}
