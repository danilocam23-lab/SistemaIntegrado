// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Aviso, AreaTexto, Boton, Campo, Chip, Selector } from '../../components/ui'
import { AvatarPersona } from '../asignaciones/AvatarPersona'
import { MedidorCarga } from '../asignaciones/MedidorCarga'
import { formatearPct } from '../asignaciones/carga'
import { PanelLateral } from '../asignaciones/PanelLateral'
import { formatearHoras, validarHoras } from './base'
import { contarPlan, etiquetaMes, mesesDelAlcance, planificarAplicacion } from './plan'
import { HORAS_MAX, MESES_LARGO } from './tipos'
import type { AlcanceAplicacion, CapacidadFila, FilaCapacidad, FilaPlanLote } from './tipos'
import type { useEscriturasCapacidades } from './useEscriturasCapacidades'

const ALCANCES: Array<{ valor: AlcanceAplicacion; etiqueta: string }> = [
  { valor: 'mes', etiqueta: 'Solo este mes' },
  { valor: 'siguientes', etiqueta: 'Este mes y siguientes' },
  { valor: 'anio', etiqueta: 'Todo el año' },
]

interface Props {
  /** Persona del panel; `null` = alta nueva sin persona elegida todavía. */
  fila: FilaCapacidad | null
  /** Índice del mes (0 = enero). */
  indice: number
  anio: number
  /** Personas activas elegibles para el selector (alta). */
  personasElegibles: FilaCapacidad[]
  /** Filas visibles en pantalla, para pasar a la persona de arriba/abajo. */
  filasNavegables: FilaCapacidad[]
  horasMesDefault: number
  /** Mes en curso (`YYYY-MM`) para avisar al editar un mes pasado. */
  mesActual: string
  escrituras: ReturnType<typeof useEscriturasCapacidades>
  onNavegar: (personaId: string, indice: number) => void
  onCerrar: () => void
  onEliminar: (registro: CapacidadFila, descripcion: string) => void
}

/**
 * Panel lateral "Editar capacidad" (hoja inferior en móvil). Reemplaza al modal
 * "Nueva capacidad" y se abre también desde una celda (Mayús + clic, o clic en un
 * mes pasado o vacío). Campos: persona, mes, horas (con atajos), alcance
 * ("Aplicar a"), notas y la carga vigente de Asignaciones. Se monta con `key`
 * por persona y mes: al navegar, el formulario se reinicia.
 */
