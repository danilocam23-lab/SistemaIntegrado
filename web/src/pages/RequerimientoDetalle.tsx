import { Link, useParams } from 'react-router-dom'
import { Aviso, Chip, Selector } from '../components/ui'
import { useLista, useEstados } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import { useAuth } from '../context/AuthContext'
import type { Aplicacion, Persona } from '../types'
import { useHistorialEstados } from './requerimiento-detalle/useHistorialEstados'
import ModalHistorialEstados from './requerimiento-detalle/ModalHistorialEstados'
import SeccionLiquidacion from './requerimiento-detalle/SeccionLiquidacion'
import SeccionBitacora from './requerimiento-detalle/SeccionBitacora'
import SeccionEntregas from './requerimiento-detalle/SeccionEntregas'
import FormularioEntrega from './requerimiento-detalle/FormularioEntrega'
import { useFormularioEntrega } from './requerimiento-detalle/useFormularioEntrega'
import { usePersonasDelSquad } from './requerimiento-detalle/usePersonasDelSquad'
import { useRequerimientoDetalle } from './requerimiento-detalle/useRequerimientoDetalle'
import SeccionDatosGenerales from './requerimiento-detalle/SeccionDatosGenerales'
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

  // Formulario de entrega (estados + lógica de cargar/cancelar/limpiar)
  const form = useFormularioEntrega(estadosEnt)

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

  return (
    <div className="space-y-6">
      <div>
        <Link to="/requerimientos" className="text-sm text-marca hover:underline">
          ← Requerimientos
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="titulo-pagina">{req.codigo_req}</h1>
          {req.nombre && <span className="text-base text-slate-600">— {req.nombre}</span>}
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
        </div>
      </div>

      {aviso && <Aviso tono="error">{aviso}</Aviso>}
      {ok && <Aviso tono="exito">{ok}</Aviso>}

      {/* Datos generales */}
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

      {/* Seguimiento Hitss y Tipificación (editable por Administrador de squad) */}
      <SeccionSeguimientoHitss
        seguimiento={campos.valores.seguimiento}
        tipificacion={campos.valores.tipificacion}
        onCambiar={campos.actualizar}
        puedeEditarTipificacion={puedeEditarTipificacion}
        onGuardar={detalle.guardarTipificacionReq}
        onVerHistorial={historial.verHistorialRequerimiento}
      />

      {/* Entregas */}
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
        onEditarEntrega={form.cargarEntrega}
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

      {/* Liquidación */}
      <SeccionLiquidacion liquidacion={liquidacion} />

      {/* Bitácora */}
      <SeccionBitacora
        eventos={eventos}
        puedeEliminar={puedeEliminarBitacora}
        onEliminar={detalle.eliminarEvento}
      />

      <ModalHistorialEstados
        titulo={historial.titulo}
        abierto={historial.abierto}
        cargando={historial.cargando}
        error={historial.error}
        segmentos={historial.segmentos}
        onCerrar={historial.cerrar}
      />
    </div>
  )
}
