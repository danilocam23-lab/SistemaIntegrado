import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import client from '../../api/client'
import { mensajeError, useLista } from '../../api/hooks'
import type { Categoria } from '../../types'

export function useCategorias() {
  const { datos: categorias, recargar: recargarCategorias } = useLista<Categoria>('/categorias')
  const [cNombre, setCNombre] = useState('')
  const [cColor, setCColor] = useState('#6366f1')
  const [cAviso, setCAviso] = useState('')
  const [cEditCell, setCEditCell] = useState<{ id: string; campo: string } | null>(null)
  const [cEditValue, setCEditValue] = useState('')
  const cCancelarBlur = useRef(false)
  // INVARIANTE 5: Categorias usa aviso propio y no toca el aviso compartido del shell.

  function cIniciarEdicion(id: string, campo: string, valor: string) {
    setCEditCell({ id, campo }); setCEditValue(valor); cCancelarBlur.current = false
  }
  function cCancelarEdicion() {
    cCancelarBlur.current = true; setCEditCell(null); setCEditValue('')
  }
  async function cGuardarEdicion(cat: Categoria): Promise<void> {
    if (!cEditCell) return
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/categorias/${cat.id}`, {
        nombre: cat.nombre, color: cat.color, orden: cat.orden,
        [cEditCell.campo]: cEditCell.campo === 'orden' ? Number(cEditValue) : cEditValue,
      })
      setCEditCell(null); setCEditValue(''); recargarCategorias()
    } catch (err) { setCAviso(mensajeError(err)) }
  }
  async function cCrear(e: FormEvent): Promise<void> {
    e.preventDefault(); setCAviso('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.post('/categorias', { nombre: cNombre, color: cColor, orden: categorias.length + 1 })
      setCNombre(''); recargarCategorias()
    } catch (err) { setCAviso(mensajeError(err)) }
  }
  async function cEliminar(cat: Categoria): Promise<void> {
    setCAviso('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.delete(`/categorias/${cat.id}`)
      recargarCategorias()
    } catch (err) { setCAviso(mensajeError(err)) }
  }

  return {
    categorias,
    cNombre,
    setCNombre,
    cColor,
    setCColor,
    cAviso,
    cEditCell,
    cEditValue,
    setCEditValue,
    cCancelarBlur,
    cIniciarEdicion,
    cCancelarEdicion,
    cGuardarEdicion,
    cCrear,
    cEliminar,
  }
}

export type CategoriasState = ReturnType<typeof useCategorias>
