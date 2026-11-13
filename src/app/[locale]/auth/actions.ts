'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignupRoleSchema } from '@/lib/validations'
import { rateLimit, rateLimitKey, getClientIp } from '@/lib/rate-limit'
import { authErrorKey, isValidEmail, MIN_PASSWORD_LENGTH, type AuthErrorKey } from './auth-errors'
import { normalizeAuthLocale, resolveNext } from './safe-next'

export interface AuthActionResult {
    /** Key into t.auth.errors — never a raw Supabase message. */
    error?: AuthErrorKey
}

async function clientIp(): Promise<string> {
    try {
        const h = await headers()
        return getClientIp(new Request('http://local.invalid', { headers: h }))
    } catch {
        return 'unknown'
    }
}

export async function login(formData: FormData): Promise<AuthActionResult> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const locale = normalizeAuthLocale(formData.get('locale'))
    // Only same-origin relative paths are followed (see safe-next.ts).
    const target = resolveNext(formData.get('next'), locale)

    if (!email || !password) return { error: 'missingFields' }
    if (!isValidEmail(email)) return { error: 'invalidEmail' }

    // Throttle credential stuffing per IP+email before any network call.
    const rl = await rateLimit(rateLimitKey('login', await clientIp(), email), 10, 300)
    if (!rl.success) return { error: 'rateLimited' }

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        const key = authErrorKey(error)
        // Unknown failures are reported as bad credentials — never leak details.
        return { error: key === 'generic' ? 'invalidCredentials' : key }
    }

    revalidatePath('/', 'layout')
    redirect(target)
}

/**
 * Server-side signup (the signup page uses the browser client, but this
 * stays available for progressive enhancement). The role is whitelisted to
 * customer | shop_admin; barbers only ever join through an invite. The
 * profile row (and, for owners, the shop) is created by the
 * handle_new_user DB trigger — never from here.
 */
export async function signup(formData: FormData): Promise<AuthActionResult> {
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const fullName = String(formData.get('fullName') ?? '').trim()
    const shopName = String(formData.get('shopName') ?? '').trim()
    const locale = normalizeAuthLocale(formData.get('locale'))
    const rawRole = formData.get('role')
    const role = SignupRoleSchema.parse(rawRole === 'client' ? 'customer' : rawRole)

    if (!email || !password || !fullName) return { error: 'missingFields' }
    if (!isValidEmail(email)) return { error: 'invalidEmail' }
    if (password.length < MIN_PASSWORD_LENGTH) return { error: 'weakPassword' }

    const rl = await rateLimit(rateLimitKey('signup', await clientIp()), 5, 600)
    if (!rl.success) return { error: 'rateLimited' }

    const metadata: Record<string, string> = { full_name: fullName.slice(0, 100), role }
    if (role === 'shop_admin' && shopName) metadata.shop_name = shopName.slice(0, 100)

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
    })

    if (error) return { error: authErrorKey(error) }

    revalidatePath('/', 'layout')

    // No session means email confirmation is pending — the page shows "check your email".
    if (!data.session) return {}

    redirect(role === 'customer' ? `/${locale}/customer` : `/${locale}`)
}

export async function logout(formData?: FormData) {
    const supabase = await createClient()
    await supabase.auth.signOut()
    const locale = normalizeAuthLocale(formData?.get('locale'))
    revalidatePath('/', 'layout')
    redirect(`/${locale}/auth/login`)
}
