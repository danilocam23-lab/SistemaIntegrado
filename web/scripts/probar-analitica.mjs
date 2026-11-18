// Ejecutar desde web. No descarga GTM, no usa Google ni toca el backend.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cargarTypeScript } from './cargar-typescript.mjs'

const rutaServicio = new URL('../src/analitica/servicio.ts', import.meta.url)
const { crearServicioAnalitica, CAMPOS } = cargarTypeScript(rutaServicio)
const { crearAdaptadorOperaciones } = cargarTypeScript(new URL('../src/analitica/operaciones.ts', import.meta.url))
const { analizarControles, inventariarProyecto } = cargarTypeScript(new URL('./instrumentacion-analitica.ts', import.meta.url))
const identidad = { id_analitico: '5bd287ad-3e70-40df-a905-6173db77382a', rol: 'superadmin' }

function preparar({ produccion = true, referente = 'https://externo.test/persona?correo=privado#token',
  usuario = identidad, enviarFalla = false } = {}) {
  const datos = []
  let reloj = 0
  let visible = true
  let actual = usuario
  let numero = 0
  const servicio = crearServicioAnalitica({
    produccion, version: 'version-de-prueba', base: '/SistemaIntegrado/', origen: 'https://hitss.test',
    referenteInicial: referente, ahora: () => 1700000000000 + reloj, reloj: () => reloj,
    aleatorio: () => `operacion-efimera-${++numero}`, visible: () => visible,
    obtenerIdentidad: () => actual,
    enviar(evento) { if (enviarFalla) throw new Error('Bloqueado'); datos.push(evento) },
  })
  return {
    servicio, datos,
    eventos: nombre => datos.filter(dato => dato.event && (!nombre || dato.event === nombre)),
    avanzar(ms) { reloj += ms },
    visibilidad(valor) { visible = valor; servicio.visibilidad() },
    identidad(valor) { actual = valor; servicio.actualizarIdentidad(valor) },
    aceptar(ruta = '/admin/usuarios') { servicio.navegar(ruta); servicio.consentimiento('aceptado') },
  }
}

let casos = 0
function probar(nombre, prueba) {
  prueba()
  casos++
  console.log(`OK: ${nombre}`)
}

async function probarAsync(nombre, prueba) {
  await prueba()
  casos++
  console.log(`OK: ${nombre}`)
}

probar('No enviar en dev, rechazo, sin decisión ni antes de aceptar; sin backlog', () => {
  for (const produccion of [false, true]) {
    const caso = preparar({ produccion })
    caso.servicio.navegar('/requerimientos')
    caso.servicio.interaccion('usuarios.nuevo', 'click')
    caso.servicio.sesion('session_start')
    caso.servicio.exportacion('personas_excel')
    const adaptador = crearAdaptadorOperaciones(caso.servicio)
    const peticion = { method: 'post', url: '/usuarios' }
    adaptador.solicitar(peticion)
    caso.servicio.consentimiento('rechazado')
    caso.servicio.consentimiento('aceptado')
    adaptador.finalizar(peticion, 201)
    assert.equal(caso.eventos().length, produccion ? 1 : 0)
    if (produccion) assert.equal(caso.eventos()[0].event, 'app_page_view')
    else assert.equal(caso.datos.length, 0)
  }
})

probar('Primera aceptación tras navegar emite únicamente la vista actual primero', () => {
  const caso = preparar()
  caso.servicio.navegar('/dashboard')
  caso.servicio.navegar('/entregas-actas?nombre=privado#token')
  caso.servicio.consentimiento('aceptado')
  caso.servicio.interaccion('entregas.exportar', 'click')
  assert.equal(caso.eventos()[0].event, 'app_page_view')
  assert.equal(caso.eventos('app_page_view').length, 1)
  assert.equal(caso.eventos()[0].route_template, '/entregas-actas')
})

probar('Plantilla :reqId, query/hash y referente inicial nunca filtran IDs o PII', () => {
  const caso = preparar()
  caso.aceptar('/requerimientos/id-confidencial?correo=privado#token')
  const vista = caso.eventos('app_page_view')[0]
  assert.equal(vista.page_location, 'https://hitss.test/SistemaIntegrado/requerimientos/:reqId')
  assert.equal(vista.page_referrer, 'https://externo.test')
  assert.doesNotMatch(JSON.stringify(caso.datos), /id-confidencial|correo|privado|token/)
  caso.servicio.navegar('/dashboard?algo=privado')
  assert.equal(caso.eventos('app_page_view')[1].page_referrer, vista.page_location)
  caso.servicio.navegar('/ruta-inventada/id-privado')
  assert.equal(caso.eventos('app_page_view').length, 3)
  assert.equal(caso.eventos('app_page_view')[2].route_template, '/*')
  assert.equal(caso.eventos('app_page_view')[2].screen, 'no_encontrada')
  assert.doesNotMatch(JSON.stringify(caso.datos), /ruta-inventada|id-privado/)
})

probar('Referente inválido/credenciales URL se descartan; BASE_URL raíz canónica', () => {
  for (const referente of ['', 'javascript:alert(1)', 'no es url']) {
    const caso = preparar({ referente })
    caso.aceptar()
    assert.equal(caso.eventos()[0].page_referrer, '')
  }
  const caso = preparar({ referente: 'https://usuario:password@externo.test/ruta?token' })
  caso.aceptar()
  assert.equal(caso.eventos()[0].page_referrer, 'https://externo.test')
})

