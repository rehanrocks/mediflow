/* src/pages/ChangePassword.jsx - Forced first-login password setup. */
import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  User,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useToast } from '@shared/components/Toast'
import { useAuth } from '@shared/context/AuthContext'
import { getBackendError } from '@shared/lib/records'
import { changePassword } from '@shared/services/api'

function BrandMark() {
  return (
    <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 36 36">
      <rect fill="#EEF2FF" height="36" rx="12" width="36" />
      <path
        d="M9 25V11L16 18.3L18 16.2L20 18.3L27 11V25H22.8V20.4L18 25L13.2 20.4V25H9Z"
        fill="#4338CA"
      />
    </svg>
  )
}

function PasswordField({
  autoComplete,
  id,
  label,
  onBlur,
  onChange,
  onToggleVisibility,
  placeholder,
  showValue,
  value,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
      </span>
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className="w-full rounded-control border border-hairline bg-mist/60 py-3 pl-4 pr-11 text-[15px] font-normal text-ink outline-none transition-all duration-150 placeholder:text-slate/60 focus:border-brand focus:bg-canvas focus:ring-2 focus:ring-brand/30"
          id={id}
          name={id}
          onBlur={onBlur}
          onChange={onChange}
          placeholder={placeholder}
          type={showValue ? 'text' : 'password'}
          value={value}
        />
        <button
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
          onClick={onToggleVisibility}
          type="button"
        >
          <span className="sr-only">
            {showValue ? 'Hide password' : 'Show password'}
          </span>
          {showValue ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
    </label>
  )
}

function RuleRow({ met, text }) {
  const Icon = met ? Check : X

  return (
    <div className="flex items-center gap-2">
      <Icon
        aria-hidden="true"
        className={[
          'h-[13px] w-[13px]',
          met ? 'text-green-500' : 'text-slate/40',
        ].join(' ')}
      />
      <span
        className={[
          'text-[12px] font-normal',
          met ? 'text-green-600' : 'text-slate/60',
        ].join(' ')}
      >
        {text}
      </span>
    </div>
  )
}

export function ChangePassword() {
  const navigate = useNavigate()
  const toast = useToast()
  const { homePath, logout, markPasswordChangeComplete, user } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const signedInEmail = user?.email || user?.username || 'current account'
  const passwordRules = useMemo(
    () => [
      {
        met: newPassword.length >= 8,
        text: 'At least 8 characters',
      },
      {
        met: /[A-Z]/.test(newPassword),
        text: 'At least one uppercase letter',
      },
      {
        met: /\d/.test(newPassword),
        text: 'At least one number',
      },
      {
        met: /[!@#$%^&*]/.test(newPassword),
        text: 'At least one special character (!@#$%^&*)',
      },
    ],
    [newPassword],
  )
  const allRulesMet = passwordRules.every((rule) => rule.met)
  const passwordsMatch = Boolean(confirmPassword) && newPassword === confirmPassword
  const canSubmit = allRulesMet && passwordsMatch && !isSubmitting

  async function handleSubmit(event) {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await changePassword(newPassword, confirmPassword)
      markPasswordChangeComplete()
      toast.success('Password updated successfully. Welcome to MediFlow!')
      navigate(homePath(), { replace: true })
    } catch (changeError) {
      setError(getBackendError(changeError, 'Password could not be updated.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSignOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-5 py-10 text-ink">
      <form
        className="mx-auto w-full max-w-md animate-fade-up rounded-card bg-canvas p-8 shadow-card"
        onSubmit={handleSubmit}
      >
        <div className="mb-8 flex items-center justify-center gap-2">
          <BrandMark />
          <p className="text-center text-[20px] font-bold text-brand">MediFlow</p>
        </div>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
          <KeyRound aria-hidden="true" className="h-[26px] w-[26px] text-amber-500" />
        </div>

        <h1 className="text-center text-[24px] font-bold text-ink">
          Set Your Password
        </h1>
        <p className="mt-2 text-center text-[14px] font-normal text-slate">
          You're using a temporary password. Please create a new password to
          secure your account.
        </p>

        <div className="mt-7 space-y-5">
          <div>
            <PasswordField
              autoComplete="new-password"
              id="new-password"
              label="New Password"
              onChange={(event) => {
                setNewPassword(event.target.value)
                setError('')
              }}
              onToggleVisibility={() => setShowNewPassword((visible) => !visible)}
              placeholder="Create a secure password"
              showValue={showNewPassword}
              value={newPassword}
            />
            <div className="mt-3 space-y-1.5">
              {passwordRules.map((rule) => (
                <RuleRow key={rule.text} met={rule.met} text={rule.text} />
              ))}
            </div>
          </div>

          <div>
            <PasswordField
              autoComplete="new-password"
              id="confirm-password"
              label="Confirm New Password"
              onBlur={() => setConfirmTouched(true)}
              onChange={(event) => {
                setConfirmPassword(event.target.value)
                setError('')
              }}
              onToggleVisibility={() =>
                setShowConfirmPassword((visible) => !visible)
              }
              placeholder="Re-enter password"
              showValue={showConfirmPassword}
              value={confirmPassword}
            />
            {confirmTouched && confirmPassword ? (
              <div className="mt-2 flex items-center gap-1.5">
                {passwordsMatch ? (
                  <Check aria-hidden="true" className="h-[13px] w-[13px] text-green-500" />
                ) : (
                  <X aria-hidden="true" className="h-[13px] w-[13px] text-rose-500" />
                )}
                <p
                  className={[
                    'text-[12px] font-normal',
                    passwordsMatch ? 'text-green-600' : 'text-rose-500',
                  ].join(' ')}
                >
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-4 flex animate-fade-up items-start gap-2 rounded-control border border-rose-200 bg-rose-50 px-4 py-3">
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
            />
            <p className="text-[13px] font-medium text-rose-700">{error}</p>
          </div>
        ) : null}

        <button
          className="primary-button mt-5 flex w-full items-center justify-center rounded-control bg-brand py-3 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
          disabled={!canSubmit}
          type="submit"
        >
          {isSubmitting ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            'Set Password & Continue'
          )}
        </button>

        <div className="mt-4 flex items-center gap-2 rounded-control bg-mist px-3 py-2">
          <User aria-hidden="true" className="h-[13px] w-[13px] text-slate" />
          <p className="min-w-0 text-[12px] font-normal text-slate">
            Signed in as{' '}
            <span className="font-sans text-[12px] text-ink">{signedInEmail}</span>
          </p>
        </div>

        <button
          className="mx-auto mt-5 block text-[12px] font-normal text-slate transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2"
          onClick={handleSignOut}
          type="button"
        >
          Sign out and use a different account
        </button>
      </form>
    </main>
  )
}

export default ChangePassword
