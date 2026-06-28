import * as React from 'react'
import { motion, type Variants } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Link2,
  Loader2,
  Mail,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  Users,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { createClient } from '@/lib/client'

type SetupMode = 'guided' | 'import'

type OnboardingData = {
  firstName: string
  lastName: string
  companyName: string
  recruiterTitle: string
  location: string
  companyStage: string
  teamSize: string
  hiringVolume: string
  seniorityFocus: string[]
  roleFamilies: string[]
  goals: string[]
  workflow: string[]
  sources: string[]
  ats: string
  importNotes: string
  about: string
  plan: string
}

type Step = {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
}

const STORAGE_KEY = 'jobraker-recruiter:onboarding-draft'

const LazyRecruiterScreens = React.lazy(() =>
  import('@/components/recruiter').then((module) => ({ default: module.RecruiterScreens }))
)

const emptyData: OnboardingData = {
  firstName: '',
  lastName: '',
  companyName: '',
  recruiterTitle: '',
  location: '',
  companyStage: '',
  teamSize: '',
  hiringVolume: '',
  seniorityFocus: [],
  roleFamilies: [],
  goals: [],
  workflow: [],
  sources: [],
  ats: '',
  importNotes: '',
  about: '',
  plan: 'Pro',
}

const steps: Step[] = [
  {
    id: 'profile',
    title: 'Welcome to Jobraker Recruiter',
    subtitle: 'Set up your recruiter profile and company context.',
    icon: Sparkles,
  },
  {
    id: 'hiring',
    title: 'Your Hiring Motion',
    subtitle: 'Tell us what kind of recruiting engine you are building.',
    icon: Target,
  },
  {
    id: 'goals',
    title: 'Recruiting Goals',
    subtitle: 'Choose the outcomes Jobraker should optimize for.',
    icon: ClipboardList,
  },
  {
    id: 'workflow',
    title: 'Workflow Preferences',
    subtitle: 'Shape sourcing, screening, outreach, and collaboration defaults.',
    icon: Wand2,
  },
  {
    id: 'stack',
    title: 'Connect Your Hiring Stack',
    subtitle: 'Map the systems and sources your recruiting team already uses.',
    icon: Link2,
  },
  {
    id: 'plan',
    title: 'Choose Your Recruiting Power',
    subtitle: 'Pick the workspace mode that matches your hiring velocity.',
    icon: Rocket,
  },
]

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const optionClass = (selected: boolean) =>
  [
    'group rounded-xl border p-4 text-left transition-all',
    selected
      ? 'border-[#1dff00] bg-[#1dff00]/10 shadow-[0_0_28px_rgba(29,255,0,0.12)]'
      : 'border-white/10 bg-[#071008] hover:border-[#1dff00]/45 hover:bg-[#0d180f]',
  ].join(' ')