probar('StrictMode, mismo pathname, nuevos objetos /me y visibilidad no duplican vistas ni login', () => {
  const caso = preparar()
  caso.aceptar()
  caso.servicio.navegar('/admin/usuarios')
  caso.servicio.consentimiento('aceptado')
  caso.identidad({ ...identidad })
  caso.identidad({ ...identidad })
  caso.visibilidad(false)
  caso.visibilidad(true)
  assert.equal(caso.eventos('app_page_view').length, 1)
  assert.equal(caso.eventos('app_session').length, 0)
  caso.servicio.sesion('session_start')
  caso.servicio.sesion('session_start')
  assert.equal(caso.eventos('app_session').length, 1)
})

probar('Cambiar entre dos recursos da dos vistas, ambas con la misma plantilla segura', () => {
  const caso = preparar()
  caso.aceptar('/requerimientos/primero')
  caso.servicio.navegar('/requerimientos/segundo')
  assert.equal(caso.eventos('app_page_view').length, 2)
  assert.equal(caso.eventos('app_page_view')[1].route_template, '/requerimientos/:reqId')
})

probar('Primera vista protegida espera identidad /me sin atribuirla a sesión anterior', () => {
  const caso = preparar({ usuario: null })
  caso.aceptar('/dashboard')
  caso.servicio.interaccion('usuarios.nuevo', 'click')
  assert.equal(caso.eventos().length, 0)
  caso.identidad(identidad)
  assert.equal(caso.eventos('app_page_view').length, 1)
  assert.equal(caso.eventos('app_page_view')[0].user_id, identidad.id_analitico)
  caso.identidad({ ...identidad })
  assert.equal(caso.eventos('app_page_view').length, 1)
  const publico = preparar({ usuario: null })
  publico.aceptar('/login')
  assert.equal(publico.eventos('app_page_view').length, 1)
  assert.equal(publico.eventos('app_page_view')[0].user_id, null)
})

probar('Identidad solo UUID válido; rol libre se agrupa y no envía DTO/PII', () => {
  const caso = preparar({ usuario: {
    id: 'id-mongo', email: 'persona@test', nombre: 'Persona privada',
    id_analitico: 'incorrecto', rol: 'Juan Auditor', rol_nombre: 'Nombre humano',
    permisos: ['*'], aplicaciones_codigos: ['squad-privado'],
  } })
  caso.aceptar()
  const vista = caso.eventos()[0]
  assert.equal(vista.user_id, null)
  assert.equal(vista.user_role, 'personalizada')
  assert.equal(vista.role_group, 'personalizado')
  assert.doesNotMatch(JSON.stringify(caso.datos), /persona@test|Persona privada|id-mongo|squad-privado|Nombre humano|Juan Auditor/)
})

probar('Logout y cambio de usuario limpian dataLayer e invalidan operaciones/formularios anteriores', () => {
  const caso = preparar()
  caso.aceptar()
  const adaptador = crearAdaptadorOperaciones(caso.servicio)
  const config = { method: 'PUT', url: '/usuarios/id-confidencial' }
  adaptador.solicitar(config)
  const formulario = {}
  caso.servicio.iniciarFormulario(formulario, 'usuario')
  const confirmar = caso.servicio.prepararEnvioFormulario('usuario')
  caso.servicio.sesion('session_start')
  caso.servicio.sesion('session_end')
  caso.identidad(null)
  assert.equal(caso.datos.at(-1).user_id, null)
  caso.identidad({ id_analitico: '64fbb20c-f7bc-46a7-977f-e6356e8c57e1', rol: 'viewer' })
  assert.equal(caso.datos.at(-1).user_id, '64fbb20c-f7bc-46a7-977f-e6356e8c57e1')
  assert.equal(caso.datos.at(-1).operation_id, null)
  assert.equal(caso.datos.at(-1).event, undefined)
  adaptador.finalizar(config, 200)
  confirmar()
  caso.servicio.interaccion('usuarios.nuevo', 'click')
  assert.equal(caso.eventos('app_operation').length, 1)
  assert.equal(caso.eventos('app_form').length, 1)
  assert.equal(caso.datos.at(-1).user_role, 'viewer')
  assert.equal(caso.datos.at(-1).role_group, 'consulta')
  assert.equal(caso.eventos('app_page_view').length, 1)
})

probar('Retirada detiene eventos/timers y no reenvía operaciones al reaceptar', () => {
  const caso = preparar()
  caso.aceptar()
  const id = caso.servicio.iniciarOperacion({ module: 'administracion', action_name: 'crear', resource_type: 'usuario' })
  caso.avanzar(100)
  caso.servicio.consentimiento('rechazado')
  const cantidad = caso.datos.length
  caso.servicio.interaccion('usuarios.nuevo', 'click')
  caso.avanzar(5000)
  caso.servicio.salir()
  caso.servicio.terminarOperacion(id, 201)
  assert.equal(caso.datos.length, cantidad)
  caso.servicio.consentimiento('aceptado')
  caso.servicio.terminarOperacion(id, 201)
  assert.equal(caso.eventos('app_operation').length, 1)
  assert.equal(caso.eventos('app_page_view').length, 2)
})

