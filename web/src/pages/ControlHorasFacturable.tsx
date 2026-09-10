import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { mensajeError, useLista } from '../api/hooks'
import { Boton, Chip, EncabezadoPagina, Icono, TablaScroll } from '../components/ui'
import type { Festivo, Persona } from '../types'

interface Fila {
  key: string
  personaId: string
  nombre: string
  rol: string
  squad: string
  tipoContratacion: string
  opcionesLt: string[]
}

interface ControlHorasGuardado {
  persona_id: string
  squad: string
  lt_hitss: string
  horas_soporte: number
  horas_desarrollo: number
  horas_soporte_cerrado: number
  horas_desarrollo_cerrado: number
  horas_vacaciones: number
  horas_incapacidades: number
  horas_licencias: number
  horas_permisos: number
  otras_novedades: number
  horas_errores_analista: number
  horas_garantias: number
  horas_reprocesos: number
  otras_novedades_calidad: number
  observaciones: string
}

const _MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const ROL_TONO: Record<string, 'neutro' | 'marca' | 'exito'> = {
  LT_HITSS: 'marca',
  SCRUM: 'neutro',
  DEV: 'exito',
}

/** Calcula las horas hábiles del mes: lunes a jueves 8.5h, viernes 8h, excluyendo festivos. */
function calcularHorasMeta(anio: number, mes: number, festivos: Festivo[]): number {
  const festivosSet = new Set(
    festivos.map((f) => (f.fecha ?? '').slice(0, 10)),
  )
  const diasEnMes = new Date(anio, mes, 0).getDate()
  let horas = 0
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = new Date(anio, mes - 1, dia)
    const diaSemana = fecha.getDay() // 0=domingo, 1=lunes ... 6=sábado
    if (diaSemana === 0 || diaSemana === 6) continue // fin de semana
    const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    if (festivosSet.has(iso)) continue // festivo
    horas += diaSemana === 5 ? 8 : 8.5 // viernes=8, lunes-jueves=8.5
  }
  return horas
}

