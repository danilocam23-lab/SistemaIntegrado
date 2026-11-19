// Datos sintéticos, reloj fijo y hooks simulados; sin navegador, red ni tooling nuevo.
// Ejecutar desde web/: node scripts/probar-asignaciones-filtros.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { cargarTypeScript } from './cargar-typescript.mjs'

const ruta = nombre => new URL(`../src/pages/asignaciones/${nombre}`, import.meta.url)
const copia = valor => JSON.parse(JSON.stringify(valor))
const clave = 'asignaciones.filtros.v1'
class Reloj extends Date {
  constructor(...argumentos) {
    if (argumentos.length) super(...argumentos)
    else super('2026-11-18T18:00:00Z')
  }
  static now() { return new Reloj().getTime() }
}
const reactPuro = {
  useMemo: calcular => calcular(),
  useCallback: funcion => funcion,
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useState: inicial => [typeof inicial === 'function' ? inicial() : inicial, () => {}],
}
const globales = { Date: Reloj }
const { anoActualColombia, anoSolicitudActa } = cargarTypeScript(ruta('anosAsignaciones.ts'), globales)

function montarFiltros(crudo, bloqueado = false) {
  let almacenado = crudo
  let estado
  let iniciado = false
  const { useFiltrosAsignaciones } = cargarTypeScript(ruta('useFiltrosAsignaciones.ts'), {
    ...globales,
    window: { sessionStorage: {
      getItem: nombre => {
        assert.equal(nombre, clave)
        if (bloqueado) throw new Error('Almacenamiento bloqueado')
        return almacenado ?? null
      },
      setItem: (nombre, valor) => {
        assert.equal(nombre, clave)
        if (bloqueado) throw new Error('Almacenamiento bloqueado')
        almacenado = valor
      },
    } },
  }, { react: {
    ...reactPuro,
    useState: inicial => {
      if (!iniciado) {
        estado = typeof inicial === 'function' ? inicial() : inicial
        iniciado = true
      }
      return [estado, cambio => { estado = typeof cambio === 'function' ? cambio(estado) : cambio }]
    },
    useEffect: efecto => efecto(),
  } })
  return { renderizar: useFiltrosAsignaciones, leerStorage: () => almacenado }
}

test('Año colombiano actual por defecto: sesión nueva, antigua y corrupta', () => {
  assert.equal(anoActualColombia(new Date('2027-01-01T02:00:00Z')), '2026')
  assert.equal(anoActualColombia(new Date('2027-01-01T05:00:00Z')), '2027')
  for (const crudo of [undefined, '{', 'null', '[]', '"texto"', '{"anos":"2025"}',
    '{"anos":[2025]}', '{"anos":["25"]}', '{"anos":["2025","no"]}', '{"anos":[null]}']) {
    const resultado = montarFiltros(crudo).renderizar()
    assert.deepEqual(copia(resultado.filtros.anos), ['2026'])
    assert.equal(resultado.hayFiltros, true)
    assert.equal(resultado.nFiltros, 1)
  }
  const antiguo = montarFiltros(JSON.stringify({ vista: 'personas', orden: 'nombre', persona: 'p1' })).renderizar()
  assert.equal(antiguo.filtros.vista, 'personas')
  assert.equal(antiguo.filtros.orden, 'nombre')
  assert.equal(antiguo.filtros.persona, 'p1')
  assert.deepEqual(copia(antiguo.filtros.anos), ['2026'])
  assert.doesNotThrow(() => montarFiltros(undefined, true).renderizar())
})