probar('Catálogo rechaza IDs desconocidos, metadatos ajenos y operaciones inventadas', () => {
  const caso = preparar()
  caso.aceptar()
  caso.servicio.interaccion('persona.nombre.privado', 'click')
  caso.servicio.interaccion('__proto__', 'click')
  assert.equal(caso.eventos('app_interaction').length, 0)
  assert.equal(caso.servicio.iniciarOperacion({
    module: 'administracion', action_name: 'crear', resource_type: 'usuario', email: 'privado@test',
  }), null)
  assert.equal(caso.servicio.iniciarOperacion({
    module: 'administracion', action_name: 'acta_approved', resource_type: 'acta',
  }), null)
})

probar('Campos exactos: máximo 22 + event; opcionales null sin herencia entre eventos', () => {
  const caso = preparar()
  caso.aceptar()
  const id = caso.servicio.iniciarOperacion({ module: 'administracion', action_name: 'crear', resource_type: 'usuario' })
  caso.servicio.terminarOperacion(id, 422)
  caso.servicio.interaccion('usuarios.nuevo', 'click')
  const modelo = Object.assign({}, ...caso.datos)
  assert.equal(modelo.operation_id, null)
  assert.equal(modelo.error_type, null)
  assert.equal(modelo.status_code, null)
  assert.equal(CAMPOS.length, 22)
  for (const evento of caso.eventos()) {
    assert.deepEqual(Object.keys(evento).sort(), ['event', ...CAMPOS].sort())
    assert.ok(Object.keys(evento).length - 1 <= 25)
  }
})

probar('Axios puro: attempt + failure para 4xx/5xx, nunca success, sin payload/path; respuesta intacta', () => {
  for (const estado of [401, 403, 422, 500, undefined]) {
    const caso = preparar()
    caso.aceptar()
    const adaptador = crearAdaptadorOperaciones(caso.servicio)
    const config = {
      method: 'put', url: '/usuarios/recurso-confidencial?email=privado',
      data: { nombre: 'Persona secreta', password: 'password-secreto' }, headers: { Authorization: 'token-secreto' },
    }
    const anterior = JSON.stringify(config)
    adaptador.solicitar(config)
    caso.avanzar(120)
    adaptador.finalizar(config, estado)
    adaptador.finalizar(config, 200)
    const eventos = caso.eventos('app_operation')
    assert.deepEqual(eventos.map(evento => evento.outcome), ['attempt', 'failure'])
    assert.equal(eventos[0].operation_id, eventos[1].operation_id)
    assert.equal(eventos[1].elapsed_ms, 120)
    assert.equal(JSON.stringify(config), anterior)
    assert.doesNotMatch(JSON.stringify(caso.datos), /confidencial|privado|Persona secreta|password-secreto|token-secreto/)
    assert.equal(caso.eventos('app_error').length, 1)
  }
})

probar('Axios 201/204/202 y cancelación se distinguen; GET polling/URL externa no instrumentados', () => {
  const caso = preparar()
  caso.aceptar()
  const adaptador = crearAdaptadorOperaciones(caso.servicio)
  for (const estado of [201, 204, 202]) {
    const config = { method: 'POST', url: '/usuarios' }
    adaptador.solicitar(config)
    adaptador.finalizar(config, estado)
  }
  const cancelada = { method: 'PUT', url: '/usuarios/privado' }
  adaptador.solicitar(cancelada)
  adaptador.finalizar(cancelada, undefined, true)
  for (const url of ['/auth/me', '/requerimientos', '/azdo/sync/estado', 'https://otro.test/usuarios']) {
    const config = { method: 'GET', url }
    adaptador.solicitar(config)
    adaptador.finalizar(config, 200)
  }
  assert.equal(caso.eventos('app_operation').filter(evento => evento.outcome === 'success').length, 3)
  assert.equal(caso.eventos('app_operation').at(-1).outcome, 'cancelled')
  assert.equal(caso.eventos('app_error').at(-1).error_type, 'cancelacion')
})

probar('Engagement solo visible, sin intervalo ni duplicados al salir dos veces', () => {
  const caso = preparar()
  caso.aceptar()
  caso.avanzar(1000)
  caso.visibilidad(false)
  caso.avanzar(100000)
  caso.visibilidad(true)
  caso.avanzar(2000)
  caso.servicio.navegar('/dashboard')
  assert.equal(caso.eventos('app_screen_engagement')[0].elapsed_ms, 3000)
  caso.avanzar(500)
  caso.servicio.salir()
  caso.servicio.salir()
  assert.equal(caso.eventos('app_screen_engagement').length, 2)
  assert.equal(caso.eventos('app_screen_engagement')[1].elapsed_ms, 500)
})

probar('Formularios: primer cambio una vez; no éxito al submit; confirmación sin abandono posterior', () => {
  const caso = preparar()
  caso.aceptar()
  const formulario = {}
  caso.servicio.iniciarFormulario(formulario, 'usuario')
  caso.servicio.iniciarFormulario(formulario, 'usuario')
  const confirmar = caso.servicio.prepararEnvioFormulario('usuario')
  assert.equal(caso.eventos('app_form').length, 1)
  caso.avanzar(2000)
  confirmar()
  confirmar()
  caso.servicio.navegar('/dashboard')
  assert.deepEqual(caso.eventos('app_form').map(evento => evento.action_name), ['start', 'submitted'])
  assert.equal(caso.eventos('app_form')[1].elapsed_ms, 2000)
})