export default function ControlHorasFacturable() {
  const { datos: personas, cargando } = useLista<Persona>('/personas')
  const { datos: festivos } = useLista<Festivo>('/festivos')
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionLt, setSeleccionLt] = useState<Record<string, string>>({})
  const [eliminadas, setEliminadas] = useState<Set<string>>(new Set())
  const [horasSoporte, setHorasSoporte] = useState<Record<string, number>>({})
  const [horasDesarrollo, setHorasDesarrollo] = useState<Record<string, number>>({})
  const [horasSopCerrado, setHorasSopCerrado] = useState<Record<string, number>>({})
  const [horasDesCerrado, setHorasDesCerrado] = useState<Record<string, number>>({})
  const [horasVac, setHorasVac] = useState<Record<string, number>>({})
  const [horasInc, setHorasInc] = useState<Record<string, number>>({})
  const [horasLic, setHorasLic] = useState<Record<string, number>>({})
  const [horasPerm, setHorasPerm] = useState<Record<string, number>>({})
  const [otrasNov, setOtrasNov] = useState<Record<string, number>>({})
  const [horasErr, setHorasErr] = useState<Record<string, number>>({})
  const [horasGar, setHorasGar] = useState<Record<string, number>>({})
  const [horasRep, setHorasRep] = useState<Record<string, number>>({})
  const [otrasNovCal, setOtrasNovCal] = useState<Record<string, number>>({})
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [keysConDatos, setKeysConDatos] = useState<Set<string>>(new Set())
  const [guardandoFila, setGuardandoFila] = useState<Set<string>>(new Set())
  const [guardandoTodos, setGuardandoTodos] = useState(false)
  const [aviso, setAviso] = useState('')
  const [avisoOk, setAvisoOk] = useState('')

  // Cargar datos guardados para el período seleccionado
  useEffect(() => {
    if (!personas.length) return
    // Limpiar estado al cambiar período
    setSeleccionLt({})
    setHorasSoporte({})
    setHorasDesarrollo({})
    setHorasSopCerrado({})
    setHorasDesCerrado({})
    setHorasVac({})
    setHorasInc({})
    setHorasLic({})
    setHorasPerm({})
    setOtrasNov({})
    setHorasErr({})
    setHorasGar({})
    setHorasRep({})
    setOtrasNovCal({})
    setObservaciones({})
    setKeysConDatos(new Set())
    client.get<ControlHorasGuardado[]>('/control-horas', { params: { anio, mes } })
      .then(({ data }) => {
        const lt: Record<string, string> = {}
        const hs: Record<string, number> = {}
        const hd: Record<string, number> = {}
        const hsc: Record<string, number> = {}
        const hdc: Record<string, number> = {}
        const hv: Record<string, number> = {}
        const hi: Record<string, number> = {}
        const hl: Record<string, number> = {}
        const hp: Record<string, number> = {}
        const on: Record<string, number> = {}
        const he: Record<string, number> = {}
        const hg: Record<string, number> = {}
        const hr: Record<string, number> = {}
        const onc: Record<string, number> = {}
        const obs: Record<string, string> = {}
        const keys = new Set<string>()
        for (const r of data) {
          const k = `${r.persona_id}_${r.squad}`
          keys.add(k)
          if (r.lt_hitss) lt[k] = r.lt_hitss
          if (r.horas_soporte) hs[k] = r.horas_soporte
          if (r.horas_desarrollo) hd[k] = r.horas_desarrollo
          if (r.horas_soporte_cerrado) hsc[k] = r.horas_soporte_cerrado
          if (r.horas_desarrollo_cerrado) hdc[k] = r.horas_desarrollo_cerrado
          if (r.horas_vacaciones) hv[k] = r.horas_vacaciones
          if (r.horas_incapacidades) hi[k] = r.horas_incapacidades
          if (r.horas_licencias) hl[k] = r.horas_licencias
          if (r.horas_permisos) hp[k] = r.horas_permisos
          if (r.otras_novedades) on[k] = r.otras_novedades
          if (r.horas_errores_analista) he[k] = r.horas_errores_analista
          if (r.horas_garantias) hg[k] = r.horas_garantias
          if (r.horas_reprocesos) hr[k] = r.horas_reprocesos
          if (r.otras_novedades_calidad) onc[k] = r.otras_novedades_calidad
          if (r.observaciones) obs[k] = r.observaciones
        }
        setSeleccionLt((prev) => ({ ...prev, ...lt }))
        setHorasSoporte((prev) => ({ ...prev, ...hs }))
        setHorasDesarrollo((prev) => ({ ...prev, ...hd }))
        setHorasSopCerrado((prev) => ({ ...prev, ...hsc }))
        setHorasDesCerrado((prev) => ({ ...prev, ...hdc }))
        setHorasVac((prev) => ({ ...prev, ...hv }))
        setHorasInc((prev) => ({ ...prev, ...hi }))
        setHorasLic((prev) => ({ ...prev, ...hl }))
        setHorasPerm((prev) => ({ ...prev, ...hp }))
        setOtrasNov((prev) => ({ ...prev, ...on }))
        setHorasErr((prev) => ({ ...prev, ...he }))
        setHorasGar((prev) => ({ ...prev, ...hg }))
        setHorasRep((prev) => ({ ...prev, ...hr }))
        setOtrasNovCal((prev) => ({ ...prev, ...onc }))
        setObservaciones((prev) => ({ ...prev, ...obs }))
        setKeysConDatos(keys)
      })
      .catch(() => {})
  }, [personas, anio, mes])

  // Todos los LT_HITSS activos
  const ltHitssPersonas = useMemo(
    () => personas.filter((p) => p.rol_operativo === 'LT_HITSS' && p.activo),
    [personas],
  )

  // Mapa squad → lista de nombres de LT_HITSS de ese squad
  const ltHitssPorSquad = useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const p of ltHitssPersonas) {
      for (const sq of p.squads) {
        if (!mapa.has(sq)) mapa.set(sq, [])
        const lista = mapa.get(sq)!
        if (!lista.includes(p.nombre)) lista.push(p.nombre)
      }
    }
    return mapa
  }, [ltHitssPersonas])

  // Una fila por squad (duplica personas con 2+ squads)
  const filasBase = useMemo<Fila[]>(() => {
    const resultado: Fila[] = []
    for (const p of personas) {
      if (p.rol_operativo === 'LT_EPM') continue
      // Inactivos: solo mostrar si tienen datos guardados en este período
      const esInactivo = !p.activo
      const squads = p.squads.length > 0 ? p.squads : ['—']
      for (const sq of squads) {
        const key = `${p.id}_${sq}`
        if (esInactivo && !keysConDatos.has(key)) continue
        const opciones = (ltHitssPorSquad.get(sq) ?? []).sort((a, b) => a.localeCompare(b, 'es'))
        resultado.push({
          key: `${p.id}_${sq}`,
          personaId: p.id,
          nombre: p.nombre,
          rol: p.rol_operativo,
          squad: sq,
          tipoContratacion: p.tipo_contratacion ?? '—',
          opcionesLt: opciones,
        })
      }
    }
    return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [personas, ltHitssPorSquad, keysConDatos])

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filasBase
      .filter((f) => !eliminadas.has(f.key))
      .filter((f) => !q || f.nombre.toLowerCase().includes(q) || f.squad.toLowerCase().includes(q))
  }, [filasBase, eliminadas, busqueda])

  // Meta de horas facturables del período: días hábiles del mes (lun-jue 8.5h, vie 8h), sin festivos
  const horasMeta = useMemo(() => calcularHorasMeta(anio, mes, festivos), [anio, mes, festivos])

  function ltSeleccionado(fila: Fila): string {
    return seleccionLt[fila.key] ?? fila.opcionesLt[0] ?? '—'
  }

  function cambiarLt(key: string, valor: string) {
    setSeleccionLt((prev) => ({ ...prev, [key]: valor }))
  }

  function jalarAbajo(desdeIndex: number) {
    const fila = filas[desdeIndex]
    if (!fila) return
    const valor = ltSeleccionado(fila)
    if (valor === '—') return
    setSeleccionLt((prev) => {
      const siguiente = { ...prev }
      for (let i = desdeIndex + 1; i < filas.length; i++) {
        siguiente[filas[i].key] = valor
      }
      return siguiente
    })
  }

  function eliminarFila(key: string) {
    setEliminadas((prev) => new Set(prev).add(key))
  }

  function restaurarTodo() {
    setEliminadas(new Set())
  }

  function datosParaGuardar(fila: Fila) {
    return {
      persona_id: fila.personaId,
      squad: fila.squad,
      lt_hitss: ltSeleccionado(fila),
      horas_soporte: horasSoporte[fila.key] ?? 0,
      horas_desarrollo: horasDesarrollo[fila.key] ?? 0,
      horas_soporte_cerrado: horasSopCerrado[fila.key] ?? 0,
      horas_desarrollo_cerrado: horasDesCerrado[fila.key] ?? 0,
      horas_vacaciones: horasVac[fila.key] ?? 0,
      horas_incapacidades: horasInc[fila.key] ?? 0,
      horas_licencias: horasLic[fila.key] ?? 0,
      horas_permisos: horasPerm[fila.key] ?? 0,
      otras_novedades: otrasNov[fila.key] ?? 0,
      horas_errores_analista: horasErr[fila.key] ?? 0,
      horas_garantias: horasGar[fila.key] ?? 0,
      horas_reprocesos: horasRep[fila.key] ?? 0,
      otras_novedades_calidad: otrasNovCal[fila.key] ?? 0,
      observaciones: observaciones[fila.key] ?? '',
    }
  }

  async function guardarUno(fila: Fila) {
    setGuardandoFila((prev) => new Set(prev).add(fila.key))
    setAviso('')
    setAvisoOk('')
    try {
      await client.put('/control-horas/registro', datosParaGuardar(fila), { params: { anio, mes } })
      setAvisoOk(`Guardado: ${fila.nombre} — ${fila.squad}`)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setGuardandoFila((prev) => { const n = new Set(prev); n.delete(fila.key); return n })
    }
  }

  async function guardarTodos() {
    setGuardandoTodos(true)
    setAviso('')
    setAvisoOk('')
    try {
      const registros = filas.map(datosParaGuardar)
      const { data } = await client.put<{ guardados: number }>('/control-horas/todos', { registros }, { params: { anio, mes } })
      setAvisoOk(`${data.guardados} registros guardados correctamente`)
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setGuardandoTodos(false)
    }
  }

  // Todos los LT_HITSS únicos para el selector global
  const todosLtNombres = useMemo(
    () => ltHitssPersonas.map((p) => p.nombre).sort((a, b) => a.localeCompare(b, 'es')),
    [ltHitssPersonas],
  )

  function aplicarATodos(valor: string) {
    setSeleccionLt((prev) => {
      const siguiente = { ...prev }
      for (const f of filas) {
        siguiente[f.key] = valor
      }
      return siguiente
    })
  }

  return (
    <div className="space-y-4">
      <EncabezadoPagina
        icono={<Icono nombre="facturacion" />}
        titulo="Control de Horas Facturable"
        descripcion="Listado de personas con su líder técnico HITSS. Use el selector o el botón ↓ para aplicar en bloque."
      />

      <div className="barra-filtros">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Año</span>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
            className="campo">
            {Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - 2 + i).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Mes</span>
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
            className="campo">
            {_MESES.map((n, i) => (
              <option key={i + 1} value={i + 1}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Buscar persona o squad</span>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="campo w-64"
          />
        </label>
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="enlace-accion enlace-accion-peligro text-xs self-end pb-2">
            Limpiar
          </button>
        )}

        {/* Aplicar LT_HITSS a todos */}
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Aplicar LT HITSS a todos</span>
          <select
            onChange={(e) => { if (e.target.value) aplicarATodos(e.target.value); e.target.value = '' }}
            defaultValue=""
            className="campo"
          >
            <option value="" disabled>Seleccionar…</option>
            {todosLtNombres.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-xs text-slate-400 self-end pb-2">
          {filas.length} registros
          {eliminadas.size > 0 && (
            <button onClick={restaurarTodo} className="enlace-accion text-xs ml-2">
              Restaurar {eliminadas.size} eliminados
            </button>
          )}
        </span>
      </div>

      {aviso && <div className="aviso aviso-error">{aviso}</div>}
      {avisoOk && <div className="aviso aviso-exito">{avisoOk}</div>}

      <div className="flex justify-end">
        <Boton
          variante="primario"
          type="button"
          onClick={() => void guardarTodos()}
          disabled={guardandoTodos || filas.length === 0}
        >
          {guardandoTodos ? 'Guardando…' : <><Icono nombre="guardar" /> Guardar todos ({filas.length})</>}
        </Boton>
      </div>

      <TablaScroll className="max-h-[70vh] overflow-y-auto">
        <table className="tabla">
          <thead className="sticky top-0 z-10">
            <tr>
              <th>Nombre</th>
              <th>LT HITSS</th>
              <th>Squad</th>
              <th>Rol</th>
              <th>Tipo Contratación</th>
              <th className="text-right">Horas Facturables</th>
              <th className="text-right">Horas Soporte Proy.</th>
              <th className="text-right">Horas Desarrollo Proy.</th>
              <th className="text-right">Total Horas Fact. Proy.</th>
              <th className="text-right">Validación Meta {horasMeta}</th>
              <th className="text-right">Horas Soporte Cerrado</th>
              <th className="text-right">Horas Desarrollo Cerrado</th>
              <th className="text-right">Total Horas Fact. Cerrado</th>
              <th className="text-right">% Cumplimiento Fact.</th>
              <th className="text-right">Horas Vacaciones</th>
              <th className="text-right">Horas Incapacidades</th>
              <th className="text-right">Horas Licencias / Ley</th>
              <th className="text-right">Horas Permisos / Cap.</th>
              <th className="text-right">Otras Novedades Adm.</th>
              <th className="text-right">Total Novedades Adm.</th>
              <th className="text-right">Horas Errores Analista</th>
              <th className="text-right">Horas Garantías</th>
              <th className="text-right">Horas Reprocesos</th>
              <th className="text-right">Otras Nov. Calidad</th>
              <th className="text-right">Total Nov. Calidad</th>
              <th className="text-right">Total Horas Registradas</th>
              <th className="text-right">Horas Backfill / Refuerzo</th>
              <th className="text-left min-w-[200px]">Observaciones / Riesgos</th>
              <th className="w-20"></th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={30} className="p-4 text-center text-slate-400">Cargando…</td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={30} className="p-4 text-center text-slate-400">Sin registros.</td>
              </tr>
            )}
            {!cargando && filas.map((f, idx) => {
              const valor = ltSeleccionado(f)
              const tieneOpciones = f.opcionesLt.length > 1
              return (
                <tr key={f.key}>
                  <td className="font-medium text-slate-800">{f.nombre}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      {tieneOpciones ? (
                        <select
                          value={valor}
                          onChange={(e) => cambiarLt(f.key, e.target.value)}
                          className="campo campo-sm"
                        >
                          {f.opcionesLt.map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600">{valor}</span>
                      )}
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        type="button"
                        onClick={() => jalarAbajo(idx)}
                        title="Aplicar este LT HITSS a todas las filas de abajo"
                        className="ml-1"
                      >
                        <Icono nombre="flecha-abajo" />
                      </Boton>
                    </div>
                  </td>
                  <td className="text-slate-600">{f.squad}</td>
                  <td>
                    <Chip tono={ROL_TONO[f.rol] ?? 'neutro'}>{f.rol}</Chip>
                  </td>
                  <td className="text-slate-600">{f.tipoContratacion}</td>
                  <td className="text-right font-mono text-slate-700">{horasMeta}</td>
                  <td>
                    <input
                      type="number"
                      value={horasSoporte[f.key] ?? 0}
                      onChange={(e) => setHorasSoporte((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right"
                      min={0}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={horasDesarrollo[f.key] ?? 0}
                      onChange={(e) => setHorasDesarrollo((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right"
                      min={0}
                    />
                  </td>
                  <td className="text-right font-mono font-semibold text-marca-osc">
                    {(horasSoporte[f.key] ?? 0) + (horasDesarrollo[f.key] ?? 0)}
                  </td>
                  {(() => {
                    const total = (horasSoporte[f.key] ?? 0) + (horasDesarrollo[f.key] ?? 0);
                    const diff = total - horasMeta;
                    return (
                      <td className={`text-right font-mono font-semibold ${
                        diff === 0 ? 'text-blue-600' : diff > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {diff === 0 ? '✓ OK' : diff > 0 ? `+${diff}` : `${diff}`}
                      </td>
                    );
                  })()}
                  <td>
                    <input
                      type="number"
                      value={horasSopCerrado[f.key] ?? 0}
                      onChange={(e) => setHorasSopCerrado((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right"
                      min={0}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={horasDesCerrado[f.key] ?? 0}
                      onChange={(e) => setHorasDesCerrado((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right"
                      min={0}
                    />
                  </td>
                  <td className="text-right font-mono font-semibold text-marca-osc">
                    {(horasSopCerrado[f.key] ?? 0) + (horasDesCerrado[f.key] ?? 0)}
                  </td>
                  {(() => {
                    const totalCerrado = (horasSopCerrado[f.key] ?? 0) + (horasDesCerrado[f.key] ?? 0);
                    const pct = Math.round((totalCerrado / horasMeta) * 100);
                    return (
                      <td className={`text-right font-mono font-semibold ${
                        pct >= 100 ? 'text-green-600' : pct >= 75 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {pct}%
                      </td>
                    );
                  })()}
                  <td>
                    <input type="number" value={horasVac[f.key] ?? 0}
                      onChange={(e) => setHorasVac((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right" min={0} />
                  </td>
                  <td>
                    <input type="number" value={horasInc[f.key] ?? 0}
                      onChange={(e) => setHorasInc((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right" min={0} />
                  </td>
                  <td>
                    <input type="number" value={horasLic[f.key] ?? 0}
                      onChange={(e) => setHorasLic((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right" min={0} />
                  </td>
                  <td>
                    <input type="number" value={horasPerm[f.key] ?? 0}
                      onChange={(e) => setHorasPerm((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right" min={0} />
                  </td>
                  <td>
                    <input type="number" value={otrasNov[f.key] ?? 0}
                      onChange={(e) => setOtrasNov((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right" min={0} />
                  </td>
                  <td className="text-right font-mono font-semibold text-marca-osc">
                    {(horasVac[f.key] ?? 0) + (horasInc[f.key] ?? 0) + (horasLic[f.key] ?? 0) + (horasPerm[f.key] ?? 0) + (otrasNov[f.key] ?? 0)}
                  </td>
                  <td>
                    <input type="number" value={horasErr[f.key] ?? 0}
                      onChange={(e) => setHorasErr((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right" min={0} />
                  </td>
                  <td>
                    <input type="number" value={horasGar[f.key] ?? 0}
                      onChange={(e) => setHorasGar((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right" min={0} />
                  </td>
                  <td>
                    <input type="number" value={horasRep[f.key] ?? 0}
                      onChange={(e) => setHorasRep((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right" min={0} />
                  </td>
                  <td>
                    <input type="number" value={otrasNovCal[f.key] ?? 0}
                      onChange={(e) => setOtrasNovCal((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      className="campo campo-sm w-20 text-right" min={0} />
                  </td>
                  <td className="text-right font-mono font-semibold text-marca-osc">
                    {(horasErr[f.key] ?? 0) + (horasGar[f.key] ?? 0) + (horasRep[f.key] ?? 0) + (otrasNovCal[f.key] ?? 0)}
                  </td>
                  <td className="text-right font-mono font-bold text-slate-800">
                    {(horasSopCerrado[f.key] ?? 0) + (horasDesCerrado[f.key] ?? 0)
                      + (horasVac[f.key] ?? 0) + (horasInc[f.key] ?? 0) + (horasLic[f.key] ?? 0) + (horasPerm[f.key] ?? 0) + (otrasNov[f.key] ?? 0)
                      + (horasErr[f.key] ?? 0) + (horasGar[f.key] ?? 0) + (horasRep[f.key] ?? 0) + (otrasNovCal[f.key] ?? 0)}
                  </td>
                  <td className="text-right font-mono font-semibold text-orange-600">
                    {(horasVac[f.key] ?? 0) + (horasInc[f.key] ?? 0) + (horasLic[f.key] ?? 0) + (horasPerm[f.key] ?? 0) + (otrasNov[f.key] ?? 0)
                      + (horasErr[f.key] ?? 0) + (horasGar[f.key] ?? 0) + (horasRep[f.key] ?? 0) + (otrasNovCal[f.key] ?? 0)}
                  </td>
                  <td>
                    <textarea
                      value={observaciones[f.key] ?? ''}
                      onChange={(e) => setObservaciones((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="campo campo-sm w-full min-w-[180px]"
                      rows={2}
                    />
                  </td>
                  <td className="text-center">
                    <Boton
                      variante="primario"
                      tamano="sm"
                      type="button"
                      onClick={() => void guardarUno(f)}
                      disabled={guardandoFila.has(f.key)}
                      title="Guardar este registro"
                    >
                      {guardandoFila.has(f.key) ? '…' : <Icono nombre="guardar" />}
                    </Boton>
                  </td>
                  <td className="text-center">
                    <Boton
                      variante="peligro"
                      type="button"
                      onClick={() => eliminarFila(f.key)}
                      title="Quitar este registro"
                    >
                      <Icono nombre="x" />
                    </Boton>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-sm sticky bottom-0">
              <td colSpan={5}>Totales</td>
              <td className="text-right font-mono">{filas.length * horasMeta}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasSoporte[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasDesarrollo[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasSoporte[f.key] ?? 0) + (horasDesarrollo[f.key] ?? 0), 0)}</td>
              <td></td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasSopCerrado[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasDesCerrado[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasSopCerrado[f.key] ?? 0) + (horasDesCerrado[f.key] ?? 0), 0)}</td>
              <td></td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasVac[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasInc[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasLic[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasPerm[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (otrasNov[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasVac[f.key] ?? 0) + (horasInc[f.key] ?? 0) + (horasLic[f.key] ?? 0) + (horasPerm[f.key] ?? 0) + (otrasNov[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasErr[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasGar[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasRep[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (otrasNovCal[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasErr[f.key] ?? 0) + (horasGar[f.key] ?? 0) + (horasRep[f.key] ?? 0) + (otrasNovCal[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono font-bold">{filas.reduce((s, f) => s + (horasSopCerrado[f.key] ?? 0) + (horasDesCerrado[f.key] ?? 0) + (horasVac[f.key] ?? 0) + (horasInc[f.key] ?? 0) + (horasLic[f.key] ?? 0) + (horasPerm[f.key] ?? 0) + (otrasNov[f.key] ?? 0) + (horasErr[f.key] ?? 0) + (horasGar[f.key] ?? 0) + (horasRep[f.key] ?? 0) + (otrasNovCal[f.key] ?? 0), 0)}</td>
              <td className="text-right font-mono">{filas.reduce((s, f) => s + (horasVac[f.key] ?? 0) + (horasInc[f.key] ?? 0) + (horasLic[f.key] ?? 0) + (horasPerm[f.key] ?? 0) + (otrasNov[f.key] ?? 0) + (horasErr[f.key] ?? 0) + (horasGar[f.key] ?? 0) + (horasRep[f.key] ?? 0) + (otrasNovCal[f.key] ?? 0), 0)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </TablaScroll>
    </div>
  )
}