test('Persistir varios años, contar un filtro y limpiar sin perder pestaña ni orden', () => {
  const sesion = montarFiltros()
  sesion.renderizar().actualizar({ anos: ['2024', '2025'], vista: 'personas', orden: 'nombre' })
  let resultado = sesion.renderizar()
  assert.equal(resultado.nFiltros, 1)
  assert.deepEqual(JSON.parse(sesion.leerStorage()).anos, ['2024', '2025'])
  const recuperado = montarFiltros(sesion.leerStorage()).renderizar()
  assert.deepEqual(copia(recuperado.filtros.anos), ['2024', '2025'])
  resultado.actualizar({ estado: 'CERRADO', persona: 'p1', requerimiento: 'REQ', mostrar: 'prioridad' })
  resultado = sesion.renderizar()
  assert.equal(resultado.nFiltros, 5)
  resultado.limpiar()
  resultado = sesion.renderizar()
  assert.deepEqual(copia(resultado.filtros), {
    vista: 'personas', anos: [], orden: 'nombre', estado: '__todos__',
    persona: '__todos__', requerimiento: '', mostrar: 'todo',
  })
  assert.equal(resultado.hayFiltros, false)
  assert.equal(resultado.nFiltros, 0)
  assert.deepEqual(copia(montarFiltros(sesion.leerStorage()).renderizar().filtros.anos), [])
  assert.deepEqual(copia(montarFiltros('{"anos":["2025","2025"]}').renderizar().filtros.anos), ['2025'])
})

test('Calendario ISO estricto, bisiestos y zona escrita sin desplazamiento', () => {
  for (const fecha of [undefined, null, '', 'ayer', '2026', '2026-02-29', '2100-02-29',
    '2026-04-31', '0000-01-01', '2026-13-01', '2026-00-01', '2026-01-00',
    '2026-11-18 basura', '2026-11-18T25:00:00', '2026-11-18T10:70:00']) {
    assert.equal(anoSolicitudActa(fecha), null, String(fecha))
  }
  assert.equal(anoSolicitudActa('2024-02-29T10:20:30.123Z'), '2024')
  assert.equal(anoSolicitudActa('2000-02-29'), '2000')
  assert.equal(anoSolicitudActa('2026-12-31T23:59:59-05:00'), '2026')
  assert.equal(anoSolicitudActa('2027-01-01T00:00:00+05:00'), '2027')
})

