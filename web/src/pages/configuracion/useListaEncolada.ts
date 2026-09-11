import { useEffect, useRef, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'

interface Params {
  endpoint: string
  clave: string
  grupo: string
  mensajeOk: string
  recargar: () => void
  setAviso: (aviso: string) => void
  setOk: (ok: string) => void
}

export function useListaEncolada({ endpoint, clave, grupo, mensajeOk, recargar, setAviso, setOk }: Params) {
  const [items, setItems] = useState<string[]>([])
  const [nuevo, setNuevo] = useState('')
  const itemsRef = useRef<string[]>([])
  const colaRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    client.get<string[]>(endpoint).then((r) => {
      itemsRef.current = r.data
      setItems(r.data)
    }).catch(() => {})
  }, [endpoint])

  async function guardarLista(lista: string[]): Promise<void> {
    setAviso('')
    setOk('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/configuracion/${clave}`, {
        valor: lista.join(','),
        grupo,
      })
      itemsRef.current = lista
      setItems(lista)
      setOk(mensajeOk)
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  // INVARIANTE 6: encola las operaciones para evitar condiciones de carrera; cada cambio
  // parte siempre de la ultima lista confirmada por el servidor (itemsRef),
  // nunca de un estado local potencialmente desactualizado.
  function encolar(calcular: (actual: string[]) => string[]): void {
    colaRef.current = colaRef.current.then(() => guardarLista(calcular(itemsRef.current)))
  }

  function agregar(): void {
    const item = nuevo.trim().toUpperCase()
    if (!item) return
    setNuevo('')
    encolar((actual) => (actual.includes(item) ? actual : [...actual, item]))
  }

  function quitar(item: string): void {
    encolar((actual) => actual.filter((actualItem) => actualItem !== item))
  }

  return {
    items,
    nuevo,
    setNuevo,
    agregar,
    quitar,
  }
}

export type ListaEncoladaState = ReturnType<typeof useListaEncolada>
