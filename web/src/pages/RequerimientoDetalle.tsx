// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  Aviso, Boton, Campo, Chip, EncabezadoPagina, Icono, PanelPestana, Pestanas, Selector, Tarjeta, usePestanaEnHash,
} from '../components/ui'
import type { DefinicionPestana } from '../components/ui'
import client from '../api/client'
import Modal from '../components/Modal'
import { useLista, useEstados } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion, Entrega, Persona } from '../types'
import { useHistorialEstados } from './requerimiento-detalle/useHistorialEstados'
import ModalHistorialEstados from './requerimiento-detalle/ModalHistorialEstados'
import ModalEntrega from './requerimiento-detalle/ModalEntrega'
import type { ModoModalEntrega } from './requerimiento-detalle/ModalEntrega'
import SeccionLiquidacion from './requerimiento-detalle/SeccionLiquidacion'
import SeccionBitacora from './requerimiento-detalle/SeccionBitacora'
import SeccionEntregas from './requerimiento-detalle/SeccionEntregas'
import { useFormularioEntrega } from './requerimiento-detalle/useFormularioEntrega'
import { calcularEstadosOfrecidos } from './requerimiento-detalle/estadosOfrecidos'
import { usePersonasDelSquad } from './requerimiento-detalle/usePersonasDelSquad'
import { useRequerimientoDetalle } from './requerimiento-detalle/useRequerimientoDetalle'
import SeccionDatosGenerales, { ID_FORMULARIO_DATOS_GENERALES } from './requerimiento-detalle/SeccionDatosGenerales'
import SeccionResumen from './requerimiento-detalle/SeccionResumen'
import SeccionSeguimientoHitss from './requerimiento-detalle/SeccionSeguimientoHitss'
import SeccionSeguimientoEpm from './requerimiento-detalle/SeccionSeguimientoEpm'