const { useDerivadosAsignaciones } = cargarTypeScript(ruta('useDerivadosAsignaciones.ts'), globales, { react: reactPuro })
const ACTIVO = 'ESTIMACION APROBADA ENTREGA PENDIENTE'
const req = (id, fecha_solicitud_acta, cambios = {}) => ({
  id, aplicacion_id: 'app', codigo_req: 'REQ-REPETIDO', nombre: 'Migración de módulo',
  solicitud: { codigo_sc: 'SC-REPETIDO' }, estado: ACTIVO,
  fecha_solicitud_acta, fecha_inicio: '2026-01-01', total_horas_estimadas: 80, ...cambios,
})
const asig = (id, persona_id, requerimiento_id, total_porcentaje, prioridad = false) => ({
  id, persona_id, categoria_id: 'dev', estado: 'ACTIVO', total_porcentaje, prioridad,
  fecha_inicio: '2026-01-01', fecha_creacion: '2026-01-01',
  proyectos: [{ id: `proyecto-${id}`, nombre: 'Proyecto', estado: 'ACTIVO', requerimiento_id }],
})
const base = {
  personas: ['p1', 'p2', 'p3', 'p4'].map(id => ({
    id, nombre: `Persona ${id}`, activo: true, rol_operativo: 'DEV', email: `${id}@ejemplo.test`,
  })),
  requerimientos: [
    req('r24', '2024-06-01'), req('r25', '2025-03-01'),
    req('r26', '2026-12-31T23:59:59-05:00', { id_azure_hitss: 26 }),
    req('r27', '2027-01-01'), req('invalida', '2026-02-29'),
    req('nula', null), req('vacia', ''), req('ausente', undefined),
    req('cerrado', '2025-01-01', { estado: 'CERRADO', nombre: 'Análisis terminado' }),
    req('u25', '2025-09-01'), req('u26', '2026-12-01'), req('u27', '2027-08-01'),
    req('uSinFecha', null),
  ],
  asignaciones: [
    asig('a24', 'p1', 'r24', 20), asig('a25', 'p1', 'r25', 40, true),
    asig('a26', 'p1', 'r26', 50), asig('a27', 'p1', 'r27', 10),
    asig('sinReq', 'p1', null, 5), asig('referenciaPerdida', 'p2', 'no-existe', 7),
    asig('invalida', 'p2', 'invalida', 10), asig('nula', 'p2', 'nula', 10),
    asig('vacia', 'p2', 'vacia', 10), asig('ausente', 'p2', 'ausente', 10),
    asig('cerrado', 'p2', 'cerrado', 30),
  ],
  categorias: [], configuraciones: [],
  capacidades: [{ persona_id: 'p1', scope: 'persona', horas_disponibles: 160 }],
  wosPorPersonaMap: new Map([['p1', [{ id: 'wo1' }]], ['p3', [{ id: 'wo3' }]]]),
  backlogPorPersonaMap: new Map([['p1', [{ id: 'backlog1' }]], ['p4', [{ id: 'backlog4' }]]]),
  horasAzurePorFeature: new Map([[26, [
    { email: 'p1@ejemplo.test', original_estimate: 40, completed_work: 12, remaining_work: 28 },
    { email: 'p2@ejemplo.test', original_estimate: 4, completed_work: 2, remaining_work: 2 },
    { email: null, original_estimate: 8, completed_work: 3, remaining_work: 5 },
  ]]]),
  filtroEstado: '__todos__', filtroPersona: '__todos__', filtroAnos: [],
  busquedaReq: '', mostrar: 'todo', orden: 'carga',
}
function congelar(valor) {
  if (valor && typeof valor === 'object') {
    Object.freeze(valor)
    if (valor instanceof Map) for (const entrada of valor.values()) congelar(entrada)
    else Object.values(valor).forEach(congelar)
  }
  return valor
}
congelar(base)
const derivar = cambios => useDerivadosAsignaciones({ ...base, ...cambios })
const ids = filas => Array.from(filas, fila => fila.reqId).sort()
function comprobarPestanas(datos) {
  const actas = datos.gruposFiltrados.flatMap(grupo =>
    grupo.items.filter(item => !item.sinAsignacionFormal).map(item => item.asig.id)).sort()
  const personas = datos.gruposPorPersona.flatMap(grupo => grupo.reqs.map(item => item.asig.id)).sort()
  assert.deepEqual(copia(actas), copia(personas))
}

test('Fecha de solicitud exclusivamente; varios años, códigos repetidos y referencias faltantes', () => {
  const actual = derivar({ filtroAnos: ['2026'] })
  assert.deepEqual(copia(ids(actual.gruposFiltrados)), ['r26'])
  assert.ok(actual.gruposFiltrados[0].items.some(item => item.sinAsignacionFormal && item.asig.persona_id === 'p2'))
  assert.deepEqual(copia(actual.anosDisponibles), ['2024', '2025', '2026', '2027'])
  comprobarPestanas(actual)
  const varios = derivar({ filtroAnos: ['2024', '2025'] })
  assert.deepEqual(copia(ids(varios.gruposFiltrados)), ['cerrado', 'r24', 'r25'])
  comprobarPestanas(varios)
  const futuros = derivar({ filtroAnos: ['2027'] })
  assert.deepEqual(copia(ids(futuros.gruposFiltrados)), ['r27'])
  const todos = derivar()
  assert.equal(todos.gruposFiltrados.length, 11)
  assert.ok(todos.gruposFiltrados.some(grupo => grupo.reqId === null))
  assert.ok(todos.gruposFiltrados.some(grupo => grupo.reqId === 'no-existe'))
  comprobarPestanas(todos)
  assert.deepEqual(copia(derivar({ requerimientos: [], asignaciones: [] }).anosDisponibles), ['2026'])
  assert.equal(derivar({ filtroAnos: ['2023'] }).gruposPorPersona.length, 0)
})