function BrandMark() {
  return (
    <a href="/" className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded bg-[#1dff00] text-black shadow-[0_0_24px_rgba(29,255,0,0.35)]">
        <Search className="h-5 w-5" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.55),transparent)] opacity-60" />
      </div>
      <span className="font-mono text-base font-bold tracking-tight text-white sm:text-xl">
        JOBRAKER <span className="text-[#1dff00]">RECRUITER</span>
      </span>
    </a>
  )
}

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function getSavedDraft(): OnboardingData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData
    return { ...emptyData, ...JSON.parse(raw) }
  } catch {
    return emptyData
  }
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-[#0b0f16] px-4 py-3 text-sm text-white placeholder:text-neutral-700 transition-all focus:border-[#1dff00] focus:outline-none focus:ring-1 focus:ring-[#1dff00]"
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-[#0b0f16] px-4 py-3 text-sm text-white transition-all focus:border-[#1dff00] focus:outline-none focus:ring-1 focus:ring-[#1dff00]"
      >
        <option value="">Select one</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function MultiChoice({
  values,
  selected,
  onChange,
}: {
  values: Array<{ label: string; description?: string; icon?: LucideIcon }>
  selected: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {values.map((item) => {
        const Icon = item.icon
        const isSelected = selected.includes(item.label)
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onChange(toggleValue(selected, item.label))}
            className={optionClass(isSelected)}
          >
            <div className="flex items-start gap-3">
              {Icon ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1dff00]/20 bg-[#1dff00]/10 text-[#1dff00]">
                  <Icon className="h-4 w-4" />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-white">{item.label}</span>
                  {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#1dff00]" /> : null}
                </div>
                {item.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">{item.description}</p>
                ) : null}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SetupModeScreen({
  onChoose,
}: {
  onChoose: (mode: SetupMode) => void
}) {
  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-black px-5 py-10 font-mono text-white">
      <Toaster position="top-right" theme="dark" richColors />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(29,255,0,0.18),transparent_32%),radial-gradient(circle_at_80%_90%,rgba(29,255,0,0.10),transparent_30%),linear-gradient(to_right,rgba(29,255,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(29,255,0,0.04)_1px,transparent_1px)] bg-[size:auto,auto,44px_44px,44px_44px]" />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="relative z-10 w-full max-w-5xl"
      >
        <div className="mb-10 flex justify-center">
          <BrandMark />
        </div>
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Build your recruiter command center.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-neutral-400 sm:text-lg">
            Like Jobraker candidate onboarding, we start with context. For recruiters, that means roles, sources,
            pipeline motion, outreach style, and the systems your hiring team already trusts.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => onChoose('guided')} className={optionClass(false)}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1dff00] text-black">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Guided recruiter setup</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  Answer a structured flow and Jobraker will shape your recruiter workspace, pipeline defaults,
                  and sourcing priorities.
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[#1dff00]">
                  Start guided setup <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </button>
          <button type="button" onClick={() => onChoose('import')} className={optionClass(false)}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#1dff00]/25 bg-[#1dff00]/10 text-[#1dff00]">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Import hiring brief</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  Paste your role brief, ATS notes, source list, or hiring plan. We will keep it as setup context
                  and still walk you through the key recruiter decisions.
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[#1dff00]">
                  Import context <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function StepContent({
  step,
  data,
  update,
  setupMode,
}: {
  step: Step
  data: OnboardingData
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void
  setupMode: SetupMode
}) {
  if (step.id === 'profile') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" value={data.firstName} onChange={(value) => update('firstName', value)} placeholder="Miles" />
        <Field label="Last name" value={data.lastName} onChange={(value) => update('lastName', value)} placeholder="Carter" />
        <Field label="Company" value={data.companyName} onChange={(value) => update('companyName', value)} placeholder="Area 50 Technologies" />
        <Field label="Recruiter title" value={data.recruiterTitle} onChange={(value) => update('recruiterTitle', value)} placeholder="Head of Talent" />
        <Field label="Location" value={data.location} onChange={(value) => update('location', value)} placeholder="Lagos, Remote, Global" />
        <SelectField
          label="Company stage"
          value={data.companyStage}
          onChange={(value) => update('companyStage', value)}
          options={['Pre-seed', 'Seed', 'Series A', 'Growth', 'Enterprise', 'Agency / Search firm']}
        />
        {setupMode === 'import' ? (
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Hiring brief or ATS notes</span>
            <textarea
              value={data.importNotes}
              onChange={(event) => update('importNotes', event.target.value)}
              placeholder="Paste open roles, ideal candidate notes, source lists, scorecard criteria, or hiring manager context..."
              className="min-h-36 w-full rounded-lg border border-white/10 bg-[#0b0f16] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-700 transition-all focus:border-[#1dff00] focus:outline-none focus:ring-1 focus:ring-[#1dff00]"
            />
          </label>
        ) : null}
      </div>
    )
  }

  if (step.id === 'hiring') {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Team size"
            value={data.teamSize}
            onChange={(value) => update('teamSize', value)}
            options={['Solo recruiter', '2-5 recruiters', '6-15 recruiters', '15+ recruiters']}
          />
          <SelectField
            label="Monthly hiring volume"
            value={data.hiringVolume}
            onChange={(value) => update('hiringVolume', value)}
            options={['1-3 roles', '4-10 roles', '11-25 roles', '25+ roles']}
          />
          <SelectField
            label="ATS"
            value={data.ats}
            onChange={(value) => update('ats', value)}
            options={['Greenhouse', 'Lever', 'Ashby', 'Workable', 'BambooHR', 'Spreadsheet / Notion', 'No ATS yet']}
          />
        </div>
        <MultiChoice
          selected={data.roleFamilies}
          onChange={(values) => update('roleFamilies', values)}
          values={[
            { label: 'Engineering', description: 'Software, infra, data, AI, security.', icon: Database },
            { label: 'Product & Design', description: 'PMs, designers, research, growth product.', icon: FileText },
            { label: 'Sales & GTM', description: 'AE, SDR, partnerships, revenue leaders.', icon: Users },
            { label: 'Operations', description: 'People, finance, success, support, ops.', icon: Building2 },
          ]}
        />
        <MultiChoice
          selected={data.seniorityFocus}
          onChange={(values) => update('seniorityFocus', values)}
          values={[
            { label: 'Early career' },
            { label: 'Mid-level' },
            { label: 'Senior IC' },
            { label: 'Manager / Lead' },
            { label: 'Director+' },
            { label: 'Executive search' },
          ]}
        />
      </div>
    )
  }

  if (step.id === 'goals') {
    return (
      <MultiChoice
        selected={data.goals}
        onChange={(values) => update('goals', values)}
        values={[
          { label: 'Source net-new candidates', description: 'Find qualified prospects from targeted talent pools.', icon: Search },
          { label: 'Improve candidate quality', description: 'Use evidence, scorecards, and match signals.', icon: BadgeCheck },
          { label: 'Speed up screening', description: 'Summarize profiles, resumes, and role fit quickly.', icon: ShieldCheck },
          { label: 'Draft personalized outreach', description: 'Generate sharp messages from candidate context.', icon: Mail },
          { label: 'Manage pipeline follow-up', description: 'Keep stage movement, reminders, and next steps clear.', icon: ClipboardList },
          { label: 'Report hiring performance', description: 'Track conversion, source quality, and role velocity.', icon: Target },
        ]}
      />
    )
  }

  if (step.id === 'workflow') {
    return (
      <div className="space-y-5">
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Recruiter operating notes</span>
          <textarea
            value={data.about}
            onChange={(event) => update('about', event.target.value)}
            placeholder="Example: We hire senior AI engineers for product teams. We care about shipped systems, startup pace, clear writing, and strong ownership..."
            className="min-h-32 w-full rounded-lg border border-white/10 bg-[#0b0f16] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-700 transition-all focus:border-[#1dff00] focus:outline-none focus:ring-1 focus:ring-[#1dff00]"
          />
        </label>
        <MultiChoice
          selected={data.workflow}
          onChange={(values) => update('workflow', values)}
          values={[
            { label: 'Review-first AI recommendations', description: 'AI drafts, recruiter approves before action.' },
            { label: 'Strict scorecards', description: 'Every candidate evaluated against role criteria.' },
            { label: 'Hiring manager summaries', description: 'Readable candidate briefs for team review.' },
            { label: 'Automated follow-up reminders', description: 'Never lose promising candidates in limbo.' },
            { label: 'Interview scheduling support', description: 'Prepare calendar-ready next steps.' },
            { label: 'Talent rediscovery', description: 'Reuse prior pipeline and silver-medalist candidates.' },
          ]}
        />
      </div>
    )
  }

  if (step.id === 'stack') {
    return (
      <div className="space-y-5">
        <MultiChoice
          selected={data.sources}
          onChange={(values) => update('sources', values)}
          values={[
            { label: 'LinkedIn', description: 'Profiles, sourcing lists, recruiter notes.' },
            { label: 'GitHub', description: 'Engineering signals, projects, open-source activity.' },
            { label: 'Google Sheets', description: 'Existing pipeline spreadsheets and shortlists.' },
            { label: 'Gmail', description: 'Outreach history and follow-up context.' },
            { label: 'Calendar', description: 'Interview loops, availability, scheduling.' },
            { label: 'ATS exports', description: 'CSV or copied role/candidate context.' },
          ]}
        />
        <div className="rounded-xl border border-[#1dff00]/15 bg-[#1dff00]/5 p-4 text-sm leading-relaxed text-neutral-400">
          You can connect real accounts later. This step tells Jobraker which integrations and prompts to prioritize
          when the recruiter dashboard starts.
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { name: 'Starter', price: '$0', copy: 'Validate the workflow with a small hiring slate.' },
        { name: 'Pro', price: '$49', copy: 'Best for active recruiters sourcing every week.' },
        { name: 'Team', price: '$149', copy: 'Shared workflows, reporting, and hiring manager reviews.' },
      ].map((plan) => {
        const selected = data.plan === plan.name
        return (
          <button
            key={plan.name}
            type="button"
            onClick={() => update('plan', plan.name)}
            className={optionClass(selected)}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              {selected ? <CheckCircle2 className="h-5 w-5 text-[#1dff00]" /> : null}
            </div>
            <div className="mt-4 text-3xl font-bold text-[#1dff00]">{plan.price}</div>
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">{plan.copy}</p>
          </button>
        )
      })}
    </div>
  )
}

function SummaryPanel({ data, setupMode }: { data: OnboardingData; setupMode: SetupMode }) {
  const rows = [
    ['Mode', setupMode === 'import' ? 'Import brief' : 'Guided setup'],
    ['Company', data.companyName || 'Not set'],
    ['Hiring volume', data.hiringVolume || 'Not set'],
    ['Goals', data.goals.length ? `${data.goals.length} selected` : 'Not set'],
    ['Sources', data.sources.length ? data.sources.join(', ') : 'Not set'],
    ['Plan', data.plan],
  ]

  return (
    <aside className="hidden rounded-2xl border border-[#1dff00]/15 bg-[#050807]/85 p-5 shadow-[0_0_50px_rgba(29,255,0,0.08)] xl:block">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1dff00] text-black">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Setup snapshot</p>
          <p className="text-xs text-neutral-500">Saved locally as you go</p>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-600">{label}</p>
            <p className="mt-1 text-sm text-neutral-300">{value}</p>
          </div>
        ))}
      </div>
    </aside>
  )
}

