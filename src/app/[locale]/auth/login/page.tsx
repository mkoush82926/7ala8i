'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from '@/app/[locale]/auth/actions'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslation, headingTracking } from '@/hooks/use-translation'

function LoginForm() {
  const { t, FF, FFD, dir, isRTL } = useTranslation()
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error') === 'auth_callback_error'
    ? (isRTL
        ? 'انتهت صلاحية رابط التأكيد أو أنه غير صالح. الرجاء إنشاء حساب من جديد أو طلب رابط جديد.'
        : 'Your confirmation link expired or is invalid. Please sign up again or request a new one.')
    : null

  const [error, setError] = useState<string | null>(callbackError)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f1e4',
        fontFamily: FF,
        direction: dir,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10 }}>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ textAlign: 'center', marginBottom: 32 }}
        >
          <Link
            href="/landing"
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: '#1c1611',
              textDecoration: 'none',
              letterSpacing: '0.016em',
              fontFamily: "var(--font-intervar),sans-serif",
            }}
          >
            Halaqy.
          </Link>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '40px 36px',
            border: '1px solid #ede3cd',
          }}
        >
          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: '#1c1611',
                letterSpacing: headingTracking(isRTL, '0.014em'),
                marginBottom: 6,
                fontFamily: FFD,
              }}
            >
              {t.auth.welcomeBack}
            </h1>
            <p style={{ color: '#5a5147', fontSize: 14, fontWeight: 500 }}>
              {t.auth.signInToManage}
            </p>
          </div>

          {/* Form */}
          <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor="email"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: headingTracking(isRTL, '0.08em'),
                  color: '#5a5147',
                }}
              >
                {t.auth.emailAddress}
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 18,
                    color: '#5a5147',
                    pointerEvents: 'none',
                  }}
                >
                  mail
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@domain.com"
                  style={{
                    width: '100%',
                    height: 52,
                    paddingLeft: 44,
                    paddingRight: 16,
                    background: '#ffffff',
                    border: '1.5px solid #ede3cd',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#1c1611',
                    outline: 'none',
                    transition: 'all 150ms ease',
                    fontFamily: FF,
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#a67c3d'
                    e.target.style.boxShadow = 'var(--shadow-focus)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#ede3cd'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label
                  htmlFor="password"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: headingTracking(isRTL, '0.08em'),
                    color: '#5a5147',
                  }}
                >
                  {t.auth.password}
                </label>
                <Link
                  href="/auth/forgot-password"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#5a5147',
                    textDecoration: 'none',
                  }}
                >
                  {t.auth.forgotPassword}
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 18,
                    color: '#5a5147',
                    pointerEvents: 'none',
                  }}
                >
                  lock
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    height: 52,
                    paddingLeft: 44,
                    paddingRight: 46,
                    background: '#ffffff',
                    border: '1.5px solid #ede3cd',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#1c1611',
                    outline: 'none',
                    transition: 'all 150ms ease',
                    fontFamily: FF,
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#a67c3d'
                    e.target.style.boxShadow = 'var(--shadow-focus)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#ede3cd'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#a89e8c',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="error-shake"
                style={{
                  padding: '12px 16px',
                  background: 'rgba(186,26,26,0.06)',
                  border: '1px solid rgba(186,26,26,0.2)',
                  borderRadius: 12,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: '#ba1a1a', fontVariationSettings: "'FILL' 1" }}>
                  error
                </span>
                <p style={{ color: '#ba1a1a', fontSize: 13, fontWeight: 500 }}>{error}</p>
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                width: '100%',
                height: 52,
                background: '#7c4a1e',
                opacity: loading ? 0.7 : 1,
                color: '#fff',
                borderRadius: 8,
                border: 'none',
                fontFamily: FF,
                fontWeight: 700,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.opacity = '0.92'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  e.currentTarget.style.opacity = '1'
                  e.currentTarget.style.transform = 'none'
                }
              }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }}
                  />
                  {t.auth.signingIn}
                </>
              ) : (
                <>
                  {t.auth.signInBtn}
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{dir === 'rtl' ? 'arrow_back' : 'arrow_forward'}</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#ede3cd' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a89e8c', letterSpacing: headingTracking(isRTL, '0.08em'), textTransform: 'uppercase' }}>
              {t.auth.or}
            </span>
            <div style={{ flex: 1, height: 1, background: '#ede3cd' }} />
          </div>

          {/* Create account */}
          <p style={{ textAlign: 'center', fontSize: 14, color: '#5a5147', fontWeight: 400 }}>
            {t.auth.noAccount}{' '}
            <Link
              href="/auth/signup"
              style={{
                color: '#1c1611',
                fontWeight: 700,
                textDecoration: 'none',
                borderBottom: '2px solid #ede3cd',
              }}
            >
              {t.auth.createAccount}
            </Link>
          </p>
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{
            textAlign: 'center',
            marginTop: 24,
            fontSize: 11,
            color: '#a89e8c',
            fontWeight: 500,
          }}
        >
          {t.auth.termsNotice.split('{')[0]}
          <Link href="/terms" style={{ color: '#5a5147' }}>{t.auth.terms}</Link>
          {' '}
          <Link href="/privacy" style={{ color: '#5a5147' }}>{t.auth.privacyText}</Link>
        </motion.p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
