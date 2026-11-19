// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { EntregasActasCampo } from '../../constantes'
import { leerCamposActivos } from '../../constantes'
import type { Configuracion as Config } from '../../types'
import { leerOrdenColumnas, moverColumnaVisible } from '../../utils/ordenColumnas'

interface ConfigClaves {
  columnas: string
  ordenColumnas: string
  filtros: string
  exportCampos: string
}

interface Params {
  datos: Config[]
  recargar: () => void
  configClaves: ConfigClaves
  columnasCatalogo: EntregasActasCampo[]
  filtrosCatalogo: EntregasActasCampo[]
  grupo: string
  cargando?: boolean
  bloqueoGuardado?: MutableRefObject<boolean>
}

export function useCamposConfigurables({
  datos,
  recargar,
  configClaves,
  columnasCatalogo,
  filtrosCatalogo,
  grupo,
  cargando = false,
  bloqueoGuardado,
}: Params) {
  const bloqueoLocal = useRef(false)
  const bloqueo = bloqueoGuardado ?? bloqueoLocal
  const confirmadas = useRef(new Map<string, string>())
  const [guardando, setGuardando] = useState(false)
  const [columnas, setColumnas] = useState<Set<string>>(new Set(columnasCatalogo.map((c) => c.key)))
  const [filtros, setFiltros] = useState<Set<string>>(new Set(filtrosCatalogo.map((f) => f.key)))
  const [exportCampos, setExportCampos] = useState<Set<string>>(new Set(columnasCatalogo.map((c) => c.key)))
  const [aviso, setAviso] = useState('')
  const [ok, setOk] = useState('')
  const [ordenColumnas, setOrdenColumnas] = useState(() => columnasCatalogo.map((columna) => columna.key))
  // INVARIANTE 5: Campos configurables usa aviso propio y no toca el aviso compartido del shell.

  useEffect(() => {
    if (bloqueo.current) return
    // Un GET que empezó antes del PUT puede terminar después. Conservar lo confirmado
    // hasta que una lectura lo reconozca, sin escribir defaults durante la carga.
    for (const [clave, valor] of confirmadas.current) {
      if (datos.find((dato) => dato.clave === clave)?.valor === valor) confirmadas.current.delete(clave)
    }
    const vigentes = [
      ...datos.filter((dato) => !confirmadas.current.has(dato.clave)),
      ...Array.from(confirmadas.current, ([clave, valor]) => ({ clave, valor })),
    ]
    // INVARIANTE 3: recargar() reinicia estado derivado de otras pestanas; se conserva.
    setColumnas(leerCamposActivos(vigentes, configClaves.columnas, columnasCatalogo))
    setFiltros(leerCamposActivos(vigentes, configClaves.filtros, filtrosCatalogo))
    setExportCampos(leerCamposActivos(vigentes, configClaves.exportCampos, columnasCatalogo))
    setOrdenColumnas(leerOrdenColumnas(vigentes, configClaves.ordenColumnas, columnasCatalogo))
  }, [datos, configClaves, columnasCatalogo, filtrosCatalogo, bloqueo])

  async function guardarCampos(clave: string, keys: string[], aplicar: () => void): Promise<void> {
    if (bloqueo.current || cargando) return
    bloqueo.current = true
    setGuardando(true)
    setAviso('')
    setOk('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/configuracion/${encodeURIComponent(clave)}`, {
        valor: JSON.stringify(keys),
        grupo,
      })
      confirmadas.current.set(clave, JSON.stringify(keys))
      aplicar()
      setOk('Configuración guardada.')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      bloqueo.current = false
      setGuardando(false)
    }
  }

  function alternar(
    clave: string,
    key: string,
    actuales: Set<string>,
    catalogo: EntregasActasCampo[],
    aplicar: (valor: Set<string>) => void,
  ): void {
    const nuevas = new Set(actuales)
    if (nuevas.has(key)) nuevas.delete(key)
    else nuevas.add(key)
    const keys = Array.from(nuevas)
    // Sin estado optimista: un PUT fallido no se presenta como un cambio guardado.
    void guardarCampos(clave, keys, () => aplicar(leerCamposActivos(
      [{ clave, valor: JSON.stringify(keys) }], clave, catalogo,
    )))
  }

  function alternarColumna(key: string): void {
    alternar(configClaves.columnas, key, columnas, columnasCatalogo, setColumnas)
  }

  function alternarFiltro(key: string): void {
    alternar(configClaves.filtros, key, filtros, filtrosCatalogo, setFiltros)
  }

  function alternarExport(key: string): void {
    alternar(configClaves.exportCampos, key, exportCampos, columnasCatalogo, setExportCampos)
  }

  function cambiarPosicion(key: string, posicion: number): void {
    if (bloqueo.current || cargando) return
    try {
      const nuevoOrden = moverColumnaVisible(ordenColumnas, columnas, key, posicion)
      if (nuevoOrden.every((clave, indice) => clave === ordenColumnas[indice])) return
      void guardarCampos(configClaves.ordenColumnas, nuevoOrden, () => setOrdenColumnas(nuevoOrden))
    } catch (err) {
      setOk('')
      setAviso(err instanceof Error ? err.message : 'Posición no válida.')
    }
  }

  return {
    columnas,
    filtros,
    exportCampos,
    aviso,
    ok,
    guardando,
    ordenColumnas,
    cambiarPosicion,
    alternarColumna,
    alternarFiltro,
    alternarExport,
  }
}

export type CamposConfigurablesState = ReturnType<typeof useCamposConfigurables>