probar('Formularios sucios abandonados/cancelados; respuesta antigua no confirma instancia nueva', () => {
  const caso = preparar()
  caso.aceptar()
  const viejo = {}
  caso.servicio.iniciarFormulario(viejo, 'usuario')
  const confirmar = caso.servicio.prepararEnvioFormulario('usuario')
  caso.servicio.finalizarFormulario(viejo, 'cancelled')
  const nuevo = {}
  caso.servicio.iniciarFormulario(nuevo, 'usuario')
  confirmar()
  caso.servicio.navegar('/dashboard')
  assert.deepEqual(caso.eventos('app_form').map(evento => evento.action_name), ['start', 'cancelled', 'start', 'abandoned'])
})

probar('Exportaciones registradas solamente y analítica bloqueada no interrumpe funcionalidad', () => {
  const caso = preparar()
  caso.aceptar()
  caso.servicio.exportacion('entregas_excel')
  caso.servicio.exportacion('archivo-persona-secreta')
  assert.equal(caso.eventos('app_export').length, 1)
  assert.equal(caso.eventos('app_export')[0].outcome, 'success')
  const bloqueado = preparar({ enviarFalla: true })
  assert.doesNotThrow(() => {
    bloqueado.aceptar()
    bloqueado.servicio.interaccion('usuarios.nuevo', 'click')
    bloqueado.servicio.sesion('session_end')
  })
})

class ElementoPrueba {
  constructor(etiqueta, atributos = {}, padre = null) {
    this.etiqueta = etiqueta
    this.atributos = atributos
    this.padre = padre
    this.hijos = []
    padre?.hijos.push(this)
    this.isConnected = true
  }
  get attributes() { return Object.entries(this.atributos).map(([name, value]) => ({ name, value })) }
  get value() { throw new Error('Nunca leer valores') }
  get textContent() { throw new Error('Nunca leer texto') }
  getAttribute(nombre) { return this.atributos[nombre] ?? null }
  matches(selector) {
    return selector.split(',').some(parte => {
      const limpia = parte.trim()
      const etiqueta = limpia.match(/^[a-z]+/)?.[0]
      if (etiqueta && etiqueta !== this.etiqueta) return false
      const atributos = [...limpia.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)]
      return atributos.every(([, nombre, valor]) => nombre in this.atributos && (valor === undefined || this.atributos[nombre] === valor))
    })
  }
  closest(selector) {
    for (let actual = this; actual; actual = actual.padre) if (actual.matches(selector)) return actual
    return null
  }
  contains(elemento) {
    for (let actual = elemento; actual; actual = actual.padre) if (actual === this) return true
    return false
  }
  querySelector(selector) {
    for (const hijo of this.hijos) {
      if (hijo.matches(selector)) return hijo
      const encontrado = hijo.querySelector(selector)
      if (encontrado) return encontrado
    }
    return null
  }
}
class ObservadorPrueba {
  static instancias = []
  constructor(callback) { this.callback = callback; ObservadorPrueba.instancias.push(this) }
  observe() {}
  disconnect() {}
}
const { controlDeEvento, instalarDelegacion } = cargarTypeScript(
  new URL('../src/analitica/delegacion.ts', import.meta.url),
  { Element: ElementoPrueba, MutationObserver: ObservadorPrueba },
)

probar('Delegación: icono interno una vez, más específico, desconocidos/disabled/inert/secretos ignorados', () => {
  const boton = new ElementoPrueba('button', { 'data-analytics-id': 'usuarios.nuevo' })
  const icono = new ElementoPrueba('svg', {}, boton)
  assert.equal(controlDeEvento(icono).id, 'usuarios.nuevo')
  const desconocido = new ElementoPrueba('span', { 'data-analytics-id': 'desconocido' }, boton)
  assert.equal(controlDeEvento(desconocido), null)
  for (const atributos of [{ disabled: '' }, { inert: '' }, { 'aria-disabled': 'true' }]) {
    const padre = new ElementoPrueba('div', atributos)
    assert.equal(controlDeEvento(new ElementoPrueba('button', { 'data-analytics-id': 'usuarios.nuevo' }, padre)), null)
  }
  assert.equal(controlDeEvento(new ElementoPrueba('input', { type: 'password', 'data-analytics-id': 'usuarios.buscar' })), null)
  assert.equal(controlDeEvento(new ElementoPrueba('button', { 'data-analytics-id': 'usuarios.nuevo', 'data-analytics-email': 'privado' })), null)
  const fondo = new ElementoPrueba('div', { 'data-analytics-id': 'modal.fondo' })
  assert.equal(controlDeEvento(new ElementoPrueba('div', {}, fondo)), null)
})

function prepararDelegacion(caso) {
  const oyentes = new Map()
  const temporizadores = new Map()
  let siguiente = 0
  const documento = {
    documentElement: {}, visibilityState: 'visible',
    addEventListener(tipo, callback) { const lista = oyentes.get(tipo) ?? []; lista.push(callback); oyentes.set(tipo, lista) },
    removeEventListener(tipo, callback) { oyentes.set(tipo, (oyentes.get(tipo) ?? []).filter(oyente => oyente !== callback)) },
  }
  const ventana = {
    setTimeout(callback) { const id = ++siguiente; temporizadores.set(id, callback); return id },
    clearTimeout(id) { temporizadores.delete(id) },
    addEventListener: documento.addEventListener,
    removeEventListener: documento.removeEventListener,
  }
  const delegacion = instalarDelegacion(caso.servicio, documento, ventana)
  return {
    delegacion,
    emitir(tipo, target) { for (const callback of oyentes.get(tipo) ?? []) callback({ type: tipo, target }) },
    completarTimers() { const callbacks = [...temporizadores.values()]; temporizadores.clear(); callbacks.forEach(callback => callback()) },
  }
}

