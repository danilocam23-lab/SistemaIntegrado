import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navegar = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={enviar} className="w-80 rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold text-marca-osc">Sistema Integrado</h1>
        <p className="mb-5 text-sm text-slate-500">HITSS — Plataforma unificada</p>
        {error && (
          <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
        )}
        <label className="mb-3 block text-sm">
          <span className="text-slate-600">Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="text-slate-600">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded bg-marca py-2 text-white hover:bg-marca-osc disabled:opacity-60"
        >
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
