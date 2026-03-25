'use client'

import { useState } from 'react'
import { login } from '@/app/[locale]/auth/actions'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslation } from '@/hooks/use-translation'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
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

  const { FF, dir } = useTranslation()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9fafb',
        fontFamily: FF,
        direction: dir,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Background decoration */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          className="orb"
          style={{
            width: 600,
            height: 600,
            top: -200,
            right: -200,
            background: 'rgba(213,227,252,0.5)',
            animationDelay: '0s',
          }}
        />
        <div
          className="orb"
          style={{
            width: 400,
            height: 400,
            bottom: -100,
            left: -100,
            background: 'rgba(16,185,129,0.12)',
            animationDelay: '4s',
          }}
        />
      </div>

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
              color: '#111827',
              textDecoration: 'none',
              letterSpacing: '-0.04em',
              fontFamily: "'Manrope',system-ui,sans-serif",
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
            borderRadius: 24,
            padding: '40px 36px',
            boxShadow: '0 4px 40px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
            border: '1px solid #f0f0f0',
          }}
        >
          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: '#111827',
                letterSpacing: '-0.03em',
                marginBottom: 6,
                fontFamily: "'Manrope',system-ui,sans-serif",
              }}
            >
              Welcome back
            </h1>
            <p style={{ color: '#9ca3af', fontSize: 14, fontWeight: 500 }}>
              Sign in to manage your appointments and profile.
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
                  letterSpacing: '0.08em',
                  color: '#6b7280',
                }}
              >
                Email Address
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
                    color: '#9ca3af',
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
                    background: '#f9fafb',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#111827',
                    outline: 'none',
                    transition: 'all 150ms ease',
                    fontFamily: FF,
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.background = '#fff'
                    e.target.style.borderColor = '#111827'
                    e.target.style.boxShadow = '0 0 0 3px rgba(17,24,39,0.08)'
                  }}
                  onBlur={e => {
                    e.target.style.background = '#f9fafb'
                    e.target.style.borderColor = '#e5e7eb'
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
                    letterSpacing: '0.08em',
                    color: '#6b7280',
                  }}
                >
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textDecoration: 'none',
                  }}
                >
                  Forgot password?
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
                    color: '#9ca3af',
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
                    background: '#f9fafb',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: 14,
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#111827',
                    outline: 'none',
                    transition: 'all 150ms ease',
                    fontFamily: FF,
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => {
                    e.target.style.background = '#fff'
                    e.target.style.borderColor = '#111827'
                    e.target.style.boxShadow = '0 0 0 3px rgba(17,24,39,0.08)'
                  }}
                  onBlur={e => {
                    e.target.style.background = '#f9fafb'
                    e.target.style.borderColor = '#e5e7eb'
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
                    color: '#9ca3af',
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
                  background: 'rgba(244,63,94,0.06)',
                  border: '1px solid rgba(244,63,94,0.2)',
                  borderRadius: 12,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: '#f43f5e', fontVariationSettings: "'FILL' 1" }}>
                  error
                </span>
                <p style={{ color: '#e11d48', fontSize: 13, fontWeight: 500 }}>{error}</p>
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
                background: loading ? '#374151' : '#111827',
                color: '#fff',
                borderRadius: 14,
                border: 'none',
                fontFamily: "'Manrope',system-ui,sans-serif",
                fontWeight: 700,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 150ms ease',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.background = '#1f2937'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.20)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  e.currentTarget.style.background = '#111827'
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)'
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
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#d1d5db', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: '#f0f0f0' }} />
          </div>

          {/* Create account */}
          <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7280', fontWeight: 400 }}>
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              style={{
                color: '#111827',
                fontWeight: 700,
                textDecoration: 'none',
                borderBottom: '2px solid rgba(17,24,39,0.15)',
              }}
            >
              Create account
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
            color: '#d1d5db',
            fontWeight: 500,
          }}
        >
          By signing in, you agree to our{' '}
          <a href="#" style={{ color: '#9ca3af' }}>Terms</a>{' '}
          and{' '}
          <a href="#" style={{ color: '#9ca3af' }}>Privacy Policy</a>
        </motion.p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
