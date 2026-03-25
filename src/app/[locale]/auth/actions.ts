'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    // basic validation
    if (!email || !password) {
        return { error: 'Email and password are required' }
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const email    = formData.get('email')    as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string
    // role comes from the role-selection step in the UI
    const rawRole  = (formData.get('role') as string | null) || 'customer'
    // Normalise: the UI sends 'client' for customers
    const role = rawRole === 'client' ? 'customer' : rawRole

    if (!email || !password || !fullName) {
        return { error: 'All fields are required' }
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName, role },
        },
    })

    if (error) {
        return { error: error.message }
    }

    // Also upsert a profile row so the dashboard can read full_name/role immediately
    if (data.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any).upsert({
            id:        data.user.id,
            full_name: fullName,
            role,
        })
    }

    revalidatePath('/', 'layout')

    // Route to the right starting screen based on role
    if (role === 'customer') {
        redirect('/customer')
    }
    redirect('/')
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
