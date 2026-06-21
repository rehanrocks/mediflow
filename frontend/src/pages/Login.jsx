/* src/pages/Login.jsx - Renders the polished public sign-in experience. */
import { useState } from 'react'
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Lock,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

function BrandMark() {
  return (
    <svg aria-hidden="true" className="h-9 w-9" fill="none" viewBox="0 0 36 36">
      <rect fill="white" height="36" rx="12" width="36" />
      <path
        d="M9 25V11L16 18.3L18 16.2L20 18.3L27 11V25H22.8V20.4L18 25L13.2 20.4V25H9Z"
        fill="#4338CA"
      />
    </svg>
  )
}

function LoginField({
  autoComplete,
  icon: Icon,
  id,
  label,
  onChange,
  placeholder,
  rightSlot,
  type,
  value,
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div>
      <label
        className={[
          'mb-1.5 block text-[13px] font-semibold transition-all duration-150',
          focused ? '-translate-y-0.5 text-brand' : 'text-ink',
        ].join(' ')}
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative">
        <Icon
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate"
        />
        <input
          autoComplete={autoComplete}
          className="w-full rounded-control border border-hairline bg-mist/60 py-3 pl-10 pr-11 text-[15px] font-normal text-ink outline-none transition-all duration-150 placeholder:text-slate/60 focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/30"
          id={id}
          name={id}
          onBlur={() => setFocused(false)}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          required
          type={type}
          value={value}
        />
        {rightSlot}
      </div>
    </div>
  )
}

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(username, password)
      navigate('/dashboard', { replace: true })
    } catch (loginError) {
      setError(
        loginError?.response?.data?.detail ||
          'We could not sign you in with those credentials.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-mist text-ink lg:grid-cols-[minmax(0,1fr)_minmax(500px,0.9fr)]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#4338CA] lg:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, rgba(129,140,248,0.18) 0%, transparent 70%)',
          }}
        />
        <div className="login-blob-a absolute left-14 top-24 h-48 w-48 rounded-full bg-brand-muted/20 blur-3xl" />
        <div className="login-blob-b absolute bottom-20 right-20 h-56 w-56 rounded-full bg-white/20 blur-3xl" />

        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <div className="flex flex-1 flex-col justify-center">
            <div className="animate-fade-up flex items-center gap-3">
              <BrandMark />
              <p className="text-3xl font-bold text-white">MediFlow</p>
            </div>
            <p
              className="mt-4 animate-fade-up text-base font-normal text-brand-muted"
              style={{ animationDelay: '0.1s' }}
            >
              Continuous care. Continuous clarity.
            </p>

            <div className="mt-10 space-y-3">
              {[
                'Real-time patient monitoring',
                'AI-powered clinical alerts',
                'HIPAA-compliant & encrypted',
              ].map((feature, index) => (
                <div
                  className="flex animate-fade-up items-center gap-2 text-sm font-normal text-white/70"
                  key={feature}
                  style={{ animationDelay: `${0.2 + index * 0.05}s` }}
                >
                  <Check aria-hidden="true" className="h-3.5 w-3.5 text-white" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div
            className="animate-fade-up rounded-2xl border border-white/20 bg-white/10 p-5 text-white backdrop-blur-md"
            style={{ animationDelay: '0.4s' }}
          >
            <p className="text-sm font-normal leading-6 text-white/80">
              "MediFlow reduced our missed follow-ups by 40% in 6 weeks."
            </p>
            <div className="mt-4">
              <p className="text-sm font-semibold text-white/80">Dana Teller</p>
              <p className="text-xs font-medium text-white/50">
                Downtown Clinic Operations
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
        <a
          className="absolute right-6 top-6 text-sm font-medium text-slate transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
          href="mailto:support@mediflow.local"
        >
          Need help?
        </a>

        <form
          className="w-full max-w-md animate-fade-up rounded-2xl bg-canvas p-8 shadow-card md:p-10"
          onSubmit={handleSubmit}
          style={{ animationDelay: '0.1s' }}
        >
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink">
            Welcome back
          </h1>
          <p className="mt-1 text-sm font-medium text-slate">
            Sign in to your MediFlow portal
          </p>

          <div className="mt-7 space-y-5">
            <LoginField
              autoComplete="username"
              icon={User}
              id="username"
              label="Username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              type="text"
              value={username}
            />

            <div>
              <LoginField
                autoComplete="current-password"
                icon={Lock}
                id="password"
                label="Password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                rightSlot={
                  <button
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                    onClick={() => setShowPassword((visible) => !visible)}
                    type="button"
                  >
                    <span className="sr-only">
                      {showPassword ? 'Hide password' : 'Show password'}
                    </span>
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                }
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <div className="mt-2 flex justify-end">
                <a
                  className="text-[13px] font-medium text-brand transition hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
                  href="mailto:support@mediflow.local"
                >
                  Forgot password?
                </a>
              </div>
            </div>
          </div>

          <button
            className="primary-button mt-5 flex w-full items-center justify-center rounded-control bg-brand py-3.5 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              'Sign in'
            )}
          </button>

          {error ? (
            <div className="mt-4 flex animate-fade-up items-start gap-2 rounded-full bg-status-cancelled-bg px-4 py-3 text-sm font-medium text-status-cancelled-text">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
        </form>
      </section>
    </main>
  )
}

export default Login
