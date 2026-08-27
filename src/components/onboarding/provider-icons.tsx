import { cn } from "@/lib/utils"

interface IconProps {
  className?: string
}

export function AnthropicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("size-5", className)}>
      <path d="M17.304 3.541h-3.483l6.15 16.918h3.483zm-10.61 0L.545 20.459H4.15l1.278-3.554h6.539l1.278 3.554h3.604L10.698 3.541zm.49 10.537 2.065-5.728h.054l2.065 5.728z" />
    </svg>
  )
}

export function GoogleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export function OllamaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("size-5", className)}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-11a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm4 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-5.07 5.14a.5.5 0 0 1 .71-.07A4.97 4.97 0 0 0 12 15.5c.93 0 1.8-.26 2.53-.7a.5.5 0 1 1 .51.86A5.97 5.97 0 0 1 12 16.5a5.97 5.97 0 0 1-3.14-.88.5.5 0 0 1 .07-.48z" />
    </svg>
  )
}

export function OpenRouterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("size-5", className)}>
      <path d="M4 4h7v7H4zm9 0h7v7h-7zm-9 9h7v7H4zm9 0h7v7h-7z" opacity="0.8" />
      <path d="M6 6h3v3H6zm9 0h3v3h-3zM6 15h3v3H6zm9 0h3v3h-3z" />
    </svg>
  )
}

export function VercelIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("size-5", className)}>
      <path d="M12 1L24 22H0z" />
    </svg>
  )
}

export function GmailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)}>
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335" />
    </svg>
  )
}

export function SlackIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)}>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.271 0a2.527 2.527 0 0 1-2.521 2.521 2.527 2.527 0 0 1-2.521-2.521V2.522A2.527 2.527 0 0 1 15.164 0a2.528 2.528 0 0 1 2.521 2.522v6.312z" fill="#2EB67D" />
      <path d="M15.164 18.956a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.164 24a2.527 2.527 0 0 1-2.521-2.522v-2.522h2.521zm0-1.271a2.527 2.527 0 0 1-2.521-2.521 2.527 2.527 0 0 1 2.521-2.521h6.314A2.528 2.528 0 0 1 24 15.164a2.528 2.528 0 0 1-2.522 2.521h-6.314z" fill="#ECB22E" />
    </svg>
  )
}

export function FirefliesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("size-5", className)}>
      <circle cx="12" cy="6" r="2" opacity="0.9" />
      <circle cx="7" cy="9" r="1.5" opacity="0.7" />
      <circle cx="17" cy="9" r="1.5" opacity="0.7" />
      <circle cx="5" cy="13" r="1" opacity="0.5" />
      <circle cx="19" cy="13" r="1" opacity="0.5" />
      <circle cx="8" cy="16" r="1.5" opacity="0.6" />
      <circle cx="16" cy="16" r="1.5" opacity="0.6" />
      <circle cx="12" cy="19" r="2" opacity="0.8" />
    </svg>
  )
}

export function GranolaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("size-5", className)}>
      <path d="M12 2a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v2h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h1V7a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2zm0 2h-2v1h4V4h-2zm5 3H7v2h10V7zM4 11v6h16v-6H4zm3 10h10v-2H7v2z" opacity="0.85" />
    </svg>
  )
}

export function GenericApiIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("size-5", className)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z" opacity="0.8" />
    </svg>
  )
}