probar('Listener único: clicks en SVG, checkbox solo change, búsquedas debounce sin valores/backlog', () => {
  const caso = preparar()
  caso.servicio.navegar('/admin/usuarios')
  const dom = prepararDelegacion(caso)
  const busqueda = new ElementoPrueba('input', { 'data-analytics-id': 'usuarios.buscar' })
  dom.emitir('input', busqueda)
  caso.servicio.consentimiento('aceptado')
  dom.completarTimers()
  assert.equal(caso.eventos('app_interaction').length, 0)
  const boton = new ElementoPrueba('button', { 'data-analytics-id': 'usuarios.nuevo' })
  dom.emitir('click', new ElementoPrueba('svg', {}, boton))
  const filtro = new ElementoPrueba('input', { type: 'checkbox', 'data-analytics-id': 'roles.permiso' })
  dom.emitir('click', filtro)
  dom.emitir('change', filtro)
  dom.emitir('input', busqueda)
  dom.emitir('input', busqueda)
  dom.emitir('input', busqueda)
  dom.completarTimers()
  assert.equal(caso.eventos('app_interaction').length, 3)
  const padre = new ElementoPrueba('div', { 'data-analytics-id': 'roles.seleccionar' })
  const etiqueta = new ElementoPrueba('label', {}, padre)
  const casilla = new ElementoPrueba('input', { type: 'checkbox', 'data-analytics-id': 'roles.permiso' }, etiqueta)
  dom.emitir('click', etiqueta)
  assert.equal(caso.eventos('app_interaction').length, 3)
  dom.emitir('click', casilla)
  dom.emitir('change', casilla)
  assert.equal(caso.eventos('app_interaction').length, 4)
  dom.emitir('input', busqueda)
  dom.delegacion.vaciarBusquedas()
  dom.completarTimers()
  assert.equal(caso.eventos('app_interaction').length, 4)
  dom.delegacion.desinstalar()
  dom.emitir('click', boton)
  assert.equal(caso.eventos('app_interaction').length, 4)
})

probar('Delegación formularios: secretos no dirty, cancelar no abandono ni valores', () => {
  const caso = preparar()
  caso.aceptar()
  const dom = prepararDelegacion(caso)
  const formulario = new ElementoPrueba('form', { 'data-analytics-form': 'usuario' })
  dom.emitir('input', new ElementoPrueba('input', { type: 'password' }, formulario))
  assert.equal(caso.eventos('app_form').length, 0)
  dom.emitir('input', new ElementoPrueba('input', {}, formulario))
  dom.emitir('click', new ElementoPrueba('button', { 'data-analytics-id': 'usuarios.cancelar' }, formulario))
  caso.servicio.salir()
  assert.deepEqual(caso.eventos('app_form').map(evento => evento.action_name), ['start', 'cancelled'])
  dom.delegacion.desinstalar()
})

probar('Desmontaje de formulario sucio dispara abandono una sola vez', () => {
  const caso = preparar()
  caso.aceptar()
  const dom = prepararDelegacion(caso)
  const formulario = new ElementoPrueba('form', { 'data-analytics-form': 'usuario' })
  dom.emitir('input', new ElementoPrueba('input', {}, formulario))
  formulario.isConnected = false
  const observador = ObservadorPrueba.instancias.at(-1)
  observador.callback()
  observador.callback()
  assert.deepEqual(caso.eventos('app_form').map(evento => evento.action_name), ['start', 'abandoned'])
  dom.delegacion.desinstalar()
})

probar('AST: IDs deterministas por handler, filas iguales comparten ID; sin labels/PII de runtime', () => {
  const fuente = `export function Ejemplo() { return <div>
    <Boton onClick={() => guardar(fila.id)}>Nombre: {fila.nombre}</Boton>
    <Link to={'/requerimientos/' + fila.id}>{fila.email}</Link>
    <Campo value={busqueda} onChange={onCambiarBusqueda} />
    <Campo type="password" onChange={setPassword} />
    <Campo type={mostrar ? 'text' : 'password'} onChange={setValor} />
    <Boton data-analytics-id="usuarios.nuevo" onClick={crear}>Nuevo</Boton>
  </div> }`
  const primero = analizarControles(fuente, 'src/pages/Ejemplo.tsx')
  const segundo = analizarControles(fuente.replace('Nombre:', 'Nombre distinto:'), 'src/pages/Ejemplo.tsx')
  assert.deepEqual(Object.keys(primero.catalogo), Object.keys(segundo.catalogo))
  assert.equal(primero.controles.filter(control => control.cobertura === 'excluido_seguridad').length, 2)
  assert.equal(Object.keys(primero.catalogo).length, 3)
  assert.doesNotMatch(JSON.stringify(primero.catalogo), /fila\.|nombre|email|password|busqueda.*value/)
  assert.ok(primero.codigo.includes('data-analytics-id="usuarios.nuevo"'))
  assert.equal(Object.keys(analizarControles(primero.codigo, 'src/pages/Ejemplo.tsx').catalogo).length, 0)
  for (const id of Object.keys(primero.catalogo)) assert.ok(id.length <= 80)
  const compilado = cargarTypeScript(rutaServicio, { __CONTROLES_ANALITICA__: primero.catalogo })
  const datos = []
  const servicio = compilado.crearServicioAnalitica({
    produccion: true, version: 'test', base: '/', origen: 'https://hitss.test', referenteInicial: '',
    ahora: () => 0, reloj: () => 0, aleatorio: () => 'op', visible: () => true,
    obtenerIdentidad: () => identidad, enviar: dato => datos.push(dato),
  })
  servicio.navegar('/dashboard')
  servicio.consentimiento('aceptado')
  servicio.interaccion(Object.keys(primero.catalogo)[0], 'click')
  assert.equal(datos.at(-1).event, 'app_interaction')
  assert.equal(datos[0].page_location, 'https://hitss.test/dashboard')
})