test('Combinación de año con persona, estado, texto, prioridad y alerta en ambas pestañas', () => {
  const combinado = derivar({
    filtroAnos: ['2024', '2025'], filtroPersona: 'p2', filtroEstado: 'CERRADO', busquedaReq: 'analisis',
  })
  assert.deepEqual(copia(ids(combinado.gruposFiltrados)), ['cerrado'])
  assert.deepEqual(copia(combinado.gruposPorPersona.map(grupo => grupo.persona.id)), ['p2'])
  comprobarPestanas(combinado)
  for (const cambios of [
    { filtroAnos: ['2025'], mostrar: 'prioridad' },
    { filtroAnos: ['2025'], mostrar: 'alerta', filtroEstado: ACTIVO, filtroPersona: 'p1', busquedaReq: 'sc-repetido' },
  ]) {
    const datos = derivar(cambios)
    assert.deepEqual(copia(ids(datos.gruposFiltrados)), ['r25'])
    comprobarPestanas(datos)
  }
  const excluido = derivar({ filtroAnos: ['2026'], filtroPersona: 'p2', filtroEstado: 'CERRADO' })
  assert.equal(excluido.gruposFiltrados.length, 0)
  assert.equal(excluido.gruposPorPersona.length, 0)
})

test('Solo WO/backlog fuera con año activo; franja sin asignar anual sin limitar el panel', () => {
  const todos = derivar()
  const anual = derivar({ filtroAnos: ['2026'] })
  assert.deepEqual(copia(anual.gruposPorPersona.map(grupo => grupo.persona.id)), ['p1'])
  assert.ok(todos.gruposPorPersona.some(grupo => grupo.persona.id === 'p3'))
  assert.ok(todos.gruposPorPersona.some(grupo => grupo.persona.id === 'p4'))
  assert.equal(anual.gruposPorPersona[0].reqs[0].reqId, 'r26')
  assert.equal(base.wosPorPersonaMap.get('p1').length, 1)
  assert.equal(base.backlogPorPersonaMap.get('p1').length, 1)
  assert.deepEqual(copia(anual.reqsSinAsignar.map(opcion => opcion.id)), ['u26'])
  assert.deepEqual(copia(derivar({ filtroAnos: ['2025', '2027'] }).reqsSinAsignar.map(opcion => opcion.id).sort()), ['u25', 'u27'])
  assert.deepEqual(copia(todos.reqsSinAsignar.map(opcion => opcion.id).sort()), ['u25', 'u26', 'u27', 'uSinFecha'])
  assert.deepEqual(copia(anual.opcionesReq), copia(todos.opcionesReq))
})

test('Año no altera capacidad, duplicados, reparto, medidor, KPIs ni mapa; entradas sin mutación', () => {
  const instantanea = () => JSON.stringify(base, (_clave, valor) => valor instanceof Map ? [...valor] : valor)
  const antes = instantanea()
  const todos = derivar()
  for (const filtroAnos of [['2025'], ['2026'], ['2027'], ['2023'], []]) {
    const anual = derivar({ filtroAnos })
    assert.equal(anual.capacidadUsada('p1'), 120)
    assert.equal(anual.capacidadUsada('p1', 'a26'), 70)
    assert.equal(anual.contarActivas('p1'), 4)
    assert.equal(anual.asignacionExistente('p1', 'r24').id, 'a24')
    assert.equal(anual.asignacionExistente('p1', 'r24', 'a24'), null)
    assert.equal(anual.cargaDe('p1').total, 125)
    assert.equal(anual.cargaDe('p1').capacidadHoras, 160)
    assert.deepEqual(copia(anual.cargaDe('p1')), copia(todos.cargaDe('p1')))
    assert.deepEqual(copia(anual.planReparto('p1')), copia(todos.planReparto('p1')))
    assert.equal(anual.planReparto('p1').reduce((suma, fila) => suma + fila.pctNuevo, 0), 100)
    assert.deepEqual(copia(anual.personasSobrecarga), copia(todos.personasSobrecarga))
    assert.deepEqual(copia(anual.resumen), copia(todos.resumen))
  }
  assert.equal(instantanea(), antes)
})

