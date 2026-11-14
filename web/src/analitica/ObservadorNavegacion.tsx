import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { registrarRutaAnalitica } from './index'

export default function ObservadorNavegacion() {
  const { pathname } = useLocation()
  useEffect(() => { registrarRutaAnalitica(pathname) }, [pathname])
  return null
}
