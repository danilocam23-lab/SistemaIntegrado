import axios from 'axios'

export const TOKEN_KEY = 'si_token'
export const USUARIO_KEY = 'si_usuario'
export const APP_KEY = 'si_aplicacion'
export const CONSOLIDADO = '__todas__'

const client = axios.create({ baseURL: `${import.meta.env.BASE_URL}api` })

// Adjunta el token JWT y la aplicación activa a cada petición.
// Si la petición ya trae X-Aplicacion (ej. escrituras desde modo consolidado),
// se respeta ese valor y no se sobreescribe con el de localStorage.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (!config.headers['X-Aplicacion']) {
    const aplicacion = localStorage.getItem(APP_KEY)
    if (aplicacion) config.headers['X-Aplicacion'] = aplicacion
  }
  return config
})

// Los documentos Beanie llegan con `_id`; se expone también como `id`.
function normalizarIds(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(normalizarIds)
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const resultado: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      resultado[k] = normalizarIds(v)
    }
    if ('_id' in resultado && !('id' in resultado)) {
      resultado.id = resultado._id
    }
    return resultado
  }
  return data
}

client.interceptors.response.use(
  (resp) => {
    resp.data = normalizarIds(resp.data)
    return resp
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USUARIO_KEY)
      if (window.location.pathname !== `${import.meta.env.BASE_URL}login`) window.location.href = `${import.meta.env.BASE_URL}login`
    }
    return Promise.reject(error)
  },
)

export default client