probar('Inventario real AST reproducible, catálogo de rutas completo y Actas no alcanzable', () => {
  const raiz = new URL('../', import.meta.url)
  const primero = inventariarProyecto(fileURLToPath(raiz))
  const segundo = inventariarProyecto(fileURLToPath(raiz))
  assert.equal(JSON.stringify(primero), JSON.stringify(segundo))
  const actas = primero.inventario.controles.filter(control => control.archivo === 'src/pages/Actas.tsx')
  assert.ok(actas.length > 0)
  assert.ok(actas.every(control => !control.alcanzable_desde_main))
  assert.ok(primero.inventario.totales.automaticos > 0)
  console.log(`Inventario: ${JSON.stringify(primero.inventario.totales)}`)
  const { PANTALLAS, buscarPantalla } = cargarTypeScript(new URL('../src/analitica/catalogo.ts', import.meta.url))
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  for (const [ruta] of PANTALLAS) assert.ok(app.includes(`path="${ruta === '/login' || ruta === '/' ? ruta : ruta === '/*' ? '*' : ruta.slice(1)}"`), ruta)
  // Inverso: toda ruta de App.tsx debe estar en PANTALLAS (sin rutas sin medir).
  const rutasApp = new Set()
  for (const [, ruta] of app.matchAll(/<Route\s+(?:index\s+)?path="([^"]*)"/g)) {
    rutasApp.add(ruta === '*' ? '/*' : ruta.startsWith('/') ? ruta : `/${ruta}`)
  }
  assert.equal(JSON.stringify([...rutasApp].sort()), JSON.stringify(PANTALLAS.map(([ruta]) => ruta).sort()))
  // /actas no existe en App.tsx: cae en la plantilla 404, no en una pantalla real.
  assert.equal(buscarPantalla('/actas')[1], 'no_encontrada')
  for (const ruta of ['/dashboard-squad', '/tarifas', '/categorias', '/admin/uso-personas']) {
    assert.ok(buscarPantalla(ruta) && buscarPantalla(ruta)[0] === ruta, ruta)
  }
})

probar('Login: POST /auth/login no se cataloga (sin triple conteo); login_failed y session_start una sola vez', () => {
  const { buscarOperacion, esOperacionCatalogada } = cargarTypeScript(new URL('../src/analitica/catalogo.ts', import.meta.url))
  assert.equal(buscarOperacion('POST', '/auth/login'), undefined)
  assert.equal(esOperacionCatalogada({ module: 'sesion', action_name: 'login', resource_type: 'sesion' }), false)
  const caso = preparar({ usuario: null })
  caso.aceptar('/login')
  const adaptador = crearAdaptadorOperaciones(caso.servicio)
  const peticion = { method: 'post', url: '/auth/login' }
  adaptador.solicitar(peticion)
  adaptador.finalizar(peticion, 200)
  assert.equal(caso.eventos('app_operation').length, 0)
  caso.servicio.sesion('login_failed')
  assert.equal(caso.eventos('app_session')[0].action_name, 'login_failed')
  assert.equal(caso.eventos('app_session')[0].outcome, 'failure')
  caso.identidad(identidad)
  caso.servicio.sesion('session_start')
  caso.servicio.sesion('session_start')
  assert.equal(caso.eventos('app_session').filter(e => e.action_name === 'session_start').length, 1)
})

probar('Sesión: start al restaurar, end al salir (una vez), expired solo con sesión; export con resultado real', () => {
  const caso = preparar()
  caso.aceptar()
  caso.servicio.sesion('session_expired')
  assert.equal(caso.eventos('app_session').length, 0)
  caso.servicio.sesion('session_start')
  caso.servicio.salir()
  caso.servicio.salir()
  assert.deepEqual(caso.eventos('app_session').map(e => e.action_name), ['session_start', 'session_end'])
  caso.identidad(null)
  caso.identidad(identidad)
  caso.servicio.sesion('session_start')
  caso.servicio.sesion('session_expired')
  assert.equal(caso.eventos('app_session').at(-1).action_name, 'session_expired')
  assert.equal(caso.eventos('app_session').at(-1).outcome, 'failure')
  const otro = preparar()
  otro.aceptar()
  assert.equal(otro.servicio.exportar('personas_excel', () => 42), 42)
  assert.throws(() => otro.servicio.exportar('personas_excel', () => { throw new Error('disco') }), /disco/)
  assert.deepEqual(otro.eventos('app_export').map(e => e.outcome), ['success', 'failure'])
  assert.ok(otro.eventos('app_export').every(e => e.elapsed_ms === null))
  otro.servicio.exportacion('plantilla_importacion_excel')
  assert.equal(otro.eventos('app_export').length, 3)
})

