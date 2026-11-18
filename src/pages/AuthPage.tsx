import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const schema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').optional(),
  email: z.email('Enter a valid email address').optional(),
  password: z.string().min(8, 'Use at least 8 characters').optional(),
  age: z.preprocess((value) => value === '' || value == null ? undefined : Number(value), z.number().int().min(18, 'You must be 18 or older').optional()),
  adult: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mode: routeMode } = useParams()
  const mode = routeMode ?? (location.pathname === '/signup' ? 'signup' : location.pathname === '/reset' ? 'reset' : 'login')
  const isSignup = mode === 'signup'
  const isReset = mode === 'reset'
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [recovery, setRecovery] = useState(() => window.location.hash.includes('type=recovery'))
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  const { register, handleSubmit, formState: { errors } } = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { adult: false },
  })

  const submit = handleSubmit(async (values) => {
    setError(''); setMessage('')
    if (!supabase || !isSupabaseConfigured) { setError('Connect Supabase to enable secure accounts. See the setup guide in README.'); return }
    if (isSignup && !values.adult) { setError('Please confirm that you are 18 or older.'); return }
    setBusy(true)
    try {
      if ((!isReset || !recovery) && !values.email) { setError('Enter your email address.'); return }
      if (isSignup && (!values.name?.trim() || values.name.trim().length < 2 || !values.age || values.age < 18)) {
        setError('Enter your name and confirm that you are 18 or older.')
        return
      }
      if ((!isReset || recovery) && (!values.password || values.password.length < 8)) {
        setError('Use a password with at least 8 characters.')
        return
      }
        if (isReset && recovery) {
          const { error: authError } = await supabase.auth.updateUser({ password: values.password! })
          if (authError) throw authError
          setMessage('Your password has been updated. You can now log in.')
        } else if (isReset) {
          const { error: authError } = await supabase.auth.resetPasswordForEmail(values.email!, { redirectTo: `${window.location.origin}/reset` })
          if (authError) throw authError
          setMessage('If an account exists for that address, a reset link is on its way.')
        } else if (isSignup) {
          const { error: authError } = await supabase.auth.signUp({
            email: values.email!,
          password: values.password!,
          options: { data: { full_name: values.name, age: values.age, accepted_18_at: new Date().toISOString() } },
        })
        if (authError) throw authError
        setMessage('Check your email to verify your account, then come back to log in.')
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: values.email!, password: values.password! })
        if (authError) throw authError
        const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/app'
        navigate(destination, { replace: true })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally { setBusy(false) }
  })

  return <main className="auth-page"><Link to="/" className="brand auth-brand"><span className="brand-mark">r</span>roomie<span className="brand-dot">.</span></Link><Link to="/" className="auth-back"><ArrowLeft size={16} /> Back home</Link>
    <section className="auth-card"><div className="section-kicker">{isSignup ? 'A BETTER FLATSHARE STARTS HERE' : isReset ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'}</div><h1>{isSignup ? 'Find your people.' : isReset ? recovery ? 'Choose a new password.' : 'Reset your password.' : 'Good to see you.'}</h1><p className="auth-lede">{isSignup ? 'Create your account and start finding your kind of home.' : isReset ? recovery ? 'Set a new password for your ROOMIE account.' : 'We’ll send a secure reset link to your email.' : 'Log in to pick up where you left off.'}</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        {isSignup && <><label>Your name<input autoComplete="name" placeholder="How should we call you?" {...register('name')} />{errors.name && <small className="field-error">{errors.name.message}</small>}</label><label>Age<input type="number" min="18" placeholder="18+" {...register('age')} />{errors.age && <small className="field-error">{errors.age.message}</small>}</label></>}
        {(!isReset || !recovery) && <label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />{errors.email && <small className="field-error">{errors.email.message}</small>}</label>}
        {(!isReset || recovery) && <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={isSignup || recovery ? 'new-password' : 'current-password'} placeholder="At least 8 characters" {...register('password')} /><button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <small className="field-error">{errors.password.message}</small>}</label>}
        {isSignup && <label className="check-label"><input type="checkbox" {...register('adult')} /><span>I confirm that I am 18 years of age or older.</span></label>}
        {error && <div role="alert" className="form-message form-error">{error}</div>}{message && <div role="status" className="form-message form-success">{message}</div>}
        <button className="button button-lime auth-submit" disabled={busy}>{busy ? 'Please wait…' : isSignup ? 'Create account' : isReset ? recovery ? 'Update password' : 'Send reset link' : 'Log in'} <span>→</span></button>
      </form>
      {!isSignup && !isReset && <Link className="forgot-link" to="/reset">Forgot your password?</Link>}
      <div className="auth-switch">{isSignup ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New to ROOMIE? <Link to="/signup">Create an account</Link></>}</div>
    </section><p className="auth-footnote">By continuing, you agree to use ROOMIE respectfully and keep safety in mind.</p>
  </main>
}
