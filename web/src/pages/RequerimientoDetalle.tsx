import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Aviso, Boton, Chip, EncabezadoPagina, Icono, Selector } from '../components/ui'
import Modal from '../components/Modal'
import { useLista, useEstados } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion, Entrega, Persona } from '../types'
import { useHistorialEstados } from './requerimiento-detalle/useHistorialEstados'
import ModalHistorialEstados from './requerimiento-detalle/ModalHistorialEstados'
import ModalEditarEntrega from './requerimiento-detalle/ModalEditarEntrega'
import SeccionLiquidacion from './requerimiento-detalle/SeccionLiquidacion'
import SeccionBitacora from './requerimiento-detalle/SeccionBitacora'
import SeccionEntregas from './requerimiento-detalle/SeccionEntregas'
import FormularioEntrega from './requerimiento-detalle/FormularioEntrega'
import { useFormularioEntrega } from './requerimiento-detalle/useFormularioEntrega'
import { usePersonasDelSquad } from './requerimiento-detalle/usePersonasDelSquad'
import { useRequerimientoDetalle } from './requerimiento-detalle/useRequerimientoDetalle'
import SeccionDatosGenerales, { ID_FORMULARIO_DATOS_GENERALES } from './requerimiento-detalle/SeccionDatosGenerales'
import SeccionResumen from './requerimiento-detalle/SeccionResumen'
import SeccionSeguimientoHitss from './requerimiento-detalle/SeccionSeguimientoHitss'

export default function RequerimientoDetalle() {
  const { reqId } = useParams<{ reqId: string }>()
  const { tienePermiso } = useAuth()
  const { modoConsolidado } = useAplicacion()
  const puedeEditarReq = tienePermiso('requerimientos.editar')
  const puedeEditarTipificacion = puedeEditarReq || tienePermiso('requerimientos.tipificacion.editar')
  const puedeEliminarBitacora = tienePermiso('admin.roles.editar')
  const { datos: personas } = useLista<Persona>('/personas')
  const { datos: squads } = useLista<Aplicacion>('/aplicaciones')
  const { estadosReq, estadosEnt } = useEstados()

  const detalle = useRequerimientoDetalle(reqId, {
    modoConsolidado,
    puedeEditarReq,
    puedeEditarTipificacion,
  })
  const { req, liquidacion, eventos, aviso, ok, campos } = detalle

  // Formulario de entrega (estados + lógica de cargar/cancelar/limpiar).
  // El de alta va al pie de la tabla; el de edición vive en su propio modal y
  // usa una instancia independiente para no compartir estado con el de alta.
  const form = useFormularioEntrega(estadosEnt)
  const formEdicion = useFormularioEntrega(estadosEnt)
  const [modalEdicionAbierto, setModalEdicionAbierto] = useState(false)
  const [bitacoraAbierta, setBitacoraAbierta] = useState(false)

  function abrirEdicionEntrega(en: Entrega): void {
    formEdicion.cargarEntrega(en)
    setModalEdicionAbierto(true)
  }

  function cerrarEdicionEntrega(): void {
    setModalEdicionAbierto(false)
    formEdicion.cancelar()
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

  function cambiarSquad(codigo: string): void {
    campos.actualizar('squadId', codigo)
    campos.actualizar('scrumId', '')
    campos.actualizar('analistaId', '')
  }

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
                {estadosReq.map((s) => <option key={s} value={s}>{s}</option>)}
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

      {aviso && <Aviso tono="error">{aviso}</Aviso>}
      {ok && <Aviso tono="exito">{ok}</Aviso>}

      {/* Bento: fila superior Datos generales + Resumen (mitad cada uno);
          fila inferior Seguimiento Hitss (1/4) + Entregas (2/4) + Liquidación (1/4). */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <SeccionDatosGenerales
            campos={campos}
            req={req}
            puedeEditarReq={puedeEditarReq}
            squads={squads}
            resolverNombreSquad={resolverNombreSquad}
            ltHitss={ltHitss}
            ltEpm={ltEpm}
            scrums={scrums}
            analistas={analistas}
            personas={personas}
            personasSquad={personasSquad}
            scrumAsignado={scrumAsignado}
            analistaAsignado={analistaAsignado}
            onCambiarSquad={cambiarSquad}
            onSubmit={detalle.guardar}
          />
        </div>
        <div className="lg:col-span-2">
          <SeccionResumen
            squadNombre={resolverNombreSquad(campos.valores.squadId)}
            cumpleAnsEstimacion={cumpleAnsEstimacion}
            ultimaEntrega={ultimaEntrega}
            cantidadEntregas={req.entregas.length}
          />
        </div>

        <div>
          <SeccionSeguimientoHitss
            seguimiento={campos.valores.seguimiento}
            tipificacion={campos.valores.tipificacion}
            onCambiar={campos.actualizar}
            puedeEditarTipificacion={puedeEditarTipificacion}
            onGuardar={detalle.guardarTipificacionReq}
          />
        </div>

        <div className="lg:col-span-2">
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
          >
            {puedeEditarReq && (
              <FormularioEntrega
                form={form}
                estadosEnt={estadosEnt}
                estadoRequerimiento={req?.estado ?? ''}
                onSubmit={(e) => detalle.agregarEntrega(e, form.cuerpoEntrega, form.limpiarTrasGuardar)}
                onVerHistorial={() => historial.verHistorialEntrega(form.valores.numero)}
              />
            )}
          </SeccionEntregas>
        </div>

        <div>
          <SeccionLiquidacion liquidacion={liquidacion} />
        </div>
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

      <ModalEditarEntrega
        abierto={modalEdicionAbierto}
        form={formEdicion}
        estadosEnt={estadosEnt}
        estadoRequerimiento={req?.estado ?? ''}
        onSubmit={(e) => detalle.agregarEntrega(e, formEdicion.cuerpoEntrega, cerrarEdicionEntrega)}
        onCerrar={cerrarEdicionEntrega}
      />
    </div>
  )
}