export function RecruiterOnboardingView() {
  const [setupMode, setSetupMode] = React.useState<SetupMode | null>(null)
  const [currentStep, setCurrentStep] = React.useState(0)
  const [data, setData] = React.useState<OnboardingData>(() => getSavedDraft())
  const [saving, setSaving] = React.useState(false)
  const supabase = React.useMemo(() => createClient(), [])

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const update = React.useCallback(<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((previous) => ({ ...previous, [key]: value }))
  }, [])

  async function completeOnboarding() {
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const recruiterContext = {
        setup_mode: setupMode,
        company_stage: data.companyStage,
        team_size: data.teamSize,
        hiring_volume: data.hiringVolume,
        seniority_focus: data.seniorityFocus,
        role_families: data.roleFamilies,
        workflow: data.workflow,
        sources: data.sources,
        ats: data.ats,
        import_notes: data.importNotes,
        selected_plan: data.plan,
        completed_at: new Date().toISOString(),
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      window.localStorage.setItem('jobraker-recruiter:onboarding-complete', 'true')

      if (!user) {
        toast.success('Onboarding saved. Sign in to sync it to your recruiter profile.')
        navigateTo('/login')
        return
      }

      const { error } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          first_name: data.firstName || null,
          last_name: data.lastName || null,
          company_name: data.companyName || null,
          job_title: data.recruiterTitle || null,
          location: data.location || null,
          about: data.about || null,
          goals: data.goals,
          skills: [...data.roleFamilies, ...data.workflow].slice(0, 40),
          socials: { recruiter_onboarding: recruiterContext },
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

      if (error) throw error

      toast.success('Recruiter onboarding complete.')
      navigateTo('/dashboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete onboarding. Please try again.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (!setupMode) {
    return <SetupModeScreen onChoose={setSetupMode} />
  }

  const step = steps[currentStep]
  const Icon = step.icon
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="min-h-[100svh] overflow-x-hidden bg-black font-mono text-white selection:bg-[#1dff00] selection:text-black">
      <Toaster position="top-right" theme="dark" richColors />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(29,255,0,0.16),transparent_30%),radial-gradient(circle_at_90%_100%,rgba(29,255,0,0.10),transparent_34%),linear-gradient(to_right,rgba(29,255,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(29,255,0,0.04)_1px,transparent_1px)] bg-[size:auto,auto,44px_44px,44px_44px]" />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <BrandMark />
        <button
          type="button"
          onClick={() => navigateTo('/')}
          className="hidden text-xs font-bold uppercase tracking-[0.18em] text-neutral-500 transition-colors hover:text-[#1dff00] sm:inline-flex"
        >
          Exit setup
        </button>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-7xl gap-6 px-5 pb-10 pt-4 sm:px-8 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <nav className="rounded-2xl border border-[#1dff00]/15 bg-[#050807]/85 p-4">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#1dff00]/25 bg-[#1dff00]/10 text-[#1dff00]">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Step {currentStep + 1} of {steps.length}</p>
              <p className="text-xs text-neutral-500">{Math.round(progress)}% configured</p>
            </div>
          </div>
          <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-[#1dff00]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>
          <div className="space-y-2">
            {steps.map((item, index) => {
              const ItemIcon = item.icon
              const active = index === currentStep
              const complete = index < currentStep
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all',
                    active ? 'bg-[#1dff00] text-black' : 'text-neutral-500 hover:bg-white/5 hover:text-white',
                  ].join(' ')}
                >
                  <ItemIcon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{item.title}</span>
                  {complete ? <Check className="h-4 w-4 shrink-0 text-[#1dff00]" /> : null}
                </button>
              )
            })}
          </div>
        </nav>

        <section className="rounded-2xl border border-[#1dff00]/15 bg-[#050807]/90 p-5 shadow-[0_0_70px_rgba(29,255,0,0.10)] sm:p-8">
          <motion.div key={step.id} initial="hidden" animate="visible" variants={fadeUp}>
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#1dff00]">
                {setupMode === 'import' ? 'Import-assisted setup' : 'Guided setup'}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{step.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:text-base">{step.subtitle}</p>
            </div>

            <StepContent step={step} data={data} update={update} setupMode={setupMode} />

            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 0) {
                    setSetupMode(null)
                    return
                  }
                  setCurrentStep((value) => Math.max(0, value - 1))
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#0b0f16] px-5 py-3 text-sm font-bold text-neutral-400 transition-colors hover:border-[#1dff00]/45 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (currentStep === steps.length - 1) {
                    void completeOnboarding()
                    return
                  }
                  setCurrentStep((value) => Math.min(steps.length - 1, value + 1))
                }}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#1dff00] bg-[#1dff00] px-5 py-3 text-sm font-bold text-black shadow-[0_0_24px_rgba(29,255,0,0.22)] transition-colors hover:bg-[#80ff72] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving setup...
                  </>
                ) : currentStep === steps.length - 1 ? (
                  <>
                    Activate recruiter workspace
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </section>

        <SummaryPanel data={data} setupMode={setupMode} />
      </main>
    </div>
  )
}

export function RecruiterDashboardView() {
  const [screen, setScreen] = React.useState<'roles' | 'candidates' | 'pipeline' | 'analytics' | 'sourcing'>('roles')

  const navItems: Array<{ id: typeof screen; label: string }> = [
    { id: 'roles', label: 'Roles' },
    { id: 'sourcing', label: 'Sourcing' },
    { id: 'candidates', label: 'Candidates' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'analytics', label: 'Analytics' },
  ]

  return (
    <div className="min-h-[100svh] bg-black font-mono text-white">
      <header className="sticky top-0 z-30 border-b border-[#1dff00]/15 bg-black/90 px-5 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark />
          <nav className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScreen(item.id)}
                className={[
                  'rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                  screen === item.id ? 'bg-[#1dff00] text-black' : 'border border-white/10 text-neutral-400 hover:text-white',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <React.Suspense
        fallback={
          <div className="flex min-h-[70svh] items-center justify-center text-[#1dff00]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        }
      >
        <LazyRecruiterScreens screen={screen} onNavigate={(nextScreen) => setScreen(nextScreen)} />
      </React.Suspense>
    </div>
  )
}
