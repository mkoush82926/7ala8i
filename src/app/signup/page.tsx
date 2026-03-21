'use client'

import { useState } from 'react'
import { signup } from '@/app/auth/actions'
import Link from 'next/link'
import { motion } from 'framer-motion'

const roles = [
    {
        id: 'shop_admin',
        icon: 'storefront',
        title: 'Shop Manager',
        desc: 'Directing operations, managing staff, and scaling your business.',
    },
    {
        id: 'client',
        icon: 'person',
        title: 'Customer',
        desc: 'Booking appointments and curating your personal grooming journey.',
    },
    {
        id: 'barber',
        icon: 'content_cut',
        title: 'Professional',
        desc: 'Managing your individual schedule, clients, and creative portfolio.',
    },
]

export default function SignupPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<1 | 2>(1)
    const [selectedRole, setSelectedRole] = useState<string | null>(null)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)
        if (selectedRole) formData.set('role', selectedRole)
        const result = await signup(formData)
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
                color: '#000000',
                fontFamily: "'Inter', 'Manrope', sans-serif",
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Nav */}
            <nav
                className="flex justify-between items-center w-full px-12 h-24 sticky top-0 z-50"
                style={{
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(16px)',
                }}
            >
                <Link href="/landing" style={{ fontSize: 18, fontWeight: 700, color: '#000000', letterSpacing: '-0.02em', textDecoration: 'none' }}>
                    Lumina
                </Link>
                <div className="hidden md:flex items-center gap-10">
                    {['Dashboard', 'Calendar', 'Analytics'].map((item) => (
                        <Link
                            key={item}
                            href={`/${item.toLowerCase()}`}
                            style={{
                                fontSize: 12,
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                color: 'rgba(0,0,0,0.5)',
                                textDecoration: 'none',
                            }}
                        >
                            {item}
                        </Link>
                    ))}
                </div>
                <div className="flex items-center gap-6">
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>notifications</span>
                    </button>
                    <Link
                        href="/signup"
                        style={{
                            background: '#000000',
                            color: '#ffffff',
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
                            padding: '12px 28px',
                            textDecoration: 'none',
                        }}
                    >
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Step 1 — Role Selection */}
            {step === 1 && (
                <main
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '60px 24px',
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                        style={{ textAlign: 'center', marginBottom: 72, maxWidth: 640 }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#e5e5e5', display: 'block', marginBottom: 24 }}>
                            circle
                        </span>
                        <h1
                            style={{
                                fontSize: 48,
                                fontWeight: 300,
                                fontFamily: "'Manrope', 'Inter', sans-serif",
                                letterSpacing: '-0.03em',
                                color: '#000000',
                                marginBottom: 20,
                            }}
                        >
                            How will you use Lumina?
                        </h1>
                        <p style={{ color: '#666666', fontSize: 18, fontWeight: 300, maxWidth: 400, margin: '0 auto' }}>
                            Select the role that best describes your daily operations and goals.
                        </p>
                    </motion.div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: 24,
                            width: '100%',
                            maxWidth: 960,
                        }}
                    >
                        {roles.map((role, i) => (
                            <motion.button
                                key={role.id}
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.25, 1, 0.5, 1] }}
                                onClick={() => {
                                    setSelectedRole(role.id)
                                    setStep(2)
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: 48,
                                    border: selectedRole === role.id ? '1px solid #000' : '1px solid #e5e5e5',
                                    borderRadius: 16,
                                    textAlign: 'left',
                                    background: '#ffffff',
                                    cursor: 'pointer',
                                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#000'
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = selectedRole === role.id ? '#000' : '#e5e5e5'
                                    e.currentTarget.style.transform = 'none'
                                }}
                            >
                                <div style={{ marginBottom: 56 }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 30, color: '#aaaaaa' }}>
                                        {role.icon}
                                    </span>
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 18, fontWeight: 600, color: '#000000', marginBottom: 12, fontFamily: "'Manrope', sans-serif" }}>
                                        {role.title}
                                    </h3>
                                    <p style={{ fontSize: 14, color: '#666666', fontWeight: 300, lineHeight: 1.7 }}>
                                        {role.desc}
                                    </p>
                                </div>
                                <div
                                    style={{
                                        marginTop: 40,
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: '#000000',
                                        fontWeight: 600,
                                        fontSize: 10,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.2em',
                                    }}
                                >
                                    Select{' '}
                                    <span className="material-symbols-outlined" style={{ fontSize: 14, marginLeft: 8 }}>arrow_forward</span>
                                </div>
                            </motion.button>
                        ))}
                    </div>

                    <div style={{ marginTop: 64, textAlign: 'center' }}>
                        <p style={{ fontSize: 14, color: '#666666', fontWeight: 300 }}>
                            Already have an account?{' '}
                            <Link
                                href="/login"
                                style={{
                                    color: '#000000',
                                    fontWeight: 600,
                                    marginLeft: 4,
                                    textDecoration: 'none',
                                    borderBottom: '1px solid rgba(0,0,0,0.1)',
                                }}
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </main>
            )}

            {/* Step 2 — Account Details */}
            {step === 2 && (
                <main
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '60px 24px',
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                        style={{ width: '100%', maxWidth: 520 }}
                    >
                        <button
                            onClick={() => setStep(1)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#666666',
                                fontSize: 13,
                                fontWeight: 600,
                                marginBottom: 40,
                                padding: 0,
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                            Back
                        </button>

                        <div style={{ marginBottom: 40 }}>
                            <div
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '6px 16px',
                                    borderRadius: 9999,
                                    background: '#f5f5f5',
                                    marginBottom: 20,
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#666' }}>
                                    {roles.find(r => r.id === selectedRole)?.icon || 'person'}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#666' }}>
                                    {roles.find(r => r.id === selectedRole)?.title}
                                </span>
                            </div>
                            <h1
                                style={{
                                    fontSize: 40,
                                    fontWeight: 800,
                                    fontFamily: "'Manrope', sans-serif",
                                    letterSpacing: '-0.03em',
                                    color: '#000000',
                                    marginBottom: 10,
                                }}
                            >
                                Create your account
                            </h1>
                            <p style={{ color: '#666666', fontSize: 15, fontWeight: 300 }}>
                                Start managing your barbershop with Lumina
                            </p>
                        </div>

                        <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            {/* Full Name */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label style={{
                                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                    letterSpacing: '0.2em', color: 'rgba(100,116,139,0.8)',
                                }}>
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    name="fullName"
                                    required
                                    placeholder="Your full name"
                                    style={{
                                        width: '100%', height: 56, padding: '0 20px',
                                        borderRadius: 12, border: '1px solid #f1f5f9',
                                        background: '#f8fafc', color: '#0f172a',
                                        fontSize: 14, fontFamily: "'Inter', sans-serif", outline: 'none',
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

                            {/* Email */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label style={{
                                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                    letterSpacing: '0.2em', color: 'rgba(100,116,139,0.8)',
                                }}>
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    placeholder="name@domain.com"
                                    style={{
                                        width: '100%', height: 56, padding: '0 20px',
                                        borderRadius: 12, border: '1px solid #f1f5f9',
                                        background: '#f8fafc', color: '#0f172a',
                                        fontSize: 14, fontFamily: "'Inter', sans-serif", outline: 'none',
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
                                <label style={{
                                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                    letterSpacing: '0.2em', color: 'rgba(100,116,139,0.8)',
                                }}>
                                    Password
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    minLength={6}
                                    placeholder="••••••••"
                                    style={{
                                        width: '100%', height: 56, padding: '0 20px',
                                        borderRadius: 12, border: '1px solid #f1f5f9',
                                        background: '#f8fafc', color: '#0f172a',
                                        fontSize: 14, fontFamily: "'Inter', sans-serif", outline: 'none',
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

                            {error && (
                                <div style={{
                                    padding: '14px 16px', background: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12,
                                    color: '#dc2626', fontSize: 13,
                                }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    marginTop: 8, width: '100%', height: 56,
                                    background: loading ? '#555' : '#000000',
                                    color: '#ffffff', border: 'none', borderRadius: 12,
                                    fontFamily: "'Manrope', sans-serif", fontWeight: 700,
                                    fontSize: 14, letterSpacing: '0.04em',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.15s ease',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                }}
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                                {!loading && <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>}
                            </button>
                        </form>

                        <div style={{ marginTop: 32, textAlign: 'center' }}>
                            <p style={{ fontSize: 13, color: 'rgba(100,116,139,0.6)' }}>
                                Already have an account?{' '}
                                <Link href="/login" style={{ color: '#000000', fontWeight: 700, marginLeft: 4, textDecoration: 'none' }}>
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </motion.div>
                </main>
            )}

            {/* Footer */}
            <footer
                style={{
                    padding: '60px 48px',
                    borderTop: '1px solid #e5e5e5',
                    background: '#ffffff',
                }}
            >
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-16">
                    <div style={{ maxWidth: 280 }}>
                        <h4 style={{ fontWeight: 700, fontSize: 18, marginBottom: 20, color: '#000' }}>Lumina</h4>
                        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(107,114,128,0.6)', lineHeight: 2 }}>
                            An intentional approach to grooming management. Built for the modern atelier.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-16">
                        {[
                            { title: 'Product', links: ['Features', 'Pricing'] },
                            { title: 'Studio', links: ['About', 'Journal'] },
                            { title: 'Legal', links: ['Terms', 'Privacy'] },
                        ].map((col) => (
                            <div key={col.title} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700, color: '#000' }}>
                                    {col.title}
                                </span>
                                {col.links.map((link) => (
                                    <a key={link} href="#" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(107,114,128,0.6)', textDecoration: 'none' }}>
                                        {link}
                                    </a>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="max-w-7xl mx-auto mt-16 pt-8" style={{ borderTop: '1px solid #e5e5e5' }}>
                    <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(107,114,128,0.4)' }}>
                        © 2026 Lumina. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    )
}
