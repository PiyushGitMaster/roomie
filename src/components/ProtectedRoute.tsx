import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="loading-screen">Getting your room ready…</div>
  return user ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />
}
