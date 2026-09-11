import { useEffect, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { EntregasActasCampo } from '../../constantes'
import { leerCamposActivos } from '../../constantes'
import type { Configuracion as Config } from '../../types'

interface ConfigClaves {
  columnas: string
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
}

export function useCamposConfigurables({
  datos,
  recargar,
  configClaves,
  columnasCatalogo,
  filtrosCatalogo,
  grupo,
}: Params) {
  const [columnas, setColumnas] = useState<Set<string>>(new Set(columnasCatalogo.map((c) => c.key)))
  const [filtros, setFiltros] = useState<Set<string>>(new Set(filtrosCatalogo.map((f) => f.key)))
  const [exportCampos, setExportCampos] = useState<Set<string>>(new Set(columnasCatalogo.map((c) => c.key)))
  const [aviso, setAviso] = useState('')
  const [ok, setOk] = useState('')
  // INVARIANTE 5: Campos configurables usa aviso propio y no toca el aviso compartido del shell.

  useEffect(() => {
    // INVARIANTE 3: recargar() reinicia estado derivado de otras pestanas; se conserva.
    setColumnas(leerCamposActivos(datos, configClaves.columnas, columnasCatalogo))
    setFiltros(leerCamposActivos(datos, configClaves.filtros, filtrosCatalogo))
    setExportCampos(leerCamposActivos(datos, configClaves.exportCampos, columnasCatalogo))
  }, [datos, configClaves, columnasCatalogo, filtrosCatalogo])

  async function guardarCampos(clave: string, keys: string[]): Promise<void> {
    setAviso('')
    setOk('')
    try {
      // INVARIANTE 15: configuracion global; no introducir cabecerasAplicacion.
      await client.put(`/configuracion/${encodeURIComponent(clave)}`, {
        valor: JSON.stringify(keys),
        grupo,
      })
      setOk('Configuración guardada.')
      recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  function alternarColumna(key: string): void {
    const nueva = new Set(columnas)
    if (nueva.has(key)) nueva.delete(key)
    else nueva.add(key)
    // INVARIANTE 8: PUT inmediato optimista, sin debounce ni rollback; Array.from(nueva) antes del setState.
    const keys = Array.from(nueva)
    setColumnas(nueva)
    void guardarCampos(configClaves.columnas, keys)
  }

  function alternarFiltro(key: string): void {
    const nueva = new Set(filtros)
    if (nueva.has(key)) nueva.delete(key)
    else nueva.add(key)
    // INVARIANTE 8: PUT inmediato optimista, sin debounce ni rollback; Array.from(nueva) antes del setState.
    const keys = Array.from(nueva)
    setFiltros(nueva)
    void guardarCampos(configClaves.filtros, keys)
  }

  function alternarExport(key: string): void {
    const nueva = new Set(exportCampos)
    if (nueva.has(key)) nueva.delete(key)
    else nueva.add(key)
    // INVARIANTE 8: PUT inmediato optimista, sin debounce ni rollback; Array.from(nueva) antes del setState.
    const keys = Array.from(nueva)
    setExportCampos(nueva)
    void guardarCampos(configClaves.exportCampos, keys)
  }

  return {
    columnas,
    filtros,
    exportCampos,
    aviso,
    ok,
    alternarColumna,
    alternarFiltro,
    alternarExport,
  }
}

export type CamposConfigurablesState = ReturnType<typeof useCamposConfigurables>
