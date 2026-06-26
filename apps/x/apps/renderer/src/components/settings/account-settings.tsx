"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { googleDisplayName } from "@/lib/google-profile"

interface AccountSettingsProps {
  dialogOpen: boolean
}

export function AccountSettings({ dialogOpen }: AccountSettingsProps) {
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [googleProfileName, setGoogleProfileName] = useState<string | null>(null)
  const [googleProfileImage, setGoogleProfileImage] = useState<string | null>(null)
  const [googleProfileEmail, setGoogleProfileEmail] = useState<string | null>(null)

  const [connectionLoading, setConnectionLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const checkConnection = useCallback(async () => {
    try {
      setConnectionLoading(true)
      const result = await window.ipc.invoke('oauth:getState', null)
      const config = result.config || {}
      
      const googleConfig = config['google'] as any
      const googleConnected = googleConfig?.connected ?? false
      setIsGoogleConnected(googleConnected)
      setGoogleProfileName(googleConfig?.profileName ?? null)
      setGoogleProfileImage(googleConfig?.profileImage ?? null)
      setGoogleProfileEmail(googleConfig?.profileEmail ?? null)
    } catch {
      setIsGoogleConnected(false)
    } finally {
      setConnectionLoading(false)
    }
  }, [])

  useEffect(() => {
    if (dialogOpen) {
      checkConnection()
    }
  }, [dialogOpen, checkConnection])

  useEffect(() => {
    const cleanup = window.ipc.on('oauth:didConnect', (event) => {
      checkConnection()
      if (event.provider === 'google') {
        setConnecting(false)
        if (event.success) {
          toast.success('Google account connected')
        }
      }
    })
    return cleanup
  }, [checkConnection])

  const handleConnectGoogle = useCallback(async () => {
    try {
      setConnecting(true)
      const result = await window.ipc.invoke('oauth:connect', { provider: 'google' })
      if (!result.success) {
        toast.error(result.error || 'Failed to connect Google Account')
        setConnecting(false)
      }
    } catch {
      toast.error('Failed to connect Google Account')
      setConnecting(false)
    }
  }, [])

  const handleDisconnectGoogle = useCallback(async () => {
    try {
      setDisconnecting(true)
      const result = await window.ipc.invoke('oauth:disconnect', { provider: 'google' })
      if (result.success) {
        setIsGoogleConnected(false)
        toast.success('Google account disconnected')
      } else {
        toast.error('Failed to disconnect Google Account')
      }
    } catch {
      toast.error('Failed to disconnect Google Account')
    } finally {
      setDisconnecting(false)
    }
  }, [])

  if (connectionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isGoogleConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <User className="size-7 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">No account connected</p>
          <p className="text-xs text-muted-foreground">Connect your Google account via OAuth to personalize your profile and access integrations</p>
        </div>
        <Button onClick={handleConnectGoogle} disabled={connecting}>
          {connecting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
          Connect Google Account
        </Button>
      </div>
    )
  }

  const displayName = googleDisplayName(googleProfileName, googleProfileEmail)

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-card/25 p-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 overflow-hidden border border-border/60">
              {googleProfileImage ? (
                <img
                  src={googleProfileImage}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="size-6 text-primary" />
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">{googleProfileEmail}</p>
              <div className="inline-flex items-center gap-1 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                <span className="h-1 w-1 rounded-full bg-brand" />
                Primary Identity (Google OAuth)
              </div>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/40">
                Log Out
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Google Account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will log you out of your primary identity. You can connect it back at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDisconnectGoogle}
                  disabled={disconnecting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {disconnecting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
