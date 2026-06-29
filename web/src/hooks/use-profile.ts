import { useCallback, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/client"
import { useAuth } from "@/hooks/use-auth"

export type UserProfile = {
  id: string
  email: string | null
  full_name: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  job_title: string | null
  phone: string | null
  avatar_url: string | null
  location: string | null
  about: string | null
  onboarding_complete: boolean
}

type EditableProfile = Partial<
  Pick<UserProfile, "full_name" | "company_name" | "job_title" | "phone" | "avatar_url" | "location" | "about">
>

function fallbackName(user: User | null): string {
  const metadataName = user?.user_metadata?.full_name
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim()
  return user?.email?.split("@")[0] || "Recruiter"
}

function profileFallback(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email ?? null,
    full_name: fallbackName(user),
    first_name: null,
    last_name: null,
    company_name: null,
    job_title: null,
    phone: null,
    avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
    location: null,
    about: null,
    onboarding_complete: false,
  }
}

export function getProfileDisplayName(profile: UserProfile | null, user: User | null): string {
  return profile?.full_name?.trim() || fallbackName(user)
}

export function getProfileSubtitle(profile: UserProfile | null, user: User | null): string {
  return profile?.job_title?.trim() || profile?.company_name?.trim() || user?.email || "Recruiter"
}

export function useProfile() {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    const supabase = createClient()
    setLoading(true)
    setError(null)

    const { data, error: readError } = await supabase
      .from("profiles")
      .select("id,email,full_name,first_name,last_name,company_name,job_title,phone,avatar_url,location,about,onboarding_complete")
      .eq("id", user.id)
      .maybeSingle()

    if (readError) {
      setProfile(profileFallback(user))
      setError(readError.message)
      setLoading(false)
      return
    }

    if (data) {
      setProfile(data as UserProfile)
      setLoading(false)
      return
    }

    const fallback = profileFallback(user)
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert(fallback)
      .select("id,email,full_name,first_name,last_name,company_name,job_title,phone,avatar_url,location,about,onboarding_complete")
      .single()

    if (createError) {
      setProfile(fallback)
      setError(createError.message)
    } else {
      setProfile(created as UserProfile)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  const updateProfile = useCallback(async (patch: EditableProfile) => {
    if (!user) throw new Error("Authentication required")
    const supabase = createClient()
    const next = {
      id: user.id,
      email: user.email ?? profile?.email ?? null,
      ...patch,
    }
    const { data, error: updateError } = await supabase
      .from("profiles")
      .upsert(next, { onConflict: "id" })
      .select("id,email,full_name,first_name,last_name,company_name,job_title,phone,avatar_url,location,about,onboarding_complete")
      .single()

    if (updateError) throw updateError
    setProfile(data as UserProfile)
    return data as UserProfile
  }, [profile?.email, user])

  const displayName = getProfileDisplayName(profile, user)
  const subtitle = getProfileSubtitle(profile, user)

  return useMemo(() => ({
    user,
    profile,
    loading: authLoading || loading,
    error,
    isAuthenticated,
    displayName,
    subtitle,
    refresh,
    updateProfile,
  }), [authLoading, displayName, error, isAuthenticated, loading, profile, refresh, subtitle, updateProfile, user])
}