function prepararConRegistro({ consentimiento = null } = {}) {
  const caso = preparar()
  const registrados = []
  let numero = 0
  const servicio = crearServicioAnalitica({
    produccion: true, version: 'v', base: '/SistemaIntegrado/', origen: 'https://hitss.test',
    referenteInicial: '', ahora: () => 1700000000000, reloj: () => 0, aleatorio: () => `op-${++numero}`,
    visible: () => true, obtenerIdentidad: () => identidad, enviar: dato => caso.datos.push(dato),
    registrar: evento => registrados.push(evento),
  })
  servicio.navegar('/admin/usuarios')
  servicio.actualizarIdentidad(identidad)
  if (consentimiento) servicio.consentimiento(consentimiento)
  return { servicio, registrados, datos: caso.datos }
}

probar('Registro propio: obligatorio sin consentimiento, solo campos saneados, dataLayer sigue condicionado', () => {
  const caso = prepararConRegistro()
  assert.equal(caso.datos.length, 0)
  assert.equal(caso.registrados[0].event, 'app_page_view')
  caso.servicio.interaccion('usuarios.nuevo', 'click')
  caso.servicio.sesion('session_start')
  const id = caso.servicio.iniciarOperacion({ module: 'administracion', action_name: 'crear', resource_type: 'usuario' })
  assert.equal(id, null)
  assert.deepEqual(caso.registrados.map(e => e.event), ['app_page_view', 'app_interaction', 'app_session'])
  assert.deepEqual(Object.keys(caso.registrados[1]).sort(), ['action_name', 'event', 'id', 'interaction_id', 'module', 'screen', 'ts'])
  assert.equal(caso.registrados[1].ts, '2023-11-14T22:13:20.000Z')
  assert.doesNotMatch(JSON.stringify(caso.registrados), /https?:|persona|5bd287ad|superadmin|\/admin/)
  caso.servicio.consentimiento('aceptado')
  assert.equal(caso.registrados.length, 3)
  assert.equal(caso.datos.filter(d => d.event === 'app_page_view').length, 1)
  caso.servicio.interaccion('usuarios.nuevo', 'click')
  assert.equal(caso.registrados.length, 4)
  assert.equal(caso.datos.filter(d => d.event === 'app_interaction').length, 1)
  caso.servicio.consentimiento('rechazado')
  caso.servicio.interaccion('usuarios.nuevo', 'click')
  assert.equal(caso.registrados.length, 5)
  assert.equal(caso.datos.filter(d => d.event === 'app_interaction').length, 1)
})

probar('Registro propio: sin sesión autenticada no registra y valores inválidos se descartan', () => {
  const { aEventoUso } = cargarTypeScript(rutaServicio)
  assert.equal(aEventoUso({ event: 'app_interaction', interaction_id: 'Mayuscula con espacio', timestamp_ms: 1 }), null)
  const evento = aEventoUso({ event: 'app_page_view', screen: 'x'.repeat(81), module: 'm', timestamp_ms: 1 })
  assert.equal(evento.screen, undefined)
  assert.equal(evento.module, 'm')
  assert.equal(aEventoUso({ event: 'app_export', export_id: 'personas_excel', outcome: 'failure', action_name: 'exportar', timestamp_ms: 1 }).action_name, 'exportar_fallida')
  const publico = []
  const servicio = crearServicioAnalitica({
    produccion: true, version: 'v', base: '/', origen: 'https://hitss.test', referenteInicial: '',
    ahora: () => 0, reloj: () => 0, aleatorio: () => 'op', visible: () => true,
    obtenerIdentidad: () => null, enviar: () => {}, registrar: e => publico.push(e),
  })
  servicio.navegar('/login')
  assert.equal(publico.length, 0)
})

const { crearRegistroUso, LOTE_MAXIMO, UMBRAL_ENVIO, INTERVALO_ENVIO_MS, COLA_MAXIMA } = cargarTypeScript(
  new URL('../src/analitica/registro.ts', import.meta.url))

function prepararCola({ estados = [], token = true } = {}) {
  const envios = []
  const temporizadores = new Map()
  let siguiente = 0
  const estadoEntorno = { aplicacion: 'app-a', sesion: token ? 'u1.t1' : null }
  const cola = crearRegistroUso({
    aplicacionActual: () => estadoEntorno.aplicacion,
    sesionActual: () => estadoEntorno.sesion,
    programar: accion => { temporizadores.set(++siguiente, accion); return siguiente },
    cancelar: id => temporizadores.delete(id),
    enviar: async (eventos, keepalive, aplicacion) => {
      envios.push({ eventos, keepalive, aplicacion })
      const estado = estados.shift() ?? 202
      if (estado === 'red') throw new Error('sin red')
      return estado
    },
  })
  const evento = n => ({ event: 'app_page_view', ts: new Date(n).toISOString() })
  return { cola, envios, temporizadores, evento, estadoEntorno,
    disparar: async () => { const acciones = [...temporizadores.values()]; temporizadores.clear(); acciones.forEach(a => a()); await new Promise(r => setImmediate(r)) } }
}

