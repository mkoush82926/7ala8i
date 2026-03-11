'use client'

import { useState } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { GlassButton } from '@/components/ui/glass-button'
import { signup } from '@/app/auth/actions'
import { useTranslation } from '@/hooks/use-translation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Scissors } from 'lucide-react'

export default function SignupPage() {
    const t = useTranslation()
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)
        const result = await signup(formData)
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-app-bg text-app-text flex flex-col items-center justify-center p-4">
            {/* Background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-app-accent-blue/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-app-accent-mint/10 rounded-full blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md z-10"
            >
                <div className="text-center mb-8 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-app-accent-mint to-app-accent-blue p-px mb-4">
                        <div className="w-full h-full bg-app-card rounded-2xl flex items-center justify-center backdrop-blur-md">
                            <Scissors className="w-8 h-8 text-app-accent-mint" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                        Create your workspace
                    </h1>
                    <p className="text-app-text-muted mt-2">Start managing your barbershop with Lumina</p>
                </div>

                <GlassCard className="p-8">
                    <form action={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-app-text-muted">Full Name</label>
                            <input
                                type="text"
                                name="fullName"
                                required
                                className="w-full bg-app-bg-muted border border-app-border rounded-xl px-4 py-3 text-app-text focus:outline-none focus:border-app-accent-mint transition-colors"
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-app-text-muted">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                required
                                className="w-full bg-app-bg-muted border border-app-border rounded-xl px-4 py-3 text-app-text focus:outline-none focus:border-app-accent-mint transition-colors"
                                placeholder="name@barbershop.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-app-text-muted">Password</label>
                            <input
                                type="password"
                                name="password"
                                required
                                minLength={6}
                                className="w-full bg-app-bg-muted border border-app-border rounded-xl px-4 py-3 text-app-text focus:outline-none focus:border-app-accent-mint transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <GlassButton type="submit" variant="primary" className="w-full justify-center" disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </GlassButton>
                    </form>

                    <div className="mt-6 text-center text-sm text-app-text-muted">
                        Already have an account?{' '}
                        <Link href="/login" className="text-app-accent-mint hover:underline font-medium">
                            Sign in
                        </Link>
                    </div>
                </GlassCard>
            </motion.div>
        </div>
    )
}
