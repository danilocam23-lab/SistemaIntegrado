import { useState } from 'react'
import type { FormEvent } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { useAuth } from '../context/AuthContext'
import type { Estimacion } from '../types'
import { Boton, EncabezadoPagina, Icono, TablaScroll } from '../components/ui'

export default function Estimaciones() {
  const { tienePermiso } = useAuth()
  const puedeGestionarEstimaciones = tienePermiso('requerimientos.editar')
  const { datos, error, recargar } = useLista<Estimacion>('/estimaciones')
  const [titulo, setTitulo] = useState('')
  const [cliente, setCliente] = useState('')
  const [iniciativa, setIniciativa] = useState('')
  const [aviso, setAviso] = useState('')
  const [editCell, setEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  function iniciarEdicion(id: string, campo: string, valorActual: string) {
    if (!puedeGestionarEstimaciones) return
    setAviso('')
    setEditCell({ id, campo })
    setEditValue(valorActual)
  }

  async function guardarEdicion(estimacion: Estimacion): Promise<void> {
    if (!puedeGestionarEstimaciones) {
      setAviso('No tienes permiso para editar estimaciones.')
      setEditCell(null)
      return
    }
    if (!editCell || editCell.id !== estimacion.id) return
    try {
      const filas = (estimacion as Estimacion & { filas?: unknown[] }).filas ?? []
      const payload = {
        titulo: editCell.campo === 'titulo' ? editValue : estimacion.titulo ?? '',
        cliente: editCell.campo === 'cliente' ? editValue || null : estimacion.cliente || null,
        iniciativa: editCell.campo === 'iniciativa' ? editValue || null : estimacion.iniciativa || null,
        filas,
      }
      await client.put(`/estimaciones/${estimacion.id}`, payload)
      setEditCell(null)
      setEditValue('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function crear(e: FormEvent): Promise<void> {
    e.preventDefault()
    setAviso('')
    if (!puedeGestionarEstimaciones) {
      setAviso('No tienes permiso para crear estimaciones.')
      return
    }
    try {
      await client.post('/estimaciones', {
        titulo,
        cliente: cliente || null,
        iniciativa: iniciativa || null,
        filas: [],
      })
      setTitulo('')
      setCliente('')
      setIniciativa('')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  async function eliminar(es: Estimacion): Promise<void> {
    if (!puedeGestionarEstimaciones) {
      setAviso('No tienes permiso para eliminar estimaciones.')
      return
    }
    await client.delete(`/estimaciones/${es.id}`)
    recargar()
  }

  return (
    <div className="space-y-4">
      <EncabezadoPagina
        icono={<Icono nombre="grafico-barras" />}
        titulo="Estimaciones"
        descripcion="Crea la cabecera de una estimación. La carga masiva de filas desde Excel se habilitará con el importador (pendiente)."
      />

      {puedeGestionarEstimaciones && (
        <form onSubmit={crear} className="barra-filtros">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required
              className="campo" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Cliente</span>
            <input value={cliente} onChange={(e) => setCliente(e.target.value)}
              className="campo" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Iniciativa</span>
            <input value={iniciativa} onChange={(e) => setIniciativa(e.target.value)}
              className="campo" />
          </label>
          <Boton variante="primario" type="submit">Crear</Boton>
        </form>
      )}

      {(aviso || error) && (
        <div className="aviso aviso-error">{aviso || error}</div>
      )}

      <TablaScroll>
      <table className="tabla">
        <thead>
          <tr>
            <th>Título</th>
            <th>Cliente</th>
            <th>Iniciativa</th>
            <th className="text-right">Filas</th>
            <th className="text-right">Horas totales</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {datos.map((es) => (
            <tr key={es.id}>
              <td
                className={puedeGestionarEstimaciones ? 'cursor-pointer' : undefined}
                title={puedeGestionarEstimaciones ? 'Doble clic para editar' : undefined}
                onDoubleClick={puedeGestionarEstimaciones ? () => iniciarEdicion(es.id, 'titulo', es.titulo ?? '') : undefined}
              >
                {editCell?.id === es.id && editCell.campo === 'titulo' ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void guardarEdicion(es)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditCell(null)
                        setEditValue('')
                      }
                    }}
                    className="campo campo-sm w-full"
                  />
                ) : (
                  es.titulo ?? '—'
                )}
              </td>
              <td
                className={puedeGestionarEstimaciones ? 'cursor-pointer' : undefined}
                title={puedeGestionarEstimaciones ? 'Doble clic para editar' : undefined}
                onDoubleClick={puedeGestionarEstimaciones ? () => iniciarEdicion(es.id, 'cliente', es.cliente ?? '') : undefined}
              >
                {editCell?.id === es.id && editCell.campo === 'cliente' ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void guardarEdicion(es)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditCell(null)
                        setEditValue('')
                      }
                    }}
                    className="campo campo-sm w-full"
                  />
                ) : (
                  es.cliente ?? '—'
                )}
              </td>
              <td
                className={puedeGestionarEstimaciones ? 'cursor-pointer' : undefined}
                title={puedeGestionarEstimaciones ? 'Doble clic para editar' : undefined}
                onDoubleClick={puedeGestionarEstimaciones ? () => iniciarEdicion(es.id, 'iniciativa', es.iniciativa ?? '') : undefined}
              >
                {editCell?.id === es.id && editCell.campo === 'iniciativa' ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => void guardarEdicion(es)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.currentTarget.blur()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setEditCell(null)
                        setEditValue('')
                      }
                    }}
                    className="campo campo-sm w-full"
                  />
                ) : (
                  es.iniciativa ?? '—'
                )}
              </td>
              <td className="text-right">{es.total_filas}</td>
              <td className="text-right">{es.total_horas}</td>
              <td className="text-center">
                {puedeGestionarEstimaciones && (
                  <button onClick={() => eliminar(es)} className="enlace-accion enlace-accion-peligro">
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
          {datos.length === 0 && (
            <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin estimaciones.</td></tr>
          )}
        </tbody>
      </table>
      </TablaScroll>
    </div>
  )
}
