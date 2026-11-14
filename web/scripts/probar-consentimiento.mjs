// Prueba conductual sin navegador, red ni dependencias nuevas.
// Ejecutar desde web: node scripts/probar-consentimiento.mjs
import assert from 'node:assert/strict'
import { readFileSync as leerArchivo } from 'node:fs'
import { runInNewContext as ejecutarEnContexto } from 'node:vm'
import ts from 'typescript'
import { cargarTypeScript } from './cargar-typescript.mjs'

const fuente = leerArchivo(new URL('../src/analitica/consentimiento.ts', import.meta.url), 'utf8')
const compilado = ts.transpileModule(fuente, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText
const modulo = { exports: {} }
ejecutarEnContexto(compilado, { module: modulo, exports: modulo.exports, Date, Set })
const { crearGestorConsentimiento, CLAVE_CONSENTIMIENTO } = modulo.exports

function preparar({ produccion = true, guardado = null, falloLectura = false,
  falloEscritura = false, falloInsercion = false, falloRecarga = false } = {}) {
  const almacenamiento = new Map()
  if (guardado !== null) almacenamiento.set(CLAVE_CONSENTIMIENTO, guardado)
  const scripts = []
  const errores = []
  const ventana = {}
  const url = '/SistemaIntegrado/requerimientos/id-prueba?vista=detalle#seccion'
  let lecturas = 0
  let recargas = 0
  let rechazoAlRecargar = false
  const gestor = crearGestorConsentimiento({
    produccion,
    ventana,
    obtenerAlmacenamiento() {
      return {
        getItem(clave) {
          lecturas++
          if (falloLectura) throw new Error('Almacenamiento bloqueado')
          return almacenamiento.get(clave) ?? null
        },
        setItem(clave, valor) {
          if (falloEscritura) throw new Error('Almacenamiento bloqueado')
          almacenamiento.set(clave, valor)
        },
      }
    },
    documento: {
      createElement(etiqueta) {
        assert.equal(etiqueta, 'script')
        return {}
      },
      head: {
        appendChild(script) {
          if (falloInsercion) throw new Error('Inserción bloqueada')
          // Se intercepta la inserción: nunca se descarga ni ejecuta GTM.
          scripts.push(script)
          return script
        },
      },
    },
    recargar() {
      if (falloRecarga) throw new Error('Recarga bloqueada')
      rechazoAlRecargar = JSON.parse(almacenamiento.get(CLAVE_CONSENTIMIENTO)).decision === 'rechazado'
      recargas++
    },
    registrarError: mensaje => errores.push(mensaje),
  })
  return {
    gestor, scripts, errores, ventana, almacenamiento,
    obtenerRecargas: () => recargas,
    obtenerLecturas: () => lecturas,
    rechazoAlRecargar: () => rechazoAlRecargar,
    obtenerUrl: () => url,
  }
}

let casos = 0
function probar(nombre, prueba) {
  prueba()
  casos++
  console.log(`OK: ${nombre}`)
}

probar('Desarrollo: ni lectura de permiso ni carga, incluso al aceptar', () => {
  const caso = preparar({ produccion: false })
  caso.gestor.iniciar()
  assert.equal(caso.gestor.decidir('aceptado'), false)
  assert.equal(caso.obtenerLecturas(), 0)
  assert.equal(caso.scripts.length, 0)
  assert.equal(caso.ventana.dataLayer, undefined)
})

probar('Producción: iniciar/mostrar sin permiso no inserta script ni cola', () => {
  const caso = preparar()
  caso.gestor.iniciar()
  assert.equal(caso.gestor.obtenerEstado().decision, null)
  assert.equal(caso.scripts.length, 0)
  assert.equal(caso.ventana.dataLayer, undefined)
})

probar('Rechazo explícito persistido y nueva visita sin carga', () => {
  const caso = preparar()
  caso.gestor.iniciar()
  assert.equal(caso.gestor.decidir('rechazado'), true)
  const guardado = caso.almacenamiento.get(CLAVE_CONSENTIMIENTO)
  assert.deepEqual(JSON.parse(guardado), { version: 1, decision: 'rechazado' })
  const visita = preparar({ guardado })
  visita.gestor.iniciar()
  assert.equal(visita.gestor.obtenerEstado().decision, 'rechazado')
  assert.equal(caso.scripts.length + visita.scripts.length, 0)
  assert.equal(caso.obtenerRecargas(), 0)
})

probar('Aceptación: bootstrap exacto, async, sin referrer, carga única y remontajes', () => {
  const caso = preparar()
  let notificaciones = 0
  const cancelar = caso.gestor.suscribir(() => { notificaciones++ })
  caso.gestor.iniciar()
  assert.equal(caso.gestor.decidir('aceptado'), true)
  caso.gestor.iniciar()
  cancelar()
  const cancelarOtra = caso.gestor.suscribir(() => { notificaciones++ })
  caso.gestor.iniciar()
  caso.gestor.decidir('aceptado')
  assert.equal(caso.scripts.length, 1)
  assert.equal(caso.obtenerLecturas(), 1)
  assert.equal(caso.scripts[0].src, 'https://www.googletagmanager.com/gtm.js?id=GTM-W86DRFZ3')
  assert.equal(caso.scripts[0].async, true)
  assert.equal(caso.scripts[0].referrerPolicy, 'no-referrer')
  assert.equal(caso.ventana.dataLayer.length, 1)
  const evento = caso.ventana.dataLayer[0]
  assert.equal(evento.event, 'gtm.js')
  assert.equal(typeof evento['gtm.start'], 'number')
  assert.deepEqual(Object.keys(evento).sort(), ['event', 'gtm.start'])
  caso.scripts[0].onload()
  assert.equal(caso.gestor.obtenerEstado().carga, 'cargado')
  assert.ok(notificaciones > 0)
  cancelarOtra()
})

probar('Aceptación guardada permite una carga en la nueva visita', () => {
  const caso = preparar()
  caso.gestor.decidir('aceptado')
  const visita = preparar({ guardado: caso.almacenamiento.get(CLAVE_CONSENTIMIENTO) })
  visita.gestor.iniciar()
  visita.gestor.iniciar()
  assert.equal(visita.gestor.obtenerEstado().decision, 'aceptado')
  assert.equal(visita.scripts.length, 1)
})

probar('Retirada durante carga: guarda rechazo antes de recargar y conserva URL', () => {
  const caso = preparar()
  caso.gestor.iniciar()
  caso.gestor.decidir('aceptado')
  const urlAnterior = caso.obtenerUrl()
  caso.gestor.decidir('rechazado')
  assert.equal(caso.obtenerRecargas(), 1)
  assert.equal(caso.rechazoAlRecargar(), true)
  assert.equal(caso.obtenerUrl(), urlAnterior)
  const visita = preparar({ guardado: caso.almacenamiento.get(CLAVE_CONSENTIMIENTO) })
  visita.gestor.iniciar()
  assert.equal(visita.scripts.length, 0)
})

probar('Retirada después de carga también recarga; no simula apagar quitando script', () => {
  const caso = preparar()
  caso.gestor.decidir('aceptado')
  caso.scripts[0].onload()
  caso.gestor.decidir('rechazado')
  assert.equal(caso.obtenerRecargas(), 1)
  assert.equal(caso.scripts.length, 1)
})

probar('Permiso corrupto, antiguo o desconocido: falla cerrado con error explícito', () => {
  for (const guardado of ['{', 'null', '{"version":0,"decision":"aceptado"}',
    '{"version":1,"decision":"otra"}', '"aceptado"']) {
    const caso = preparar({ guardado })
    caso.gestor.iniciar()
    assert.equal(caso.gestor.obtenerEstado().decision, null)
    assert.equal(caso.scripts.length, 0)
    assert.equal(caso.errores.length, 1)
    assert.ok(caso.gestor.obtenerEstado().error)
  }
})

probar('Lectura bloqueada: sin carga ni consentimiento implícito', () => {
  const caso = preparar({ falloLectura: true })
  caso.gestor.iniciar()
  assert.equal(caso.scripts.length, 0)
  assert.equal(caso.gestor.obtenerEstado().decision, null)
  assert.equal(caso.errores.length, 1)
})

probar('Escritura bloqueada: ni aceptar ni rechazar activa GTM', () => {
  const caso = preparar({ falloEscritura: true })
  caso.gestor.iniciar()
  assert.equal(caso.gestor.decidir('aceptado'), false)
  assert.equal(caso.gestor.decidir('rechazado'), false)
  assert.equal(caso.scripts.length, 0)
  assert.equal(caso.gestor.obtenerEstado().decision, null)
  assert.equal(caso.errores.length, 2)
})

probar('Retirada que no se puede persistir: avisa, no recarga con aceptación guardada', () => {
  const caso = preparar({
    guardado: '{"version":1,"decision":"aceptado"}', falloEscritura: true,
  })
  caso.gestor.iniciar()
  assert.equal(caso.gestor.decidir('rechazado'), false)
  assert.equal(caso.obtenerRecargas(), 0)
  assert.equal(caso.gestor.obtenerEstado().decision, 'aceptado')
  assert.match(caso.gestor.obtenerEstado().error, /cierre esta página/)
})

probar('Error de script: visible, registrado, sin reintentos duplicados', () => {
  const caso = preparar()
  caso.gestor.decidir('aceptado')
  caso.scripts[0].onerror()
  assert.equal(caso.gestor.obtenerEstado().carga, 'error')
  assert.equal(caso.errores.length, 1)
  caso.gestor.iniciar()
  caso.gestor.decidir('aceptado')
  assert.equal(caso.scripts.length, 1)
  assert.ok(caso.gestor.obtenerEstado().error)
})

probar('Error de inserción: visible y sin nuevos intentos', () => {
  const caso = preparar({ falloInsercion: true })
  caso.gestor.decidir('aceptado')
  caso.gestor.decidir('aceptado')
  assert.equal(caso.gestor.obtenerEstado().carga, 'error')
  assert.equal(caso.errores.length, 1)
})

probar('Error de recarga: conserva rechazo y pide recargar/cerrar explícitamente', () => {
  const caso = preparar({ falloRecarga: true })
  caso.gestor.decidir('aceptado')
  caso.gestor.decidir('rechazado')
  assert.equal(JSON.parse(caso.almacenamiento.get(CLAVE_CONSENTIMIENTO)).decision, 'rechazado')
  assert.match(caso.gestor.obtenerEstado().error, /Recargue o cierre/)
})

probar('Bootstrap conserva una cola preexistente', () => {
  const caso = preparar()
  const cola = [{ event: 'evento-local-prueba' }]
  caso.ventana.dataLayer = cola
  caso.gestor.decidir('aceptado')
  assert.equal(caso.ventana.dataLayer, cola)
  assert.equal(cola.length, 2)
})

probar('Servicio compartido: vista sanitizada primero, aceptación/remontajes sin backlog ni duplicados', () => {
  const caso = preparar()
  const { crearServicioAnalitica } = cargarTypeScript(new URL('../src/analitica/servicio.ts', import.meta.url))
  const servicio = crearServicioAnalitica({
    produccion: true, version: 'prueba', base: '/SistemaIntegrado/', origen: 'https://hitss.test',
    referenteInicial: 'https://origen.test/privado?correo=secreto', ahora: () => 0, reloj: () => 0,
    aleatorio: () => 'op-prueba', visible: () => true,
    obtenerIdentidad: () => ({
      id_analitico: '5bd287ad-3e70-40df-a905-6173db77382a', rol: 'viewer',
    }),
    enviar(datos) { caso.ventana.dataLayer ??= []; caso.ventana.dataLayer.push(datos) },
  })
  servicio.navegar('/requerimientos/recurso-secreto?email=privado#token')
  servicio.interaccion('usuarios.nuevo', 'click')
  caso.gestor.suscribir(() => servicio.consentimiento(caso.gestor.obtenerEstado().decision))
  caso.gestor.iniciar()
  caso.gestor.decidir('aceptado')
  caso.gestor.iniciar()
  caso.gestor.decidir('aceptado')
  caso.scripts[0].onload()
  const eventos = caso.ventana.dataLayer.filter(dato => dato.event)
  assert.equal(eventos[0].event, 'app_page_view')
  assert.equal(eventos[0].page_location, 'https://hitss.test/SistemaIntegrado/requerimientos/:reqId')
  assert.equal(eventos.filter(dato => dato.event === 'app_page_view').length, 1)
  assert.equal(caso.scripts.length, 1)
  assert.doesNotMatch(JSON.stringify(caso.ventana.dataLayer), /recurso-secreto|email=|correo=|#token/)
  caso.gestor.decidir('rechazado')
  const cantidad = caso.ventana.dataLayer.length
  servicio.interaccion('usuarios.nuevo', 'click')
  assert.equal(caso.ventana.dataLayer.length, cantidad)
  assert.equal(caso.ventana.dataLayer.at(-1).user_id, null)
})

console.log(`${casos} casos conductuales completados; GTM nunca se descarga.`)
