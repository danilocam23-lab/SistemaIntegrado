import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AplicacionProvider } from './context/AplicacionContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import DashboardRequerimientos from './pages/DashboardRequerimientos'
import AdminAplicaciones from './pages/AdminAplicaciones'
import Usuarios from './pages/Usuarios'
import Requerimientos from './pages/Requerimientos'
import RequerimientoDetalle from './pages/RequerimientoDetalle'
import RequerimientoNuevo from './pages/RequerimientoNuevo'
import Personas from './pages/Personas'
import Asignaciones from './pages/Asignaciones'
import Capacidades from './pages/Capacidades'
import Roadmap from './pages/Roadmap'
import Estimaciones from './pages/Estimaciones'
import AzureDevOps from './pages/AzureDevOps'
import Configuracion from './pages/Configuracion'
import Cifras from './pages/Cifras'
import EntregasActas from './pages/EntregasActas'
import DashboardEstados from './pages/DashboardEstados'
import DashboardSquad from './pages/DashboardSquad'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AplicacionProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardRequerimientos />} />
              <Route path="dashboard-estados" element={<DashboardEstados />} />
              <Route path="dashboard-squad" element={<DashboardSquad />} />
              <Route path="requerimientos" element={<Requerimientos />} />
              <Route path="requerimientos/nuevo" element={<RequerimientoNuevo />} />
              <Route path="requerimientos/:reqId" element={<RequerimientoDetalle />} />
              <Route path="entregas-actas" element={<EntregasActas />} />
              <Route path="tarifas" element={<Navigate to="/configuracion" replace />} />
              <Route path="personas" element={<Personas />} />
              <Route path="categorias" element={<Navigate to="/configuracion" replace />} />
              <Route path="asignaciones" element={<Asignaciones />} />
              <Route path="capacidades" element={<Capacidades />} />
              <Route path="roadmap" element={<Roadmap />} />
              <Route path="estimaciones" element={<Estimaciones />} />
              <Route path="azure-devops" element={<AzureDevOps />} />
              <Route path="configuracion" element={<RoleRoute soloSuperadmin><Configuracion /></RoleRoute>} />
              <Route path="cifras" element={<Cifras />} />
              <Route
                path="admin/aplicaciones"
                element={<RoleRoute soloSuperadmin><AdminAplicaciones /></RoleRoute>}
              />
              <Route path="admin/usuarios" element={<RoleRoute><Usuarios /></RoleRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AplicacionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
