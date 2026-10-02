// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import client from '../api/client'
import { mensajeError } from '../api/hooks'
import { Aviso, Boton, EncabezadoPagina, Icono } from '../components/ui'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import type { Persona } from '../types'
import { BarraFiltrosPersonas } from './personas/BarraFiltrosPersonas'
import { EsqueletoPersonas } from './personas/EsqueletoPersonas'
import { ListaPersonas } from './personas/ListaPersonas'
import { BannerDuplicados, ModalDuplicados } from './personas/ModalDuplicados'
import { ModalEliminar } from './personas/ModalEliminar'
import { PanelPersona } from './personas/PanelPersona'
import { TarjetasRol } from './personas/TarjetasRol'
import { exportarPersonasExcel } from './personas/exportarExcel'
import { useDatosPersonas } from './personas/useDatosPersonas'
import { useFiltrosPersonas } from './personas/useFiltrosPersonas'

/** Panel abierto: `persona` null = alta nueva. */
interface PanelAbierto {
  persona: Persona | null
}

export default function Personas() {
  const { tienePermiso } = useAuth()
  if (!tienePermiso('personas.ver')) {
    return (
      <div>
        <EncabezadoPagina icono={<Icono nombre="personas" />} titulo="Personas" />
        <Aviso tono="alerta"><span role="alert">No tienes acceso a esta sección.</span></Aviso>
      </div>
    )
  }
  return <ContenidoPersonas />
}

