'use client'

import { useState } from 'react'
import { login } from '@/app/auth/actions'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

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
                background: '#ffffff',
                color: '#0f172a',
                fontFamily: "'Manrope', 'Inter', sans-serif",
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Nav */}
            <nav
                className="flex justify-between items-center w-full px-12 h-20 sticky top-0 z-50"
                style={{
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(16px)',
                }}
            >
                <Link href="/landing" style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', fontFamily: "'Manrope', sans-serif" }}>
                    Halaqy
                </Link>
                <div className="flex items-center gap-6">
                    <button style={{ color: 'rgba(15,23,42,0.4)', cursor: 'pointer' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>language</span>
                    </button>
                    <Link
                        href="/auth/signup"
                        className="font-semibold text-[11px] uppercase transition-opacity hover:opacity-70"
                        style={{ color: '#000000', letterSpacing: '0.1em' }}
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Main */}
            <main
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px',
                    background: '#ffffff',
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                    style={{ width: '100%', maxWidth: 520 }}
                >
                    <div
                        style={{
                            background: '#ffffff',
                            borderRadius: 24,
                            border: '1px solid #f1f5f9',
                            padding: '64px 80px',
                            boxShadow: '0 32px 64px -16px rgba(0,0,0,0.05)',
                        }}
                    >
                        {/* Brand Anchor */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 56 }}>
                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    background: '#000000',
                                    borderRadius: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 28,
                                }}
                            >
                                <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: 22, color: '#ffffff', fontVariationSettings: "'FILL' 1" }}
                                >
                                    diamond
                                </span>
                            </div>
                            <h1
                                style={{
                                    fontSize: 32,
                                    fontWeight: 300,
                                    fontFamily: "'Manrope', sans-serif",
                                    color: '#0f172a',
                                    letterSpacing: '-0.02em',
                                    marginBottom: 10,
                                }}
                            >
                                Welcome back
                            </h1>
                            <p style={{ color: '#64748b', fontSize: 14, fontWeight: 300, letterSpacing: '0.02em' }}>
                                Enter your details to access your studio.
                            </p>
                        </div>

                        {/* Form */}
                        <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                            {/* Email */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label
                                    htmlFor="email"
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.2em',
                                        color: 'rgba(100,116,139,0.8)',
                                        marginLeft: 4,
                                    }}
                                >
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    placeholder="name@domain.com"
                                    style={{
                                        width: '100%',
                                        height: 56,
                                        padding: '0 20px',
                                        borderRadius: 12,
                                        border: '1px solid #f1f5f9',
                                        background: '#f8fafc',
                                        color: '#0f172a',
                                        fontSize: 14,
                                        fontFamily: "'Inter', sans-serif",
                                        outline: 'none',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.background = '#ffffff'
                                        e.target.style.borderColor = '#000000'
                                        e.target.style.boxShadow = '0 0 0 1px #000000'
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.background = '#f8fafc'
                                        e.target.style.borderColor = '#f1f5f9'
                                        e.target.style.boxShadow = 'none'
                                    }}
                                />
                            </div>

                            {/* Password */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: 4 }}>
                                    <label
                                        htmlFor="password"
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 800,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.2em',
                                            color: 'rgba(100,116,139,0.8)',
                                        }}
                                    >
                                        Password
                                    </label>
                                    <a
                                        href="#"
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 800,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.1em',
                                            color: 'rgba(100,116,139,0.6)',
                                            textDecoration: 'none',
                                        }}
                                    >
                                        Forgot?
                                    </a>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        required
                                        placeholder="••••••••"
                                        style={{
                                            width: '100%',
                                            height: 56,
                                            padding: '0 48px 0 20px',
                                            borderRadius: 12,
                                            border: '1px solid #f1f5f9',
                                            background: '#f8fafc',
                                            color: '#0f172a',
                                            fontSize: 14,
                                            fontFamily: "'Inter', sans-serif",
                                            outline: 'none',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.background = '#ffffff'
                                            e.target.style.borderColor = '#000000'
                                            e.target.style.boxShadow = '0 0 0 1px #000000'
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.background = '#f8fafc'
                                            e.target.style.borderColor = '#f1f5f9'
                                            e.target.style.boxShadow = 'none'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: 14,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'rgba(100,116,139,0.4)',
                                            padding: 4,
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Remember me */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 4, marginTop: 4 }}>
                                <input
                                    id="remember"
                                    type="checkbox"
                                    style={{ width: 16, height: 16, cursor: 'pointer', borderRadius: 4 }}
                                />
                                <label
                                    htmlFor="remember"
                                    style={{ fontSize: 13, color: 'rgba(100,116,139,0.8)', cursor: 'pointer', userSelect: 'none' }}
                                >
                                    Keep me signed in
                                </label>
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={{
                                    padding: '14px 16px',
                                    background: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    borderRadius: 12,
                                    color: '#dc2626',
                                    fontSize: 13,
                                }}>
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <div style={{ paddingTop: 8 }}>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        height: 56,
                                        background: '#000000',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: 12,
                                        fontFamily: "'Manrope', sans-serif",
                                        fontWeight: 600,
                                        fontSize: 14,
                                        letterSpacing: '0.04em',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.7 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 10,
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                                    {!loading && (
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Footer link */}
                        <div style={{ marginTop: 40, textAlign: 'center' }}>
                            <p style={{ fontSize: 13, color: 'rgba(100,116,139,0.6)' }}>
                                New to Halaqy?{' '}
                                <Link
                                    href="/auth/signup"
                                    style={{
                                        color: '#000000',
                                        fontWeight: 700,
                                        marginLeft: 4,
                                        textDecoration: 'none',
                                        transition: 'opacity 0.15s',
                                    }}
                                >
                                    Create an account
                                </Link>
                            </p>
                        </div>
                    </div>
                </motion.div>
            </main>

            {/* Footer */}
            <footer style={{ padding: '40px 48px', borderTop: '1px solid #f8fafc' }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(100,116,139,0.4)' }}>
                    © 2026 Halaqy Digital.
                </p>
            </footer>
        </div>
    )
}
