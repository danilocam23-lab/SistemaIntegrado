import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Boton, Campo } from '../components/ui'

const MODULOS = ['Requerimientos', 'Backlog', 'Asignaciones', 'Facturación', 'Soporte ANS']

export default function Login() {
  const { login } = useAuth()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const lienzoRef = useRef<HTMLCanvasElement>(null)

  async function enviar(e: FormEvent): Promise<void> {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await login(email, password)
      navegar('/dashboard')
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setCargando(false)
    }
  }

  // Motivo ambiental: barras horizontales translúcidas que derivan despacio y
  // evocan la carga de trabajo / backlog. Se detiene con prefers-reduced-motion.
  useEffect(() => {
    const lienzo = lienzoRef.current
    const ctx = lienzo?.getContext('2d')
    if (!lienzo || !ctx) return

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const barras = Array.from({ length: 16 }, (_, i) => ({
      fila: (i + 0.5) / 16,
      inicio: Math.random(),
      largo: 0.22 + Math.random() * 0.5,
      velocidad: 0.006 + Math.random() * 0.012,
    }))
    let ancho = 0
    let alto = 0
    let raf = 0

    function medir(): void {
      const dpr = window.devicePixelRatio || 1
      ancho = lienzo!.clientWidth
      alto = lienzo!.clientHeight
      lienzo!.width = Math.round(ancho * dpr)
      lienzo!.height = Math.round(alto * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function dibujar(segundos: number): void {
      ctx!.clearRect(0, 0, ancho, alto)
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.12)'
      for (const b of barras) {
        const avance = reducido ? b.inicio : (b.inicio + segundos * b.velocidad) % 1.4
        const x = (avance - 0.2) * ancho
        ctx!.beginPath()
        ctx!.roundRect(x, b.fila * alto - 4, b.largo * ancho, 8, 4)
        ctx!.fill()
      }
    }

    function bucle(ahora: number): void {
      dibujar(ahora / 1000)
      raf = requestAnimationFrame(bucle)
    }

    medir()
    const ro = new ResizeObserver(() => {
      medir()
      if (reducido) dibujar(0)
    })
    ro.observe(lienzo)

    if (reducido) dibujar(0)
    else raf = requestAnimationFrame(bucle)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      {/* Panel de marca */}
      <aside className="relative flex flex-col overflow-hidden bg-[linear-gradient(160deg,#0f3a6b_0%,#123a68_45%,#184c88_100%)] px-6 py-6 text-white md:w-[46%] md:px-10 md:py-12">
        <canvas
          ref={lienzoRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full opacity-50 md:block"
        />

        {/* Lockup */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-sm font-extrabold tracking-tight text-white">
            SI
          </div>
          <div className="leading-tight">
            <p className="font-bold text-white">Sistema Integrado</p>
            <p className="text-xs text-marca-200">HITSS · Plataforma unificada</p>
          </div>
        </div>

        {/* Bloque de valor (solo escritorio) */}
        <div className="relative z-10 mt-auto hidden md:block">
          <p className="text-2xs font-bold uppercase tracking-wider text-marca-200">EPM · HITSS</p>
          <h2 className="mt-3 max-w-[20ch] text-balance text-[1.625rem] font-bold leading-tight tracking-tight text-white">
            Requerimientos, capacidad, soporte y facturación en un solo lugar.
          </h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {MODULOS.map((modulo) => (
              <span
                key={modulo}
                className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs text-white"
              >
                {modulo}
              </span>
            ))}
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-marca-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Sesión segura
          </p>
        </div>
      </aside>

      {/* Columna de formulario */}
      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <form onSubmit={enviar} className="w-full max-w-[360px]">
          <h1 className="text-[1.3125rem] font-bold tracking-tight text-slate-900">Ingresar</h1>
          <p className="mt-1 text-sm text-slate-500">Usa tu cuenta corporativa HITSS.</p>

          {error && <div className="aviso aviso-error mt-4">{error}</div>}

          <div className="mt-5 space-y-4">
            <Campo
              etiqueta="Correo"
              type="email"
              autoComplete="username"
              placeholder="nombre@globalhitss.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Campo
              etiqueta="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Boton
            variante="primario"
            bloque
            type="submit"
            disabled={cargando}
            className="mt-6"
          >
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </Boton>

          <p className="mt-8 text-center text-xs text-slate-400">© HITSS · EPM</p>
        </form>
      </main>
    </div>
  )
}
