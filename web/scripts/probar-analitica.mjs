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

probar('No enviar en dev, rechazo, sin decisión ni antes de aceptar; sin backlog', () => {
  for (const produccion of [false, true]) {
    const caso = preparar({ produccion })
    caso.servicio.navegar('/requerimientos')
    caso.servicio.interaccion('usuarios.nuevo', 'click')
    caso.servicio.sesion('login')
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
  assert.equal(caso.eventos('app_page_view').length, 2)
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
  caso.servicio.sesion('login')
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
  caso.servicio.sesion('logout')
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
    bloqueado.servicio.sesion('logout')
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
  for (const id of Object.keys(primero.catalogo)) assert.ok(id.length <= 100)
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
  for (const [ruta] of PANTALLAS) assert.ok(app.includes(`path="${ruta === '/login' ? ruta : ruta.slice(1)}"`), ruta)
  assert.equal(buscarPantalla('/actas'), undefined)
})

console.log(`${casos} casos conductuales completados; sin red ni datos enviados a Google.`)
