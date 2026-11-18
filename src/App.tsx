import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import './App.css'

const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })))
const Workspace = lazy(() => import('./pages/Workspace').then((module) => ({ default: module.Workspace })))

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ROOMIE view failed to render', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return <main className="fatal-error"><div className="brand"><span className="brand-mark">r</span>roomie<span className="brand-dot">.</span></div><h1>We hit a small bump.</h1><p>Your data is safe. Refresh the page or head back home.</p><Link className="button button-lime" to="/">Back to ROOMIE</Link></main>
    }
    return this.props.children
  }
}

function SafetyPage() {
  return <main className="legal-page"><Link to="/" className="brand"><span className="brand-mark">r</span>roomie<span className="brand-dot">.</span></Link><span className="section-kicker">YOUR SAFETY MATTERS</span><h1>Meet with care.</h1><p>Take your time getting to know someone before deciding to meet. Keep your early conversations on ROOMIE, and never feel pressured to share personal information.</p><ol><li><strong>Chat first.</strong> Learn more about each other’s plans and expectations before meeting.</li><li><strong>Meet somewhere public.</strong> Choose a busy, familiar location for your first meeting.</li><li><strong>Tell someone you trust.</strong> Share your plans and location with a friend or family member.</li><li><strong>Trust your instincts.</strong> You can stop a conversation, block a profile, or report a concern at any time.</li></ol><p>For immediate danger, contact your local emergency services. ROOMIE is not an emergency service.</p><Link to="/" className="text-link">← Back home</Link></main>
}

function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  return <main className="legal-page"><Link to="/" className="brand"><span className="brand-mark">r</span>roomie<span className="brand-dot">.</span></Link><span className="section-kicker">ROOMIE COMMUNITY</span><h1>{kind === 'privacy' ? 'Privacy, by design.' : 'A few ground rules.'}</h1>{kind === 'privacy' ? <><p>ROOMIE stores account and profile information in Supabase to provide matching, messaging, and listing features. Your information is available only as described by your profile visibility and our database access policies.</p><p>We do not expose private chat messages to other users. You can hide your profile in Settings. Use the support contact published by your ROOMIE deployment administrator for account deletion or privacy requests.</p></> : <><p>ROOMIE helps adults find flatmates and accommodation. You must be at least 18 to create a matching profile. Keep your account secure and provide information that is accurate and respectful.</p><p>Do not use ROOMIE to harass, discriminate, mislead, or share unlawful content. You are responsible for independently checking accommodation and meeting safely before making arrangements.</p></>}<p>This is a starter policy summary and should be reviewed and completed for your jurisdiction before public launch.</p><Link to="/" className="text-link">← Back home</Link></main>
}

export default function App() {
  return <AppErrorBoundary><BrowserRouter><AuthProvider><Suspense fallback={<div className="loading-screen">Getting ROOMIE ready…</div>}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/signup" element={<AuthPage />} />
    <Route path="/reset" element={<AuthPage />} />
    <Route path="/safety" element={<SafetyPage />} />
    <Route path="/privacy" element={<LegalPage kind="privacy" />} />
    <Route path="/terms" element={<LegalPage kind="terms" />} />
    <Route element={<ProtectedRoute />}><Route path="/app/*" element={<Workspace />} /><Route path="/discover" element={<Navigate to="/app/discover" replace />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></AuthProvider></BrowserRouter></AppErrorBoundary>
}