export function PanelCapacidad({
  fila, indice, anio, personasElegibles, filasNavegables, horasMesDefault, mesActual,
  escrituras, onNavegar, onCerrar, onEliminar,
}: Props) {
  const celda = fila ? fila.celdas[indice] : null
  const registro = celda?.registro ?? null
  const base = celda?.base ?? 0

  const [texto, setTexto] = useState(registro ? String(registro.horas_disponibles) : String(base))
  const [notas, setNotas] = useState(registro?.notas ?? '')
  const [alcance, setAlcance] = useState<AlcanceAplicacion>('mes')
  const [error, setError] = useState('')
  const [erroresLote, setErroresLote] = useState<string[]>([])

  const validado = validarHoras(texto)
  const horasValidas = 'horas' in validado ? validado.horas : null
  const mesPasado = !!celda && celda.mes < mesActual
  const notasCambiaron = notas.trim() !== (registro?.notas ?? '').trim()

  const plan = useMemo<FilaPlanLote[]>(
    () => (fila && horasValidas !== null && alcance !== 'mes'
      ? planificarAplicacion(fila, indice, alcance, horasValidas)
      : []),
    [fila, indice, alcance, horasValidas],
  )
  const conteo = contarPlan(plan)
  const mesesPasadosEnAlcance = fila
    ? mesesDelAlcance(indice, alcance).filter((i) => fila.celdas[i].mes < mesActual).length
    : 0

  const capacidadEfectiva = horasValidas ?? celda?.horas ?? base
  const pctCarga = fila?.carga?.pct ?? null
  const horasAsignadas = pctCarga !== null ? Math.round((capacidadEfectiva * pctCarga) / 100) : 0
  const quedan = Math.round(capacidadEfectiva - horasAsignadas)

  function irA(personaId: string, nuevoIndice: number) {
    if (nuevoIndice < 0 || nuevoIndice > 11) return
    onNavegar(personaId, nuevoIndice)
  }

  function alTeclear(e: KeyboardEvent) {
    if (!e.altKey || !fila) return
    const posicion = filasNavegables.findIndex((f) => f.persona.id === fila.persona.id)
    if (e.key === 'ArrowLeft') irA(fila.persona.id, indice - 1)
    else if (e.key === 'ArrowRight') irA(fila.persona.id, indice + 1)
    else if (e.key === 'ArrowUp' && posicion > 0) irA(filasNavegables[posicion - 1].persona.id, indice)
    else if (e.key === 'ArrowDown' && posicion >= 0 && posicion < filasNavegables.length - 1) {
      irA(filasNavegables[posicion + 1].persona.id, indice)
    } else return
    e.preventDefault()
  }

  async function guardar(e?: FormEvent) {
    e?.preventDefault()
    if (!fila || !celda || escrituras.guardando) return
    setError('')
    setErroresLote([])
    const v = validarHoras(texto)
    if ('error' in v) {
      setError(v.error)
      return
    }
    const nota = notasCambiaron ? notas.trim() : undefined

    if (alcance === 'mes') {
      if (registro && v.horas === Number(registro.horas_disponibles) && !notasCambiaron) {
        onCerrar() // nada cambió: no se envía nada
        return
      }
      const mensaje = await escrituras.guardarRegistro({
        registro, personaId: fila.persona.id, mes: celda.mes, horas: v.horas, notas: nota,
      })
      if (mensaje) setError(mensaje)
      else onCerrar()
      return
    }

    // Varios meses: el mes editado va por su cuenta si cambió la nota (el lote no la lleva).
    const errores: string[] = []
    let planLote = plan
    if (notasCambiaron) {
      const mensaje = await escrituras.guardarRegistro({
        registro, personaId: fila.persona.id, mes: celda.mes, horas: v.horas, notas: nota,
      })
      if (mensaje) errores.push(`${etiquetaMes(celda.mes)}: ${mensaje}`)
      planLote = plan.map((p) => (p.mes === celda.mes ? { ...p, accion: 'omitir' as const } : p))
    }
    const resultado = await escrituras.aplicarLote(planLote)
    errores.push(...resultado.errores)
    if (errores.length > 0) setErroresLote(errores)
    else onCerrar()
  }

  async function conservar(elegido: CapacidadFila) {
    if (!celda) return
    setError('')
    const otros = celda.duplicados.filter((d) => d.id !== elegido.id)
    const mensaje = await escrituras.eliminarDuplicados(otros)
    if (mensaje) setError(mensaje)
    else setTexto(String(elegido.horas_disponibles))
  }

  const titulo = fila && celda
    ? `${fila.persona.nombre} · ${MESES_LARGO[indice]} ${anio}`
    : 'Nueva capacidad'

  const pie = fila ? (
    <>
      <Boton variante="primario" onClick={() => void guardar()} disabled={escrituras.guardando}>
        {escrituras.guardando ? 'Guardando…' : 'Guardar'}
      </Boton>
      <Boton onClick={onCerrar} disabled={escrituras.guardando}>Cancelar</Boton>
      {registro && (
        <Boton
          variante="peligro-suave"
          className="ml-auto"
          disabled={escrituras.guardando}
          onClick={() => {
            onEliminar(registro, `${fila.persona.nombre} · ${etiquetaMes(registro.mes)}`)
            onCerrar()
          }}
        >
          Eliminar registro
        </Boton>
      )}
      <p className="w-full text-[11px] text-slate-500">
        Enter guarda · Esc cancela · Alt + ← → cambia de mes · Alt + ↑ ↓ cambia de persona
      </p>
    </>
  ) : undefined

  return (
    <PanelLateral abierto titulo={titulo} onCerrar={onCerrar} pie={pie}>
      <form onSubmit={(e) => void guardar(e)} onKeyDown={alTeclear} className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Selector
            etiqueta="Persona"
            value={fila?.persona.id ?? ''}
            onChange={(e) => e.target.value && onNavegar(e.target.value, indice)}
            disabled={escrituras.guardando}
          >
            <option value="">— Seleccionar —</option>
            {personasElegibles.map((f) => (
              <option key={f.persona.id} value={f.persona.id}>{f.persona.nombre}</option>
            ))}
          </Selector>
          <Selector
            etiqueta="Mes"
            value={indice}
            onChange={(e) => irA(fila?.persona.id ?? '', Number(e.target.value))}
            disabled={escrituras.guardando || !fila}
          >
            {MESES_LARGO.map((m, i) => <option key={m} value={i}>{m} {anio}</option>)}
          </Selector>
        </div>

        {!fila && (
          <Aviso tono="info">Elige una persona para registrar su capacidad. El valor inicial es la base sugerida del mes.</Aviso>
        )}

        {fila && celda && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <AvatarPersona nombre={fila.persona.nombre} pequeno />
              <Chip>{fila.persona.rol_operativo}</Chip>
              {fila.persona.squads?.map((s) => <Chip key={s} tono="marca">{s}</Chip>)}
              <span className="text-xs text-slate-500">base sugerida {base} h</span>
            </div>

            {mesPasado && (
              <Aviso tono="alerta">
                Estás editando un mes pasado ({etiquetaMes(celda.mes)}). Se guarda solo al pulsar Guardar.
              </Aviso>
            )}

            {celda.duplicados.length > 1 && (
              <Aviso tono="alerta">
                <p className="mb-2 font-semibold">
                  Hay {celda.duplicados.length} registros para esta persona y mes. La matriz muestra el último.
                  Elige cuál conservar (se eliminan los demás):
                </p>
                <ul className="grid gap-1">
                  {celda.duplicados.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span>
                        {formatearHoras(Number(d.horas_disponibles))} h
                        {d.notas ? ` · ${d.notas}` : ''}
                        {d.id === registro?.id ? ' (el que se ve)' : ''}
                      </span>
                      <Boton tamano="sm" disabled={escrituras.guardando} onClick={() => void conservar(d)}>
                        Conservar este
                      </Boton>
                    </li>
                  ))}
                </ul>
              </Aviso>
            )}

            <div>
              <Campo
                etiqueta="Horas disponibles"
                ayuda={`Entre 0 y ${HORAS_MAX} h.`}
                type="number"
                inputMode="decimal"
                min={0}
                max={HORAS_MAX}
                step="any"
                autoFocus
                value={texto}
                onChange={(e) => { setTexto(e.target.value); setError('') }}
                aria-invalid={error ? true : undefined}
                disabled={escrituras.guardando}
                className="w-40"
              />
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Atajos de horas">
                {[
                  { etiqueta: 'Base sugerida', valor: base },
                  { etiqueta: 'Horas del mes', valor: horasMesDefault },
                  { etiqueta: '½ mes', valor: Math.round(base / 2) },
                  { etiqueta: 'Sin disponibilidad', valor: 0 },
                ].map((atajo) => (
                  <Boton
                    key={atajo.etiqueta}
                    tamano="sm"
                    variante={horasValidas === atajo.valor ? 'suave' : 'secundario'}
                    aria-pressed={horasValidas === atajo.valor}
                    disabled={escrituras.guardando}
                    onClick={() => { setTexto(String(atajo.valor)); setError('') }}
                  >
                    {atajo.etiqueta} · {formatearHoras(atajo.valor)}
                  </Boton>
                ))}
              </div>
            </div>

            <div>
              <span className="etiqueta">Aplicar a</span>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Aplicar a">
                {ALCANCES.map((a) => (
                  <Boton
                    key={a.valor}
                    tamano="sm"
                    variante={alcance === a.valor ? 'primario' : 'secundario'}
                    aria-pressed={alcance === a.valor}
                    disabled={escrituras.guardando}
                    onClick={() => setAlcance(a.valor)}
                  >
                    {a.etiqueta}
                  </Boton>
                ))}
              </div>
              {alcance !== 'mes' && (
                <p className="mt-2 text-xs text-slate-600" role="status">
                  {horasValidas === null
                    ? 'Escribe unas horas válidas para ver qué se aplicará.'
                    : `${plan.length} meses: ${conteo.crear} se crean, ${conteo.actualizar} se actualizan, ${conteo.omitir} sin cambios.`}
                  {mesesPasadosEnAlcance > 0 && ` Incluye ${mesesPasadosEnAlcance} mes(es) pasado(s).`}
                  {notasCambiaron && ' La nota se guarda solo en el mes editado.'}
                </p>
              )}
            </div>

            {fila.carga && pctCarga !== null && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                  Carga asignada hoy · de Asignaciones
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatearPct(pctCarga)} % · {horasAsignadas} h de {formatearHoras(capacidadEfectiva)} h
                  <span className="ml-2 font-normal text-slate-500">
                    {quedan >= 0 ? `quedan ${quedan} h` : `exceden ${-quedan} h`}
                  </span>
                </p>
                <MedidorCarga activa={pctCarga} tamano="md" etiqueta={fila.persona.nombre} className="mt-2" />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Es la carga vigente, no un histórico: en meses pasados solo es referencia.
                </p>
              </div>
            )}

            <AreaTexto
              etiqueta="Notas"
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej.: vacaciones 12–16 oct (ya descontadas)"
              disabled={escrituras.guardando}
            />
          </>
        )}

        {error && <div role="alert"><Aviso tono="error">{error}</Aviso></div>}
        {erroresLote.length > 0 && (
          <div role="alert">
            <Aviso tono="error">
              <p className="font-semibold">Algunos cambios no se guardaron:</p>
              <ul className="mt-1 list-disc pl-5">
                {erroresLote.slice(0, 5).map((m) => <li key={m}>{m}</li>)}
              </ul>
            </Aviso>
          </div>
        )}
      </form>
    </PanelLateral>
  )
}