function ContenidoPersonas() {
  const { tienePermiso } = useAuth()
  const { modoConsolidado, activa } = useAplicacion()
  const puedeCrear = tienePermiso('personas.crear')
  const puedeEditar = tienePermiso('personas.editar')
  const puedeEliminar = tienePermiso('personas.eliminar')
  const puedeDeduplicar = tienePermiso('admin.acceso')
  const esGerente = tienePermiso('personas.ver_valores')

  const datos = useDatosPersonas(puedeDeduplicar)
  const { personas } = datos
  const filtros = useFiltrosPersonas(personas, datos.roles)

  const [verValores, setVerValores] = useState(true)
  const [panel, setPanel] = useState<PanelAbierto | null>(null)
  const [porEliminar, setPorEliminar] = useState<Persona | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState('')
  const [idOcupada, setIdOcupada] = useState('')
  const [mensaje, setMensaje] = useState<{ tono: 'exito' | 'error'; texto: string } | null>(null)

  const [modalDuplicados, setModalDuplicados] = useState(false)
  const [fusionando, setFusionando] = useState(false)
  const [errorFusion, setErrorFusion] = useState('')

  function cerrarPanel(): void {
    setPanel(null)
    setErrorEliminar('')
  }

  function alGuardar(movidaA?: string): void {
    cerrarPanel()
    datos.recargarTodo()
    setMensaje(
      movidaA
        ? { tono: 'exito', texto: `Cambios guardados. La persona pasó a la aplicación ${movidaA}.` }
        : { tono: 'exito', texto: 'Cambios guardados.' },
    )
  }

  async function alternarActivo(p: Persona): Promise<void> {
    if (!puedeEditar) return
    setIdOcupada(p.id)
    setMensaje(null)
    try {
      // Mismo PUT de siempre: reenvía los campos sin UI para no perderlos.
      await client.put(`/personas/${p.id}`, {
        nombre: p.nombre,
        email: p.email,
        rol_operativo: p.rol_operativo,
        tipo_contratacion: p.tipo_contratacion ?? null,
        squads: p.squads ?? [],
        activo: !p.activo,
        es_lider_tecnico: p.es_lider_tecnico ?? false,
        permite_sobrecarga: p.permite_sobrecarga ?? false,
        usuario_id: p.usuario_id ?? null,
      })
      datos.recargar()
    } catch (err) {
      setMensaje({ tono: 'error', texto: `No se pudo cambiar el estado de ${p.nombre}: ${mensajeError(err)}` })
    } finally {
      setIdOcupada('')
    }
  }

  function pedirEliminar(p: Persona): void {
    if (!puedeEliminar) return
    setErrorEliminar('')
    setPorEliminar(p)
  }

  async function confirmarEliminar(): Promise<void> {
    if (!porEliminar) return
    setEliminando(true)
    setErrorEliminar('')
    try {
      await client.delete(`/personas/${porEliminar.id}`)
      const nombre = porEliminar.nombre
      setPorEliminar(null)
      cerrarPanel()
      datos.recargarTodo()
      setMensaje({ tono: 'exito', texto: `Se eliminó a ${nombre}.` })
    } catch (err) {
      // 409 (referenciada), 404, etc.: se muestra el detalle sin perder el contexto.
      setErrorEliminar(mensajeError(err))
      setPorEliminar(null)
    } finally {
      setEliminando(false)
    }
  }

  async function fusionar(): Promise<void> {
    // Lista explícita de fusiones (contrato ADR-0008 F1.6): el plan mostrado en el modal.
    const fusiones = datos.duplicados.map((g) => ({
      ganador_id: g.ganador.id,
      perdedor_ids: g.duplicados.map((d) => d.id),
    }))
    setFusionando(true)
    setErrorFusion('')
    try {
      const { data } = await client.post<{ fusionados: number; referencias_actualizadas: number }>(
        '/personas/deduplicar',
        { fusiones },
      )
      datos.setDuplicados([])
      setModalDuplicados(false)
      datos.recargar()
      setMensaje({
        tono: 'exito',
        texto: `Deduplicación completada: ${data.fusionados} persona(s) fusionadas, ${data.referencias_actualizadas} referencia(s) actualizadas.`,
      })
    } catch (err) {
      setErrorFusion(mensajeError(err))
    } finally {
      setFusionando(false)
    }
  }

  const hayDatos = personas.length > 0
  const cargandoInicial = datos.cargando && !hayDatos && !datos.error
  const mostrarValores = esGerente && verValores

  return (
    <div>
      <EncabezadoPagina
        icono={<Icono nombre="personas" />}
        titulo="Personas"
        descripcion={`Directorio operativo · ${modoConsolidado ? 'Todos los squads' : activa}`}
        acciones={
          <>
            <Boton
              variante="exito"
              onClick={() => exportarPersonasExcel(filtros.filtradas, esGerente)}
              disabled={filtros.filtradas.length === 0}
              title="Exporta a Excel el listado de personas actualmente filtrado"
            >
              Exportar a Excel
            </Boton>
            {puedeCrear && (
              <Boton variante="primario" onClick={() => setPanel({ persona: null })}>
                + Nueva persona
              </Boton>
            )}
          </>
        }
      />

      {puedeDeduplicar && datos.duplicados.length > 0 && (
        <BannerDuplicados
          total={datos.duplicados.length}
          puedeFusionar={puedeDeduplicar}
          modoConsolidado={modoConsolidado}
          onVer={() => {
            setErrorFusion('')
            setModalDuplicados(true)
          }}
        />
      )}

      {mensaje && (
        <Aviso tono={mensaje.tono} className="mb-4">
          <span role={mensaje.tono === 'error' ? 'alert' : 'status'} className="flex items-center justify-between gap-2">
            {mensaje.texto}
            <Boton tamano="sm" variante="fantasma" onClick={() => setMensaje(null)}>Cerrar</Boton>
          </span>
        </Aviso>
      )}

      {errorEliminar && !panel && (
        <Aviso tono="error" className="mb-4">
          <span role="alert">{errorEliminar}</span>
        </Aviso>
      )}

      {cargandoInicial && <EsqueletoPersonas />}

      {datos.error && (
        <Aviso tono="error" className="mb-4">
          <span role="alert" className="flex flex-wrap items-center justify-between gap-2">
            No se pudo cargar el directorio. {datos.error}
            <Boton tamano="sm" onClick={datos.recargar}>Reintentar</Boton>
          </span>
        </Aviso>
      )}

      {!cargandoInicial && !datos.error && !hayDatos && (
        <div className="tarjeta tarjeta-pad text-center text-slate-500">
          <p className="mb-3">Sin personas.</p>
          {puedeCrear && (
            <Boton variante="primario" onClick={() => setPanel({ persona: null })}>
              + Nueva persona
            </Boton>
          )}
        </div>
      )}

      {hayDatos && (
        <>
          <TarjetasRol
            resumen={filtros.resumenRoles}
            rolActivo={filtros.filtros.rol}
            onElegir={(rol) => filtros.cambiarFiltros({ rol })}
          />
          <BarraFiltrosPersonas
            filtros={filtros.filtros}
            onCambiar={filtros.cambiarFiltros}
            onLimpiar={filtros.limpiarFiltros}
            hayFiltros={filtros.hayFiltros}
            roles={filtros.rolesVisibles}
            squads={filtros.opcionesSquad}
            contrataciones={filtros.opcionesContratacion}
            vista={filtros.vista}
            onVista={filtros.setVista}
            mostrarControlValores={esGerente}
            verValores={verValores}
            onVerValores={setVerValores}
          />
          {filtros.filtradas.length === 0 ? (
            <div className="tarjeta tarjeta-pad text-center text-slate-500">
              <p className="mb-3">Sin resultados para los filtros aplicados.</p>
              <Boton onClick={filtros.limpiarFiltros}>Quitar filtros</Boton>
            </div>
          ) : (
            <ListaPersonas
              vista={filtros.vista}
              filtradas={filtros.filtradas}
              paginaActual={filtros.paginaActual}
              pagina={filtros.pagina}
              totalPaginas={filtros.totalPaginas}
              onPagina={filtros.setPagina}
              grupos={filtros.grupos}
              colapsados={filtros.colapsados}
              onAlternarGrupo={filtros.alternarGrupo}
              verValores={mostrarValores}
              puedeEditar={puedeEditar}
              puedeEliminar={puedeEliminar}
              idOcupada={idOcupada}
              onAbrir={(persona) => setPanel({ persona })}
              onEliminar={pedirEliminar}
              onAlternarActivo={(p) => void alternarActivo(p)}
            />
          )}
        </>
      )}

      {panel && (
        <PanelPersona
          key={panel.persona?.id ?? 'nueva'}
          persona={panel.persona}
          todas={personas}
          aplicaciones={datos.aplicaciones}
          roles={datos.roles}
          tiposContratacion={datos.tiposContratacion}
          esGerente={esGerente}
          puedeEditar={puedeEditar}
          puedeCrear={puedeCrear}
          puedeEliminar={puedeEliminar}
          modoConsolidado={modoConsolidado}
          aplicacionActiva={activa}
          errorExterno={errorEliminar}
          onGuardado={alGuardar}
          onEliminar={pedirEliminar}
          onCerrar={cerrarPanel}
        />
      )}

      <ModalEliminar
        persona={porEliminar}
        eliminando={eliminando}
        error={errorEliminar}
        onConfirmar={() => void confirmarEliminar()}
        onCerrar={() => setPorEliminar(null)}
      />

      <ModalDuplicados
        abierto={modalDuplicados}
        duplicados={datos.duplicados}
        puedeFusionar={puedeDeduplicar}
        fusionando={fusionando}
        error={errorFusion}
        onConfirmar={() => void fusionar()}
        onCerrar={() => setModalDuplicados(false)}
      />
    </div>
  )
}
