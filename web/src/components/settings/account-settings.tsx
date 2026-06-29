"use client"

import { useEffect, useState } from "react"
import { Loader2, LogOut, Save, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/client"
import { useProfile } from "@/hooks/use-profile"

interface AccountSettingsProps {
  dialogOpen: boolean
}

export function AccountSettings({ dialogOpen }: AccountSettingsProps) {
  const { user, profile, loading, displayName, subtitle, updateProfile } = useProfile()
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [form, setForm] = useState({
    full_name: "",
    company_name: "",
    job_title: "",
    phone: "",
    avatar_url: "",
    location: "",
    about: "",
  })

  useEffect(() => {
    if (!dialogOpen || !profile) return
    setForm({
      full_name: profile.full_name ?? "",
      company_name: profile.company_name ?? "",
      job_title: profile.job_title ?? "",
      phone: profile.phone ?? "",
      avatar_url: profile.avatar_url ?? "",
      location: profile.location ?? "",
      about: profile.about ?? "",
    })
  }, [dialogOpen, profile])

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await updateProfile({
        full_name: form.full_name.trim() || null,
        company_name: form.company_name.trim() || null,
        job_title: form.job_title.trim() || null,
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        location: form.location.trim() || null,
        about: form.about.trim() || null,
      })
      toast.success("Profile updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      window.location.assign("/login")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign out")
      setSigningOut(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <User className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Not signed in</p>
          <p className="text-xs text-muted-foreground">Sign in to manage your Jobraker Recruiter profile.</p>
        </div>
        <Button onClick={() => window.location.assign("/login")}>Go to login</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-card/25 p-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-primary/10">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <User className="size-6 text-primary" />
            )}
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <div className="inline-flex items-center gap-1 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Supabase profile
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogOut className="mr-2 size-4" />}
          Log out
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Full name</span>
          <Input value={form.full_name} onChange={(event) => handleChange("full_name", event.target.value)} placeholder="Your name" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Role title</span>
          <Input value={form.job_title} onChange={(event) => handleChange("job_title", event.target.value)} placeholder={subtitle} />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Company</span>
          <Input value={form.company_name} onChange={(event) => handleChange("company_name", event.target.value)} placeholder="Company name" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Location</span>
          <Input value={form.location} onChange={(event) => handleChange("location", event.target.value)} placeholder="City, country" />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Phone</span>
          <Input value={form.phone} onChange={(event) => handleChange("phone", event.target.value)} placeholder="+1..." />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Avatar URL</span>
          <Input value={form.avatar_url} onChange={(event) => handleChange("avatar_url", event.target.value)} placeholder="https://..." />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">About</span>
          <Textarea value={form.about} onChange={(event) => handleChange("about", event.target.value)} placeholder="Short recruiter bio or operating style" />
        </label>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
          Save profile
        </Button>
      </div>
    </div>
  )
}
