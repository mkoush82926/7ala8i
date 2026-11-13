'use client'

import { Suspense, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Lock, Mail, Users } from 'lucide-react'
import { login } from '@/app/[locale]/auth/actions'
import { useTranslation } from '@/hooks/use-translation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/ui/toast'
import { authErrorKey, isAuthErrorKey, isValidEmail, type AuthErrorKey } from '../auth-errors'
import { isInviteNext, safeNextPath } from '../safe-next'
import {
  AuthAlert,
  AuthCard,
  AuthField,
  AuthFootnote,
  AuthHeader,
  AuthShell,
  PasswordField,
  SubmitButton,
  TermsNotice,
} from '../_components/auth-shell'

function LoginForm() {
  const { t, locale, href } = useTranslation()
  const searchParams = useSearchParams()
  const next = safeNextPath(searchParams.get('next'), '')
  const fromInvite = isInviteNext(next)
  const callbackFailed = searchParams.get('error') === 'auth_callback_error'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  const emailError =
    touched.email && !email.trim()
      ? t.auth.fieldRequired
      : touched.email && !isValidEmail(email)
        ? t.auth.errors.invalidEmail
        : null
  const passwordError = touched.password && !password ? t.auth.fieldRequired : null

  async function handleSubmit(formData: FormData) {
    setTouched({ email: true, password: true })
    if (!email.trim() || !isValidEmail(email) || !password) {
      if (!email.trim() || !isValidEmail(email)) emailRef.current?.focus()
      return
    }
    setLoading(true)
    setErrorKey(null)
    try {
      const result = await login(formData)
      if (result?.error) {
        setErrorKey(isAuthErrorKey(result.error) ? result.error : 'generic')
        setLoading(false)
      }
    } catch (err) {
      // redirect() from the server action surfaces as a thrown NEXT_REDIRECT — let Next handle it.
      if (err && typeof err === 'object' && 'digest' in err && String((err as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) {
        throw err
      }
      setErrorKey('generic')
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!isValidEmail(email)) return
    setResending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/${locale}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}` },
      })
      if (error) toast.error(t.auth.errors[authErrorKey(error)])
      else toast.success(t.auth.emailResent)
    } catch {
      toast.error(t.auth.errors.generic)
    } finally {
      setResending(false)
    }
  }

  const signupHref = href(`/auth/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`)

  return (
    <AuthShell navLink={{ href: signupHref, label: t.auth.createAccount }}>
      <AuthCard>
        <AuthHeader title={t.auth.welcomeBack} subtitle={fromInvite ? t.auth.inviteSignInNotice : t.auth.signInToManage} />

        <form action={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="locale" value={locale} />

          {callbackFailed && !errorKey && <AuthAlert>{t.auth.callbackError}</AuthAlert>}
          {fromInvite && !errorKey && !callbackFailed && (
            <AuthAlert tone="info">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} aria-hidden="true" />
                {t.auth.inviteBanner}
              </span>
            </AuthAlert>
          )}

          <AuthField
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            label={t.auth.emailAddress}
            icon={Mail}
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            style={{ textAlign: 'start' }}
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, email: true }))}
            error={emailError}
            data-autofocus
          />

          <PasswordField
            id="password"
            name="password"
            label={t.auth.password}
            icon={Lock}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, password: true }))}
            error={passwordError}
            labelAside={
              <Link
                href={href('/auth/forgot-password')}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                {t.auth.forgotPassword}
              </Link>
            }
          />

          {errorKey && (
            <AuthAlert>
              {t.auth.errors[errorKey]}
              {errorKey === 'emailNotConfirmed' && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    {resending ? t.auth.resending : t.auth.resendEmail}
                  </button>
                </>
              )}
            </AuthAlert>
          )}

          <SubmitButton loading={loading} loadingLabel={t.auth.signingIn} style={{ marginTop: 4 }}>
            {t.auth.signInBtn}
          </SubmitButton>
        </form>

        <AuthFootnote text={t.auth.noAccount} linkLabel={t.auth.createAccount} linkHref={signupHref} />
      </AuthCard>

      <TermsNotice template={t.auth.termsNotice} />
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
