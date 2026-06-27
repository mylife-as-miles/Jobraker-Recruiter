import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import type { OnboardingState } from "../use-onboarding-state"

interface WelcomeStepProps {
  state: OnboardingState
}

export function WelcomeStep({ state }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center flex-1">
      {/* Logo with ambient glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 size-16 rounded-2xl bg-brand/15 blur-xl scale-[2.5]" />
        <img src="/logo-only.png" alt="Jobraker Recruiter" className="relative size-16 rounded-2xl object-cover brand-glow" />
      </motion.div>

      {/* Tagline badge */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3.5 py-1.5 text-xs font-medium text-muted-foreground mb-6"
      >
        <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
        Your AI recruiting copilot
      </motion.div>

      {/* Main heading */}
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold tracking-tight mb-3"
      >
        Welcome to Jobraker Recruiter
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-base text-muted-foreground leading-relaxed max-w-sm mb-10"
      >
        Go from open role to qualified pipeline in hours, not weeks. Describe your ideal candidate in plain English, search 800M+ profiles, and launch personalized outreach the same day — built for lean teams that can't wait on headcount.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-xs"
      >
        <Button
          onClick={() => {
            state.setOnboardingPath('byok')
            state.setCurrentStep(1)
          }}
          size="lg"
          className="w-full h-12 text-base font-medium"
        >
          Start with my own API key
        </Button>
      </motion.div>
    </div>
  )
}
