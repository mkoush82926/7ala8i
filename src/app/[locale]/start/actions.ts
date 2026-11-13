'use server'

// Owner account step of the /start wizard (WS-1G). Mirrors the patterns of
// src/app/[locale]/auth/actions.ts: whitelisted role, error keys instead of
// raw Supabase messages, per-IP throttling before any network call. The
// profile, shop and organization are created by the handle_new_user trigger.
//
// Phone-first: the mobile number is the first field and becomes the shop's
// WhatsApp contact. When NEXT_PUBLIC_PHONE_AUTH_ENABLED=true (an SMS provider
// is configured in Supabase Auth) the account itself is a phone account
// verified by OTP; otherwise it is an email + password account.

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitKey, getClientIp } from '@/lib/rate-limit'
import { authErrorKey, isValidEmail, MIN_PASSWORD_LENGTH, type AuthErrorKey } from '../auth/auth-errors'
import { normalizeAuthLocale } from '../auth/safe-next'
import { normalizePhone } from './_lib/wizard'

export type OwnerSignupError = AuthErrorKey | 'invalidPhone' | 'nameTooShort' | 'invalidOtp'

export interface OwnerSignupResult {
    ok?: boolean
    /** Email confirmation is on: the owner must open the link we sent. */
    checkEmail?: string
    /** Phone auth is on: an SMS code was sent to this number. */
    otpSentTo?: string
    error?: OwnerSignupError
}

function phoneAuthEnabled(): boolean {
    return process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === 'true'
}

async function clientIp(): Promise<string> {
    try {
        const h = await headers()
        return getClientIp(new Request('http://local.invalid', { headers: h }))
    } catch {
        return 'unknown'
    }
}

async function siteOrigin(): Promise<string> {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
    if (configured) return configured
    try {
        const h = await headers()
        const host = h.get('x-forwarded-host') ?? h.get('host')
        const proto = h.get('x-forwarded-proto') ?? 'https'
        if (host) return `${proto}://${host}`
    } catch {
        // fall through
    }
    return ''
}

export async function signUpOwner(formData: FormData): Promise<OwnerSignupResult> {
    const fullName = String(formData.get('fullName') ?? '').trim()
    const phoneRaw = String(formData.get('phone') ?? '')
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    const shopName = String(formData.get('shopName') ?? '').trim()
    const locale = normalizeAuthLocale(formData.get('locale'))
    const usePhone = phoneAuthEnabled()

    const phone = normalizePhone(phoneRaw)
    if (!fullName || !phoneRaw.trim() || !password || (!usePhone && !email)) return { error: 'missingFields' }
    if (fullName.length < 2) return { error: 'nameTooShort' }
    if (!phone) return { error: 'invalidPhone' }
    if (!usePhone && !isValidEmail(email)) return { error: 'invalidEmail' }
    if (password.length < MIN_PASSWORD_LENGTH) return { error: 'weakPassword' }

    const rl = await rateLimit(rateLimitKey('owner-signup', await clientIp()), 5, 600)
    if (!rl.success) return { error: 'rateLimited' }

    // The DB trigger only honours role "shop_admin"; it seeds the shop.
    const metadata: Record<string, string> = {
        full_name: fullName.slice(0, 100),
        role: 'shop_admin',
        phone,
    }
    if (shopName) metadata.shop_name = shopName.slice(0, 100)

    const supabase = await createClient()
    const origin = await siteOrigin()
    const next = `/${locale}/start`

    const { data, error } = usePhone
        ? await supabase.auth.signUp({ phone, password, options: { data: metadata } })
        : await supabase.auth.signUp({
              email,
              password,
              options: {
                  data: metadata,
                  emailRedirectTo: origin
                      ? `${origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`
                      : undefined,
              },
          })

    if (error) return { error: authErrorKey(error) }

    revalidatePath(next)
    if (data.session) return { ok: true }
    return usePhone ? { otpSentTo: phone } : { checkEmail: email }
}

/** Verifies the SMS code (phone auth only). */
export async function verifyOwnerOtp(formData: FormData): Promise<OwnerSignupResult> {
    if (!phoneAuthEnabled()) return { error: 'generic' }
    const phone = normalizePhone(String(formData.get('phone') ?? ''))
    const token = String(formData.get('token') ?? '').replace(/\D/g, '')
    const locale = normalizeAuthLocale(formData.get('locale'))
    if (!phone) return { error: 'invalidPhone' }
    if (token.length < 4 || token.length > 8) return { error: 'invalidOtp' }

    const rl = await rateLimit(rateLimitKey('owner-otp', await clientIp(), phone), 8, 600)
    if (!rl.success) return { error: 'rateLimited' }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error || !data.session) return { error: error ? 'invalidOtp' : 'generic' }

    revalidatePath(`/${locale}/start`)
    return { ok: true }
}
