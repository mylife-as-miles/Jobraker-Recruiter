import * as React from 'react'
import { motion, type Variants } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Search,
  Shield,
  User,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { createClient } from '@/lib/client'

type AuthMode = 'login' | 'signup'

const panelMotion: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.75, ease: 'easeOut' } },
}

const formMotion: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.75, delay: 0.08, ease: 'easeOut' } },
}

const fieldMotion: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: index * 0.07, ease: 'easeOut' },
  }),
}

function BrandMark() {
  return (
    <a href="/" className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded bg-[#1dff00] text-black shadow-[0_0_24px_rgba(29,255,0,0.35)]">
        <Search className="h-5 w-5" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.55),transparent)] opacity-60" />
      </div>
      <span className="truncate font-mono text-base font-bold tracking-tight text-white min-[420px]:text-xl">
        JOBRAKER <span className="text-[#1dff00]">RECRUITER</span>
      </span>
    </a>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

type RecruiterAuthViewProps = {
  initialMode?: AuthMode
}

export function RecruiterAuthView({ initialMode = 'login' }: RecruiterAuthViewProps) {
  const [mode, setMode] = React.useState<AuthMode>(initialMode)
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [name, setName] = React.useState('')

  const supabase = React.useMemo(() => createClient(), [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    const trimmedEmail = email.trim()
    const trimmedName = name.trim()
    const fallbackName = trimmedEmail.split('@')[0]
    const [firstName, ...lastNameParts] = (trimmedName || fallbackName).split(/\s+/)
    const lastName = lastNameParts.join(' ')

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName || fallbackName,
              first_name: firstName,
              last_name: lastName || undefined,
              product: 'jobraker-recruiter-web',
            },
          },
        })

        if (error) throw error

        toast.success('Account created. Check your email if confirmation is enabled.')
        setMode('login')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) throw error

      toast.success('Welcome back to Jobraker Recruiter.')
      window.history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed. Please try again.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleAuth() {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      toast.error(error.message)
      setIsLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="min-h-[100svh] w-full overflow-x-hidden bg-black font-mono text-white selection:bg-[#1dff00] selection:text-black">
      <Toaster position="top-right" theme="dark" richColors />
      <div className="flex min-h-[100svh] w-full">
        <motion.aside
          initial="hidden"
          animate="visible"
          variants={panelMotion}
          className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-[#1dff00]/15 bg-[#050807] p-8 xl:p-12 lg:flex"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(29,255,0,0.16),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(29,255,0,0.08),transparent_30%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(29,255,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(29,255,0,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#1dff00]/15" />
          <div className="absolute bottom-14 right-14 h-56 w-56 rounded-full bg-[#1dff00]/10 blur-[90px]" />

          <div className="relative z-10">
            <BrandMark />
            <div className="mt-10 max-w-md xl:mt-16">
              <p className="mb-5 inline-flex rounded-full border border-[#1dff00]/25 bg-[#1dff00]/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-[#1dff00]">
                Recruiter access layer
              </p>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
                {isLogin
                  ? 'Secure access to your recruiting command center.'
                  : 'Start building a sharper hiring machine.'}
              </h1>
              <p className="mt-5 text-base leading-relaxed text-neutral-400 xl:text-lg">
                Source candidates, explain match quality, draft outreach, and keep the
                pipeline moving from a browser workspace designed for review-first AI.
              </p>
            </div>
          </div>

          <div className="relative z-10 space-y-8">
            <div className="max-w-md rounded-2xl border border-[#1dff00]/15 bg-black/45 p-6 shadow-[0_0_40px_rgba(29,255,0,0.08)] backdrop-blur-md">
              <div className="mb-4 flex gap-1">
                {[1, 2, 3, 4, 5].map((item) => (
                  <BadgeCheck key={item} className="h-4 w-4 fill-[#1dff00] text-[#1dff00]" />
                ))}
              </div>
              <p className="mb-5 text-sm italic leading-relaxed text-neutral-300">
                "Jobraker turns role briefs into candidate queues, outreach angles,
                and next steps before our team loses the day to tabs."
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1dff00]/25 bg-[#1dff00]/10">
                  <Briefcase className="h-5 w-5 text-[#1dff00]" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Recruiting Ops Lead</div>
                  <div className="text-xs text-neutral-500">High-growth hiring team</div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 text-xs font-medium text-neutral-500">
              <span>Review-first AI</span>
              <span className="text-[#1dff00]/60">•</span>
              <span>Encrypted auth</span>
              <span className="text-[#1dff00]/60">•</span>
              <span>Team-ready web access</span>
            </div>
          </div>
        </motion.aside>

        <motion.main
          initial="hidden"
          animate="visible"
          variants={formMotion}
          className="relative flex w-full items-start justify-center px-5 py-8 sm:px-6 lg:w-1/2 lg:items-center lg:px-14 xl:px-24"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,255,0,0.10),transparent_34%)] lg:hidden" />
          <div className="absolute left-5 right-5 top-6 min-w-0 lg:hidden">
            <BrandMark />
          </div>

          <div className="relative z-10 w-full max-w-sm pt-24 lg:pt-0">
            <a href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-500 transition-colors hover:text-[#1dff00] sm:mb-10 sm:tracking-[0.22em]">
              <ArrowLeft className="h-4 w-4" />
              Back to landing
            </a>

            <motion.div custom={0} initial="hidden" animate="visible" variants={fieldMotion} className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-white">
                {isLogin ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                {isLogin
                  ? 'Enter your credentials to access the Jobraker web workspace.'
                  : 'Create your Jobraker Recruiter account and start from your first role brief.'}
              </p>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <motion.div custom={1} initial="hidden" animate="visible" variants={fieldMotion} className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Full name</label>
                  <div className="group relative">
                    <User className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-600 transition-colors group-focus-within:text-[#1dff00]" />
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#0b0f16] py-3 pl-10 pr-4 text-sm text-white placeholder:text-neutral-700 transition-all focus:border-[#1dff00] focus:outline-none focus:ring-1 focus:ring-[#1dff00]"
                      placeholder="Miles Carter"
                    />
                  </div>
                </motion.div>
              )}

              <motion.div custom={2} initial="hidden" animate="visible" variants={fieldMotion} className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Email</label>
                <div className="group relative">
                  <Mail className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-600 transition-colors group-focus-within:text-[#1dff00]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f16] py-3 pl-10 pr-4 text-sm text-white placeholder:text-neutral-700 transition-all focus:border-[#1dff00] focus:outline-none focus:ring-1 focus:ring-[#1dff00]"
                    placeholder="name@company.com"
                  />
                </div>
              </motion.div>

              <motion.div custom={3} initial="hidden" animate="visible" variants={fieldMotion} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Password</label>
                  {isLogin && (
                    <button type="button" className="text-xs font-bold text-[#1dff00] hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="group relative">
                  <Lock className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-600 transition-colors group-focus-within:text-[#1dff00]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#0b0f16] py-3 pl-10 pr-10 text-sm text-white placeholder:text-neutral-700 transition-all focus:border-[#1dff00] focus:outline-none focus:ring-1 focus:ring-[#1dff00]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 transition-colors hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                {!isLogin && (
                  <div className="mt-2 flex h-1 gap-1">
                    <div className="flex-1 rounded-full bg-[#1dff00]" />
                    <div className="flex-1 rounded-full bg-[#80ff72]" />
                    <div className="flex-1 rounded-full bg-white/10" />
                    <div className="flex-1 rounded-full bg-white/10" />
                  </div>
                )}
              </motion.div>

              <motion.button
                custom={4}
                initial="hidden"
                animate="visible"
                variants={fieldMotion}
                type="submit"
                disabled={isLoading}
                className="group mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-[#1dff00] bg-[#1dff00] py-3.5 text-sm font-bold text-black shadow-[0_0_24px_rgba(29,255,0,0.22)] transition-all hover:bg-[#80ff72] hover:shadow-[0_0_34px_rgba(29,255,0,0.38)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <span className="h-5 w-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign in' : 'Create account'}
                    <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </motion.button>
            </form>

            <motion.div custom={5} initial="hidden" animate="visible" variants={fieldMotion} className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black px-3 text-neutral-500">Or continue with</span>
              </div>
            </motion.div>

            <motion.button
              custom={6}
              initial="hidden"
              animate="visible"
              variants={fieldMotion}
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="group flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-[#0b0f16] px-4 py-3 text-sm font-medium text-white transition-all hover:border-[#1dff00]/45 hover:bg-[#101a12] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <GoogleIcon />
              Google
            </motion.button>

            <motion.div custom={7} initial="hidden" animate="visible" variants={fieldMotion} className="mt-8 text-center">
              <p className="text-sm text-neutral-500">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button
                  type="button"
                  onClick={() => setMode(isLogin ? 'signup' : 'login')}
                  className="ml-2 font-bold text-[#1dff00] hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </motion.div>

            {isLogin && (
              <motion.div custom={8} initial="hidden" animate="visible" variants={fieldMotion} className="mt-8 flex items-start gap-3 rounded-lg border border-[#1dff00]/10 bg-[#1dff00]/5 p-4">
                <Shield className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#1dff00]" />
                <div className="text-xs leading-relaxed text-neutral-500">
                  <span className="mb-0.5 block font-bold text-white">Secure recruiter workspace</span>
                  Authentication is handled through Supabase. Your browser session stays encrypted and account-scoped.
                </div>
              </motion.div>
            )}
          </div>
        </motion.main>
      </div>
    </div>
  )
}