await probarAsync('Cola: lote por umbral y por tiempo, máximo 50, pagehide con keepalive', async () => {
  const c = prepararCola()
  for (let i = 0; i < UMBRAL_ENVIO - 1; i++) c.cola.agregar(c.evento(i))
  assert.equal(c.envios.length, 0)
  assert.equal(c.temporizadores.size, 1)
  c.cola.agregar(c.evento(99))
  assert.equal(c.envios.length, 1)
  assert.equal(c.envios[0].eventos.length, UMBRAL_ENVIO)
  assert.equal(c.envios[0].keepalive, false)
  const t = prepararCola()
  t.cola.agregar(t.evento(1))
  await t.disparar()
  assert.equal(t.envios.length, 1)
  assert.equal(INTERVALO_ENVIO_MS, 10000)
  const u = prepararCola()
  for (let i = 0; i < 120; i++) u.cola.agregar(u.evento(i))
  await u.cola.vaciar(true)
  assert.ok(u.envios.every(e => e.eventos.length <= LOTE_MAXIMO))
  assert.ok(u.envios.some(e => e.keepalive))
  assert.equal(u.cola.pendientes(), 0)
  assert.ok(LOTE_MAXIMO <= 50 && COLA_MAXIMA >= 50)
})

await probarAsync('Cola: fallos de red/5xx reintentan una vez; 4xx/429 y sin token descartan; nunca lanza', async () => {
  const red = prepararCola({ estados: ['red', 'red', 'red'] })
  red.cola.agregar(red.evento(1))
  await red.disparar()
  assert.equal(red.cola.pendientes(), 1)
  await red.disparar()
  assert.equal(red.cola.pendientes(), 0)
  await red.disparar()
  assert.equal(red.envios.length, 2)
  for (const estado of [429, 422, 401]) {
    const c = prepararCola({ estados: [estado] })
    c.cola.agregar(c.evento(1))
    await c.disparar()
    assert.equal(c.cola.pendientes(), 0)
    assert.equal(c.envios.length, 1)
  }
  const sin = prepararCola({ token: false })
  sin.cola.agregar(sin.evento(1))
  await sin.disparar()
  assert.equal(sin.envios.length, 0)
  assert.equal(sin.cola.pendientes(), 0)
})

await probarAsync('Cola: cambio de app con cola pendiente atribuye cada evento a su aplicación', async () => {
  const c = prepararCola()
  c.cola.agregar(c.evento(1))
  c.cola.agregar(c.evento(2))
  c.estadoEntorno.aplicacion = 'app-b'
  c.cola.agregar(c.evento(3))
  await c.cola.vaciar(true)
  await new Promise(r => setImmediate(r))
  assert.deepEqual(c.envios.map(e => [e.aplicacion, e.eventos.length]), [['app-a', 2], ['app-b', 1]])
  assert.ok(c.envios.every(e => e.keepalive))
  // Envío no urgente: también un POST por aplicación.
  const n = prepararCola()
  n.cola.agregar(n.evento(1))
  n.estadoEntorno.aplicacion = '__todas__'
  n.cola.agregar(n.evento(2))
  await n.disparar()
  assert.deepEqual(n.envios.map(e => e.aplicacion), ['app-a', '__todas__'])
})

await probarAsync('Cola: cambio de usuario/token (también otra pestaña) descarta sin reatribuir', async () => {
  const c = prepararCola()
  c.cola.agregar(c.evento(1))
  c.estadoEntorno.sesion = 'u2.t2'
  c.cola.agregar(c.evento(2))
  await c.cola.vaciar(true)
  await new Promise(r => setImmediate(r))
  assert.equal(c.envios.length, 1)
  assert.equal(c.envios[0].eventos.length, 1)
  assert.equal(c.envios[0].eventos[0].ts, new Date(2).toISOString())
  const d = prepararCola()
  d.cola.agregar(d.evento(1))
  d.estadoEntorno.sesion = 'u1.t-otro'
  await d.disparar()
  assert.equal(d.envios.length, 0)
  assert.equal(d.cola.pendientes(), 0)
})

probar('Id por evento, duracion_ms acotado y sin consentimiento no hay dataLayer pero sí registro', () => {
  const caso = prepararConRegistro()
  caso.servicio.interaccion('usuarios.nuevo', 'click')
  caso.servicio.sesion('session_start')
  assert.equal(caso.datos.length, 0)
  assert.ok(caso.registrados.length >= 3)
  const ids = caso.registrados.map(e => e.id)
  assert.ok(ids.every(id => typeof id === 'string' && /^[a-z0-9]{1,32}$/.test(id)))
  assert.equal(new Set(ids).size, ids.length)
  const { aEventoUso } = cargarTypeScript(rutaServicio)
  const base = { event: 'app_screen_engagement', timestamp_ms: 1, screen: 'x' }
  assert.equal(aEventoUso({ ...base, elapsed_ms: 1234.4 }).duracion_ms, 1234)
  assert.equal(aEventoUso({ ...base, elapsed_ms: 999_999_999 }).duracion_ms, 86_400_000)
  assert.equal(aEventoUso({ ...base, elapsed_ms: -5 }).duracion_ms, 0)
  assert.equal(aEventoUso({ ...base, elapsed_ms: null }).duracion_ms, undefined)
  assert.equal(aEventoUso({ event: 'app_form', form_id: 'usuario', elapsed_ms: 50, timestamp_ms: 1 }).duracion_ms, undefined)
  assert.equal(aEventoUso({ event: 'app_export', export_id: 'personas_excel', timestamp_ms: 1 }).interaction_id, 'personas_excel')
})

console.log(`${casos} casos conductuales completados; sin red ni datos enviados a Google.`)