// Se renderiza el árbol React sin DOM; el desplegable y sus callbacks son los reales.
const FiltroDesplegable = cargarTypeScript(new URL('../src/components/ui/FiltroDesplegable.tsx', import.meta.url), globales, {
  react: reactPuro, './primitivos': { cx: (...clases) => clases.filter(Boolean).join(' ') },
}).default
const ui = Object.fromEntries(['BarraFiltros', 'Boton', 'Campo', 'Icono', 'Selector'].map(nombre => [nombre, nombre]))
const { BarraFiltrosAsignaciones } = cargarTypeScript(ruta('BarraFiltrosAsignaciones.tsx'), globales, {
  react: reactPuro,
  '../../components/ui': { ...ui, FiltroDesplegable },
  './Combobox': { Combobox: 'Combobox' },
})
function nodos(arbol) {
  if (Array.isArray(arbol)) return arbol.flatMap(nodos)
  if (!arbol || typeof arbol !== 'object') return []
  return [arbol, ...nodos(arbol.props?.children)]
}

test('UI usa FiltroDesplegable real: sustituir actual, multiaño y Todos incluye actas sin fecha', () => {
  let filtros = montarFiltros().renderizar().filtros
  const controles = () => {
    const barra = BarraFiltrosAsignaciones({
      filtros, onCambio: parcial => { filtros = { ...filtros, ...parcial } },
      onLimpiar: () => {}, hayFiltros: true, nFiltros: 1,
      estadosUnicos: [], personasDisponibles: [], anosDisponibles: ['2024', '2025', '2026', '2027'],
    })
    const filtro = nodos(barra).find(nodo => nodo.type === FiltroDesplegable)
    assert.ok(filtro)
    assert.equal(filtro.props.label, 'Año')
    assert.equal(filtro.props.valorInicial, '2026')
    assert.ok(nodos(barra).some(nodo => nodo.props?.children ===
      'Año según fecha de solicitud del acta; carga y capacidad muestran el total vigente'))
    return nodos(FiltroDesplegable(filtro.props))
  }
  const elegir = ano => {
    const etiqueta = controles().find(nodo => nodo.type === 'label' && nodo.props.children[1] === ano)
    etiqueta.props.children[0].props.onChange()
  }
  elegir('2025')
  assert.deepEqual(copia(filtros.anos), ['2025'])
  elegir('2024')
  assert.deepEqual(copia(filtros.anos), ['2025', '2024'])
  controles().find(nodo => nodo.props?.['data-analytics-id'] === 'filtro.todos').props.onClick()
  assert.deepEqual(copia(filtros.anos), [])
  assert.equal(derivar({ filtroAnos: filtros.anos }).gruposFiltrados.length, 11)
  elegir('2027')
  controles().find(nodo => nodo.props?.['data-analytics-id'] === 'filtro.limpiar').props.onClick()
  assert.deepEqual(copia(filtros.anos), [])
  // Los saltos desde mapa y sobrecarga son globales: ambos deben despejar el año.
  const pantalla = readFileSync(new URL('../src/pages/Asignaciones.tsx', import.meta.url), 'utf8')
  for (const nombre of ['irAPersona', 'verAsignacionesDe']) {
    const cuerpo = pantalla.split(`const ${nombre} = useCallback`)[1]?.split('}, [actualizar])')[0]
    assert.match(cuerpo ?? '', /actualizar\(\{[^\n]*anos: \[\]/)
  }
})