export default function RequerimientoDetalle() {
  const { reqId } = useParams<{ reqId: string }>()
  // Aviso que deja la pantalla de creación si alguna entrega no pudo registrarse.
  const location = useLocation()
  const [avisoCreacion] = useState(
    () => (location.state as { avisoCreacion?: string } | null)?.avisoCreacion ?? '',
  )
  const [avisoMovimiento] = useState(
    () => (location.state as { avisoMovimiento?: string } | null)?.avisoMovimiento ?? '',
  )
  const { tienePermiso, usuario } = useAuth()
  const { modoConsolidado } = useAplicacion()
  const puedeEditarReq = tienePermiso('requerimientos.editar')
  // Mover entre squads: solo administradores, nunca en modo consolidado (el backend responde 409).
  const puedeCambiarSquad = puedeEditarReq && !modoConsolidado
    && (usuario?.rol === 'superadmin' || usuario?.rol === 'admin_app')
  const puedeEditarTipificacion = puedeEditarReq || tienePermiso('requerimientos.tipificacion.editar')
  const puedeEditarIdAzure = puedeEditarReq || tienePermiso('requerimientos.id_azure_hitss.editar')
  const puedeEditarAnalista = puedeEditarReq || tienePermiso('requerimientos.analista.editar')
  const puedeVerHorasSiguienteAnio = tienePermiso('requerimientos.horas_siguiente_anio.ver')
  const puedeEditarHorasSiguienteAnio = puedeVerHorasSiguienteAnio && tienePermiso('requerimientos.horas_siguiente_anio.editar')
  const puedeEliminarBitacora = tienePermiso('admin.roles.editar')
  // Pestaña activa en `location.hash` (#entregas…); "Horas siguiente año" solo con permiso.
  const idsPestanas = puedeVerHorasSiguienteAnio
    ? ['datos', 'entregas', 'seguimiento', 'seguimiento-epm', 'liquidacion', 'horas']
    : ['datos', 'entregas', 'seguimiento', 'seguimiento-epm', 'liquidacion']
  const [pestana, cambiarPestana] = usePestanaEnHash(idsPestanas, 'datos')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: squads } = useLista<Aplicacion>('/aplicaciones')
  const { estadosReq, estadosEnt } = useEstados()

  // Mapa {estado: [siguientes permitidos]}; una sola carga. Si falla, se ofrecen todos.
  const [transiciones, setTransiciones] = useState<Record<string, string[]> | null>(null)
  useEffect(() => {
    client.get<Record<string, string[]>>('/requerimientos/transiciones')
      .then((r) => setTransiciones(r.data))
      .catch(() => setTransiciones(null))
  }, [])

  const detalle = useRequerimientoDetalle(reqId, {
    modoConsolidado,
    puedeEditarReq,
    puedeEditarTipificacion,
    puedeVerHorasSiguienteAnio,
    puedeEditarHorasSiguienteAnio,
  })
  const { req, liquidacion, eventos, aviso, ok, campos } = detalle

  // Un solo modal de entrega (crear y editar) con su formulario (estados + lógica de
  // cargar/cancelar). `modalEntrega` es el modo con el que está abierto, o null si cerrado.
  const formEntrega = useFormularioEntrega(estadosEnt)
  const [modalEntrega, setModalEntrega] = useState<ModoModalEntrega | null>(null)
  const [bitacoraAbierta, setBitacoraAbierta] = useState(false)

  function abrirNuevaEntrega(): void {
    formEntrega.cancelar()
    // N.º sugerido: la siguiente a la mayor existente (editable en el modal).
    const mayor = (req?.entregas ?? []).reduce((m, en) => Math.max(m, en.numero), 0)
    formEntrega.actualizar('numero', String(mayor + 1))
    setModalEntrega('crear')
  }

  function abrirEdicionEntrega(en: Entrega): void {
    formEntrega.cargarEntrega(en)
    setModalEntrega('editar')
  }

  function cerrarModalEntrega(): void {
    setModalEntrega(null)
    formEntrega.cancelar()
  }

  // Historial de estados (popup con cuánto tiempo estuvo en cada estado y a
  // cuál pasó) tanto del requerimiento como de una entrega puntual.
  const historial = useHistorialEstados(reqId)

  const {
    resolverNombreSquad,
    personasSquad,
    ltHitss,
    ltEpm,
    scrums,
    analistas,
    scrumAsignado,
    analistaAsignado,
  } = usePersonasDelSquad({
    squadId: campos.valores.squadId,
    personas,
    squads,
    scrumId: campos.valores.scrumId,
    analistaId: campos.valores.analistaId,
  })

  // Estados a ofrecer: el actual + los siguientes permitidos + los personalizados
  // (fuera del mapa de transiciones). Si no hay mapa, se ofrecen todos.
  const estadosOfrecidos = calcularEstadosOfrecidos(req?.estado, estadosReq, transiciones)

  if (!req) {
    return <div className="text-slate-500">{aviso || 'Cargando…'}</div>
  }

  // Resumen lateral: reutiliza el mismo cálculo de "cumple ANS estimación"
  // que antes vivía en la tarjeta de Datos generales, y la última entrega
  // (por número) para su ANS de entrega — sin traer ni calcular nada nuevo.
  const cumpleAnsEstimacion =
    req.fecha_limite && campos.valores.fechaRealEntregaEst
      ? new Date(campos.valores.fechaRealEntregaEst) <= new Date(req.fecha_limite)
      : null
  const entregasOrdenadas = [...req.entregas].sort((a, b) => a.numero - b.numero)
  const ultimaEntrega = entregasOrdenadas.length > 0
    ? entregasOrdenadas[entregasOrdenadas.length - 1]
    : null

  const cantidadSeguimientosEpm = (req.seguimientos_epm ?? []).length
  const contadorSeguimientoEpm = cantidadSeguimientosEpm > 0
    ? cantidadSeguimientosEpm
    : (req.seguimiento_epm?.trim() ? 1 : 0)

  const pestanas: DefinicionPestana[] = [
    { id: 'datos', etiqueta: 'Datos generales' },
    { id: 'entregas', etiqueta: 'Entregas', contador: req.entregas.length },
    {
      id: 'seguimiento',
      etiqueta: 'Seguimiento Hitss',
      aviso: !req.tipificacion,
      textoAviso: 'Falta la tipificación',
    },
    { id: 'seguimiento-epm', etiqueta: 'Seguimiento EPM', contador: contadorSeguimientoEpm },
    { id: 'liquidacion', etiqueta: 'Liquidación' },
    { id: 'horas', etiqueta: 'Horas siguiente año', oculta: !puedeVerHorasSiguienteAnio },
  ]

  return (
    <div className="space-y-6">
      <Link to="/requerimientos" className="text-sm text-marca hover:underline">
        ← Requerimientos
      </Link>

      <EncabezadoPagina
        icono={<Icono nombre="documento" />}
        titulo={req.codigo_req}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            {req.nombre && <span>{req.nombre}</span>}
            {puedeEditarReq ? (
              <Selector
                compacto
                value={req.estado}
                onChange={(e) => detalle.transicion(e.target.value)}
              >
                {estadosOfrecidos.map((s) => <option key={s} value={s}>{s}</option>)}
              </Selector>
            ) : (
              <Chip tono="neutro">{req.estado}</Chip>
            )}
          </span>
        }
        acciones={
          <>
            <Boton variante="secundario" onClick={historial.verHistorialRequerimiento}>
              Historial de estados
            </Boton>
            {puedeEditarReq && (
              <Boton variante="primario" type="submit" form={ID_FORMULARIO_DATOS_GENERALES}>
                Guardar cambios
              </Boton>
            )}
          </>
        }
      />

      {aviso && (
        <Aviso tono="error">
          <span className="flex flex-wrap items-center gap-3">
            <span>{aviso}</span>
            {detalle.hayConflicto && (
              <Boton variante="secundario" tamano="sm" onClick={() => void detalle.recargarTrasConflicto()}>
                Recargar (se descartan los cambios sin guardar)
              </Boton>
            )}
          </span>
        </Aviso>
      )}
      {ok && <Aviso tono="exito">{ok}</Aviso>}
      {avisoCreacion && <Aviso tono="alerta">{avisoCreacion}</Aviso>}
      {avisoMovimiento && <div role="status"><Aviso tono="exito">{avisoMovimiento}</Aviso></div>}

      <SeccionResumen
        squadNombre={resolverNombreSquad(campos.valores.squadId)}
        cumpleAnsEstimacion={cumpleAnsEstimacion}
        ultimaEntrega={ultimaEntrega}
        cantidadEntregas={req.entregas.length}
        horasEstimadas={req.total_horas_estimadas}
      />

      {/* Pestañas internas. Los paneles ocultos siguen montados para no perder lo escrito;
          "Guardar cambios" del encabezado envía el formulario de Datos generales aunque
          esa pestaña no esté a la vista. */}
      <div className="space-y-4">
        <Pestanas
          prefijo="requerimiento"
          etiqueta="Secciones del requerimiento"
          pestanas={pestanas}
          activa={pestana}
          onCambiar={cambiarPestana}
        />

        <PanelPestana prefijo="requerimiento" id="datos" activa={pestana}>
          <SeccionDatosGenerales
            campos={campos}
            req={req}
            puedeCambiarSquad={puedeCambiarSquad}
            puedeEditarReq={puedeEditarReq}
            puedeEditarIdAzure={puedeEditarIdAzure}
            onGuardadoIdAzure={detalle.recargar}
            puedeEditarAnalista={puedeEditarAnalista}
            onGuardadoAnalista={detalle.recargar}
            resolverNombreSquad={resolverNombreSquad}
            ltHitss={ltHitss}
            ltEpm={ltEpm}
            scrums={scrums}
            analistas={analistas}
            personas={personas}
            personasSquad={personasSquad}
            scrumAsignado={scrumAsignado}
            analistaAsignado={analistaAsignado}
            onSubmit={detalle.guardar}
          />
        </PanelPestana>

        <PanelPestana prefijo="requerimiento" id="entregas" activa={pestana}>
          <SeccionEntregas
            entregas={req.entregas}
            totalHorasEstimadas={req.total_horas_estimadas}
            puedeEditarReq={puedeEditarReq}
            puedeEditarTipificacion={puedeEditarTipificacion}
            tipifEdicion={detalle.tipifEdicion}
            guardandoTipif={detalle.guardandoTipif}
            onIniciarEdicionTipif={detalle.iniciarEdicionTipif}
            onCambiarTipif={detalle.cambiarTipif}
            onCancelarTipif={detalle.cancelarTipif}
            onGuardarTipif={detalle.guardarTipifEntrega}
            onVerHistorialEntrega={historial.verHistorialEntrega}
            onEditarEntrega={abrirEdicionEntrega}
            onEliminarEntrega={detalle.eliminarEntrega}
            onAgregarEntrega={puedeEditarReq ? abrirNuevaEntrega : undefined}
          />
        </PanelPestana>

        <PanelPestana prefijo="requerimiento" id="seguimiento" activa={pestana}>
          <SeccionSeguimientoHitss
            seguimiento={campos.valores.seguimiento}
            tipificacion={campos.valores.tipificacion}
            onCambiar={campos.actualizar}
            puedeEditarTipificacion={puedeEditarTipificacion}
            onGuardar={detalle.guardarTipificacionReq}
          />
        </PanelPestana>

        <PanelPestana prefijo="requerimiento" id="seguimiento-epm" activa={pestana}>
          <SeccionSeguimientoEpm
            registros={req.seguimientos_epm ?? []}
            textoLegado={req.seguimiento_epm}
            puedeEditar={puedeEditarReq}
            guardando={detalle.guardandoSeguimientoEpm}
            error={detalle.errorSeguimientoEpm}
            ok={detalle.okSeguimientoEpm}
            onAgregar={detalle.agregarSeguimientoEpm}
          />
        </PanelPestana>

        <PanelPestana prefijo="requerimiento" id="liquidacion" activa={pestana}>
          <SeccionLiquidacion liquidacion={liquidacion} />
        </PanelPestana>

        {puedeVerHorasSiguienteAnio && (
          <PanelPestana prefijo="requerimiento" id="horas" activa={pestana}>
            <Tarjeta>
              <h2 className="etiqueta-sup mb-3">Horas para el siguiente año</h2>
              <p className="mb-3 text-sm text-slate-500">
                Información del requerimiento sin efecto en liquidación ni ANS.
              </p>
              <form onSubmit={detalle.guardarHorasSiguienteAnio} aria-label="Horas para el siguiente año"
                aria-busy={detalle.guardandoHorasSiguienteAnio}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm sm:col-span-2">
                    <span className="mb-1 block text-slate-600">Número de horas</span>
                    <Campo
                      type="number"
                      min="0"
                      step="any"
                      value={campos.valores.horasSiguienteAnio}
                      onChange={(e) => campos.actualizar('horasSiguienteAnio', e.target.value)}
                      disabled={!puedeEditarHorasSiguienteAnio || detalle.guardandoHorasSiguienteAnio}
                      className="w-full"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">Fecha de entrega comprometida</span>
                    <Campo
                      type="datetime-local"
                      value={campos.valores.fechaEntregaComprometidaSiguienteAnio}
                      onChange={(e) => campos.actualizar('fechaEntregaComprometidaSiguienteAnio', e.target.value)}
                      disabled={!puedeEditarHorasSiguienteAnio || detalle.guardandoHorasSiguienteAnio}
                      className="w-full"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-600">Fecha real de entrega</span>
                    <Campo
                      type="datetime-local"
                      value={campos.valores.fechaRealEntregaSiguienteAnio}
                      onChange={(e) => campos.actualizar('fechaRealEntregaSiguienteAnio', e.target.value)}
                      disabled={!puedeEditarHorasSiguienteAnio || detalle.guardandoHorasSiguienteAnio}
                      className="w-full"
                    />
                  </label>
                </div>
                {detalle.errorHorasSiguienteAnio && (
                  <div role="alert" className="mt-3">
                    <Aviso tono="error">{detalle.errorHorasSiguienteAnio}</Aviso>
                  </div>
                )}
                {detalle.okHorasSiguienteAnio && (
                  <div role="status" className="mt-3">
                    <Aviso tono="exito">{detalle.okHorasSiguienteAnio}</Aviso>
                  </div>
                )}
                {puedeEditarHorasSiguienteAnio && (
                  <Boton type="submit" variante="secundario" className="mt-3" disabled={detalle.guardandoHorasSiguienteAnio}>
                    {detalle.guardandoHorasSiguienteAnio ? 'Guardando…' : 'Guardar horas para el siguiente año'}
                  </Boton>
                )}
              </form>
            </Tarjeta>
          </PanelPestana>
        )}
      </div>

      {/* Bitácora: fuera del flujo, en botón flotante + panel superpuesto */}
      <Boton
        variante="primario"
        icono={<Icono nombre="portafolio" />}
        onClick={() => setBitacoraAbierta(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg"
      >
        Bitácora ({eventos.length})
      </Boton>

      <Modal
        titulo="Bitácora"
        icono={<Icono nombre="portafolio" />}
        abierto={bitacoraAbierta}
        onCerrar={() => setBitacoraAbierta(false)}
        ancho="xl"
      >
        <SeccionBitacora
          eventos={eventos}
          puedeEliminar={puedeEliminarBitacora}
          onEliminar={detalle.eliminarEvento}
          ocultarTitulo
        />
      </Modal>

      <ModalHistorialEstados
        titulo={historial.titulo}
        abierto={historial.abierto}
        cargando={historial.cargando}
        error={historial.error}
        segmentos={historial.segmentos}
        onCerrar={historial.cerrar}
      />

      <ModalEntrega
        abierto={modalEntrega !== null}
        modo={modalEntrega ?? 'crear'}
        form={formEntrega}
        estadosEnt={estadosEnt}
        estadoRequerimiento={req?.estado ?? ''}
        onSubmit={(e) => detalle.agregarEntrega(e, formEntrega.cuerpoEntrega, cerrarModalEntrega)}
        onCerrar={cerrarModalEntrega}
      />
    </div>
  )
}
