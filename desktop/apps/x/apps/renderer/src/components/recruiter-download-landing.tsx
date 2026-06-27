import * as React from 'react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bot,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Code,
  Database,
  Download,
  FileText,
  Github,
  Linkedin,
  Mail,
  MessageSquare,
  Mic,
  Quote,
  Search,
  Send,
  Server,
  type LucideIcon,
} from 'lucide-react'

const WINDOWS_INSTALLER_PATH =
  'https://github.com/mylife-as-miles/Jobraker-Recruiters/releases/download/v0.1.0/Jobraker.Recruiter-win32-x64-0.1.0.zip'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
}

const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

function DownloadButton({
  location,
  children = 'DOWNLOAD WINDOWS APP',
  variant = 'solid',
}: {
  location: string
  children?: React.ReactNode
  variant?: 'solid' | 'outline'
}) {
  const className =
    variant === 'solid'
      ? 'bg-[#1dff00] text-black hover:bg-[#80ff72] border-[#1dff00] hover:shadow-[0_0_20px_rgba(29,255,0,0.4)]'
      : 'bg-transparent text-[#1dff00] border-[#1dff00] hover:bg-[#1dff00]/10'

  return (
    <a
      href={WINDOWS_INSTALLER_PATH}
      download
      data-cta-location={location}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-none border px-6 text-base font-bold transition-all sm:w-auto ${className}`}
    >
      {children}
      {variant === 'solid' ? <Download className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
    </a>
  )
}

function AnimatedSection({
  children,
  className = '',
  delay = 0,
  id,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  id?: string
}) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function EarthOrb() {
  const rings = [
    'h-[320px] w-[320px] border-[#1dff00]/15',
    'h-[250px] w-[250px] border-[#1dff00]/25',
    'h-[180px] w-[180px] border-white/10',
  ]

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
        className="absolute h-[420px] w-[420px] rounded-full border border-dashed border-[#1dff00]/20"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 100, repeat: Infinity, ease: 'linear' }}
        className="absolute h-[520px] w-[520px] rounded-full border border-[#1dff00]/10"
      />
      <div className="absolute h-[360px] w-[360px] rounded-full bg-[#1dff00]/10 blur-[90px]" />
      <div className="relative h-[300px] w-[300px] rounded-full border border-[#1dff00]/25 bg-black shadow-[inset_0_0_70px_rgba(29,255,0,0.08),0_0_80px_rgba(29,255,0,0.18)] md:h-[360px] md:w-[360px]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(29,255,0,0.32),transparent_18%),radial-gradient(circle_at_65%_70%,rgba(29,255,0,0.18),transparent_24%),radial-gradient(circle_at_center,transparent_45%,rgba(29,255,0,0.08)_70%,transparent_72%)]" />
        <div className="absolute inset-0 rounded-full bg-[linear-gradient(to_right,rgba(29,255,0,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(29,255,0,0.10)_1px,transparent_1px)] bg-[size:34px_34px] opacity-35 [mask-image:radial-gradient(circle,#000_55%,transparent_72%)]" />
        {rings.map((ring) => (
          <motion.div
            key={ring}
            animate={{ rotate: ring.includes('white') ? -360 : 360 }}
            transition={{ duration: ring.includes('250') ? 42 : 58, repeat: Infinity, ease: 'linear' }}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${ring}`}
          />
        ))}
        {['Recruiters', 'Candidates', 'Roles', 'Signals'].map((label, index) => {
          const positions = [
            'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
            'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
            'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
            'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
          ]

          return (
            <div
              key={label}
              className={`absolute ${positions[index]} rounded-xl border border-[#1dff00]/25 bg-black/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1dff00] backdrop-blur`}
            >
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HeroSection() {
  return (
    <div className="relative flex min-h-screen w-full flex-col justify-center overflow-hidden bg-black px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1dff000a_1px,transparent_1px),linear-gradient(to_bottom,#1dff000a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-12 lg:flex-row lg:gap-20">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="z-20 flex-1 space-y-8 pt-10 text-center lg:pt-0 lg:text-left"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center space-x-2 rounded-full border border-[#1dff00]/30 bg-[#1dff00]/5 px-3 py-1 font-mono text-xs uppercase tracking-widest text-[#1dff00]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1dff00] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1dff00]" />
            </span>
            <span>AI recruiter agent ready</span>
          </motion.div>

          <motion.h1 variants={fadeUp} className="font-mono text-4xl font-bold leading-[0.9] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Stop recruiting <br />
            <span className="bg-gradient-to-r from-[#1dff00] via-[#80ff72] to-white bg-clip-text text-transparent">
              one profile at a time
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mx-auto max-w-xl font-mono text-sm leading-relaxed text-neutral-400 sm:text-base md:text-lg lg:mx-0">
            Jobraker Recruiter turns your roles, candidates, notes, inbox, and
            calendar into a desktop AI command center. Source stronger-fit
            talent, rank matches with evidence, draft outreach, and move the
            pipeline while you stay in control.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row lg:justify-start">
            <DownloadButton location="hero" />
            <a
              href="#workflow-section"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-none border border-[#1dff00] bg-transparent px-6 font-mono text-base text-[#1dff00] transition-all hover:bg-[#1dff00]/10 sm:w-auto"
            >
              SEE THE WORKFLOW
              <ArrowRight className="h-5 w-5" />
            </a>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center justify-center space-x-8 pt-8 font-mono text-sm text-neutral-500 lg:justify-start">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[#1dff00]">Review-first</span>
              <span>human approvals stay visible</span>
            </div>
            <div className="h-4 w-px bg-neutral-800" />
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[#1dff00]">Local-first</span>
              <span>workspace data stays close</span>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: 18 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative -mt-10 flex h-[420px] w-full flex-1 items-center justify-center perspective-1000 sm:h-[520px] lg:mt-0 lg:h-[620px]"
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1dff00] opacity-15 blur-[150px]" />
          <EarthOrb />
        </motion.div>
      </div>
    </div>
  )
}

function SocialProof() {
  const companies = [
    'Founders',
    'Recruiters',
    'Hiring Managers',
    'People Ops',
    'Agencies',
    'Startups',
    'GTM Teams',
    'Technical Hiring',
  ]

  return (
    <div className="relative w-full overflow-hidden border-y border-[#1dff00]/10 bg-black py-12">
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black via-transparent to-black" />
      <div className="mb-8 text-center">
        <p className="font-mono text-sm uppercase tracking-widest text-gray-500">
          Built for teams hiring across high-intent knowledge roles
        </p>
      </div>

      <div className="relative flex overflow-hidden">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
          className="flex whitespace-nowrap space-x-12 sm:space-x-24"
        >
          {[...companies, ...companies].map((company, index) => (
            <div key={`${company}-${index}`} className="flex items-center space-x-2 opacity-50 transition-opacity hover:opacity-100">
              <span className="font-mono text-xl font-bold text-white/80 md:text-2xl">
                {company}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

function KanbanCard() {
  const columns = [
    {
      title: 'Sourced',
      cards: ['Senior Product Designer', 'Backend Engineer', 'n8n Developer'],
    },
    {
      title: 'Screening',
      cards: ['Data Analyst', 'Growth Designer'],
    },
    {
      title: 'Interview',
      cards: ['Teni Ogunleye', 'Femi Okoro'],
    },
  ]

  return (
    <div className="grid h-full grid-cols-3 gap-3 p-4">
      {columns.map((column) => (
        <div key={column.title} className="rounded-xl border border-white/5 bg-black/30 p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              {column.title}
            </span>
            <span className="rounded-full bg-[#1dff00]/10 px-2 py-0.5 text-[10px] text-[#1dff00]">
              {column.cards.length}
            </span>
          </div>
          <div className="space-y-3">
            {column.cards.map((card, index) => (
              <motion.div
                key={card}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-lg border border-white/10 bg-[#0d1117] p-3 shadow-[0_0_20px_rgba(29,255,0,0.04)]"
              >
                <div className="mb-2 h-2 w-3/4 rounded bg-white/15" />
                <div className="h-2 w-1/2 rounded bg-[#1dff00]/25" />
                <p className="mt-3 truncate text-xs text-white">{card}</p>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ScanningVisual() {
  return (
    <div className="relative h-full min-h-[170px] overflow-hidden p-4">
      <motion.div
        animate={{ y: ['-20%', '115%'] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-0 right-0 top-0 h-12 bg-gradient-to-b from-[#1dff00]/0 via-[#1dff00]/25 to-[#1dff00]/0"
      />
      <div className="space-y-3">
        {['TypeScript', 'Web scraping', 'n8n', 'Startup fit', 'Lagos or remote'].map((skill, index) => (
          <div key={skill} className="flex items-center gap-3">
            <CheckCircle2 className={`h-4 w-4 ${index < 3 ? 'text-[#1dff00]' : 'text-white/25'}`} />
            <div className="h-2 flex-1 rounded bg-white/10">
              <div className="h-full rounded bg-[#1dff00]/40" style={{ width: `${88 - index * 12}%` }} />
            </div>
            <span className="w-20 truncate text-[10px] text-neutral-500">{skill}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatVisual() {
  const messages = [
    ['Agent', 'Teni has senior product evidence plus Lagos availability.'],
    ['You', 'Draft outreach with portfolio-specific angle.'],
    ['Agent', 'Ready. I cited her design system case study.'],
  ]

  return (
    <div className="flex min-h-[170px] flex-col justify-end gap-3 p-4">
      {messages.map(([speaker, text], index) => (
        <motion.div
          key={`${speaker}-${index}`}
          initial={{ opacity: 0, x: speaker === 'You' ? 12 : -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.12 }}
          className={`max-w-[88%] rounded-2xl border border-white/10 p-3 text-xs leading-relaxed ${
            speaker === 'You' ? 'ml-auto bg-[#1dff00]/10 text-white' : 'bg-black/40 text-neutral-300'
          }`}
        >
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[#1dff00]">
            {speaker}
          </span>
          {text}
        </motion.div>
      ))}
    </div>
  )
}

function VoiceInteractionVisual() {
  return (
    <div className="flex h-full min-h-[220px] w-full items-center justify-center gap-2">
      {[28, 52, 86, 130, 94, 60, 34].map((height, index) => (
        <motion.span
          key={`${height}-${index}`}
          animate={{ height: [height * 0.45, height, height * 0.55] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.08, ease: 'easeInOut' }}
          className="w-3 rounded-full bg-[#1dff00]"
          style={{ height }}
        />
      ))}
    </div>
  )
}

function BentoGrid() {
  const smallCards: Array<{ icon: LucideIcon; title: string; body: string; tone: string; visual: React.ReactNode }> = [
    {
      icon: FileText,
      title: 'Evidence-rich candidate profiles',
      body: 'Match each candidate to the role with sharper, role-specific context.',
      tone: 'text-blue-400 border-blue-500/20 bg-blue-500/10',
      visual: <ScanningVisual />,
    },
    {
      icon: MessageSquare,
      title: 'Ask your agent anything',
      body: 'Review drafts, follow-ups, interview notes, and next steps in one place.',
      tone: 'text-[#1dff00] border-[#1dff00]/20 bg-[#1dff00]/10',
      visual: <ChatVisual />,
    },
  ]

  return (
    <section className="relative overflow-hidden bg-black py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-full max-w-7xl -translate-x-1/2">
        <div className="absolute left-[10%] top-[20%] h-[400px] w-[400px] rounded-full bg-[#1dff00]/5 blur-[100px]" />
        <div className="absolute bottom-[20%] right-[10%] h-[300px] w-[300px] rounded-full bg-cyan-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs uppercase tracking-widest text-gray-300 backdrop-blur-sm"
          >
            <Bot className="mr-2 h-3 w-3 text-[#1dff00]" />
            Recruiting Automation Stack
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mb-6 font-sans text-4xl font-bold tracking-tight text-white md:text-6xl"
          >
            Turn scattered hiring work into <br />
            <span className="bg-gradient-to-r from-[#1dff00] to-[#1dff00] bg-clip-text text-transparent">
              a pipeline that keeps moving.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg font-light leading-relaxed text-gray-400 md:text-xl"
          >
            Manual sourcing drains your best hours. Jobraker Recruiter helps you
            find the right people, draft the right message, and move faster
            without losing control.
          </motion.p>
        </div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          <motion.div variants={fadeUp} className="group relative col-span-1 row-span-2 overflow-hidden rounded-3xl border border-white/10 bg-black md:col-span-2">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative z-10 flex h-full flex-col p-8">
              <div className="mb-8">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#1dff00]/20 bg-[#1dff00]/10">
                  <Activity className="h-5 w-5 text-[#1dff00]" />
                </div>
                <h3 className="mb-2 text-2xl font-semibold text-white">
                  Hire without the repetition
                </h3>
                <p className="max-w-md text-gray-400">
                  Your agent finds relevant candidates, prepares outreach, and
                  moves each prospect through a reviewable pipeline.
                </p>
              </div>

              <div className="relative min-h-[250px] w-full flex-1 overflow-hidden rounded-xl border border-white/5 bg-[#15171A]">
                <KanbanCard />
              </div>
            </div>
          </motion.div>

          {smallCards.map((card) => (
            <motion.div key={card.title} variants={fadeUp} className="group relative col-span-1 row-span-1 overflow-hidden rounded-3xl border border-white/10 bg-black">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="flex h-full flex-col p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${card.tone}`}>
                    <card.icon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mb-1 text-lg font-semibold text-white">{card.title}</h3>
                <p className="mb-4 text-sm text-gray-400">{card.body}</p>
                <div className="relative flex-1 overflow-hidden rounded-lg border border-white/5 bg-[#15171A]">
                  {card.visual}
                </div>
              </div>
            </motion.div>
          ))}

          <motion.div variants={fadeUp} className="group relative col-span-1 flex flex-col items-center gap-8 overflow-hidden rounded-3xl border border-white/10 bg-black p-8 md:col-span-3 md:flex-row">
            <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative z-10 flex-1">
              <div className="mb-4 inline-flex items-center rounded-full bg-[#1dff00]/10 px-3 py-1 text-xs font-bold text-[#1dff00]">
                <Mic className="mr-2 h-3 w-3" />
                INTERVIEW MODE
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-white">
                Prep the interview from the real candidate evidence
              </h3>
              <p className="mb-6 text-gray-400">
                Rehearse questions against the role, candidate background, and
                scorecard before the recruiter call, not after it.
              </p>
              <a href="#workflow-section" className="flex items-center text-sm font-semibold text-white transition-colors hover:text-[#1dff00]">
                Practice the screen <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
            <div className="relative flex min-h-[220px] w-full flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-[#15171A]">
              <VoiceInteractionVisual />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function LiveDemo() {
  const logs = [
    { type: 'info', text: 'Starting Jobraker Recruiter agent workflow...' },
    { type: 'success', text: 'Roles, candidate base, and hiring notes loaded.' },
    { type: 'action', text: 'Searching for high-fit senior product designers...', icon: <Search className="h-3 w-3 text-[#1dff00]" /> },
    { type: 'info', text: 'New matches queued for review.' },
    { type: 'process', text: 'Comparing candidate evidence against role scorecard...' },
    { type: 'success', text: 'Top 12 candidates ranked with reasons.' },
    { type: 'action', text: 'Drafting personalized outreach...', icon: <FileText className="h-3 w-3 text-[#1dff00]" /> },
    { type: 'success', text: 'Outreach draft ready for approval.' },
    { type: 'action', text: 'Preparing interview scheduling notes...', icon: <Send className="h-3 w-3 text-[#1dff00]" /> },
    { type: 'success', text: 'Pipeline updated.' },
    { type: 'info', text: 'Continuing search cycle...' },
  ]

  const [currentLogIndex, setCurrentLogIndex] = React.useState(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentLogIndex((previous) => (previous + 1) % logs.length)
    }, 2000)
    return () => window.clearInterval(interval)
  }, [logs.length])

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentLogIndex])

  return (
    <div className="mx-auto w-full max-w-lg font-mono text-xs sm:text-sm">
      <div className="overflow-hidden rounded-lg border border-[#1dff00]/30 bg-black/80 shadow-[0_0_30px_rgba(29,255,0,0.15)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-[#1dff00]/20 bg-[#1dff00]/10 px-4 py-2">
          <div className="flex items-center space-x-2">
            <div className="h-3 w-3 rounded-full bg-[#1dff00]/80" />
            <div className="h-3 w-3 rounded-full bg-[#1dff00]/80" />
            <div className="h-3 w-3 rounded-full bg-[#1dff00]/80" />
          </div>
          <div className="flex items-center space-x-1 text-[#1dff00]/60">
            <Activity className="h-3 w-3" />
            <span>AI_AGENT_ACTIVE</span>
          </div>
        </div>

        <div ref={scrollRef} className="h-[300px] space-y-2 overflow-y-auto p-4">
          <AnimatePresence initial={false}>
            {logs.slice(0, currentLogIndex + 1).map((log, index) => (
              <motion.div
                key={`${log.text}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start space-x-2"
              >
                <span className="shrink-0 text-[#1dff00]/40">
                  [{new Date().toLocaleTimeString()}]
                </span>
                <div className="flex items-center space-x-2">
                  {log.type === 'success' && <Check className="h-3 w-3 text-[#1dff00]" />}
                  {log.type === 'process' && <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#1dff00] border-t-transparent" />}
                  {log.icon}
                  <span className={log.type === 'success' ? 'text-[#1dff00]' : log.type === 'info' ? 'text-gray-400' : 'text-white'}>
                    {log.text}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="mt-2 flex items-center space-x-2">
            <span className="animate-pulse text-[#1dff00]">_</span>
          </div>
        </div>

        <div className="flex justify-between border-t border-[#1dff00]/20 bg-[#1dff00]/5 px-4 py-2 text-[10px] uppercase tracking-wider text-[#1dff00]/60">
          <span>CPU: 12%</span>
          <span>MEM: 432MB</span>
          <span>NET: CONNECTED</span>
        </div>
      </div>
    </div>
  )
}

function DashboardPreview() {
  return (
    <div className="relative z-20 mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-6 font-sans text-3xl font-bold tracking-tight text-white md:text-5xl"
        >
          Control the pipeline, not the busywork
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto max-w-2xl text-lg font-light leading-relaxed text-gray-400 md:text-xl"
        >
          Approve, pause, refine, and track every move from one dashboard built
          for serious recruiting momentum.
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 60, opacity: 0, rotateX: 20 }}
        whileInView={{ y: 0, opacity: 1, rotateX: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative perspective-1000"
      >
        <div className="absolute inset-0 z-0 scale-75 rounded-full bg-[#1dff00] opacity-10 blur-[100px]" />
        <div className="relative z-10 overflow-hidden rounded-xl border border-[#1dff00]/20 bg-black shadow-[0_0_50px_rgba(29,255,0,0.15)] backdrop-blur-sm">
          <div className="flex h-10 items-center space-x-2 border-b border-[#1dff00]/10 bg-black/50 px-4">
            <div className="h-3 w-3 rounded-full border border-[#1dff00]/50 bg-[#1dff00]/20" />
            <div className="h-3 w-3 rounded-full border border-[#1dff00]/50 bg-[#1dff00]/20" />
            <div className="h-3 w-3 rounded-full border border-[#1dff00]/50 bg-[#1dff00]/20" />
            <div className="ml-4 flex h-6 flex-1 items-center rounded border border-[#1dff00]/10 bg-black/30 px-3 font-mono text-[10px] text-gray-600">
              app.jobraker.local/recruiter
            </div>
          </div>

          <div className="p-1">
            <div className="grid grid-cols-1 gap-1 md:grid-cols-3">
              <div className="hidden space-y-4 border-r border-[#1dff00]/10 bg-black/20 p-4 md:col-span-1 md:block">
                <div className="mb-6 h-8 w-24 rounded bg-[#1dff00]/10" />
                <div className="h-4 w-full rounded bg-white/10" />
                <div className="h-4 w-3/4 rounded bg-white/10" />
                <div className="h-4 w-5/6 rounded bg-white/10" />
                <div className="relative mt-8 h-32 w-full overflow-hidden rounded border border-[#1dff00]/20 bg-black/40">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1dff00]/10 to-transparent" />
                </div>
              </div>

              <div className="col-span-2 flex min-h-[400px] flex-col items-center justify-center bg-black/40 p-4 md:p-8">
                <div className="mb-6 text-center">
                  <h3 className="mb-2 font-mono text-xl text-[#1dff00]">
                    AGENT WORKFLOW LIVE
                  </h3>
                  <p className="font-mono text-xs text-gray-500">
                    ID: recruiter-8f92-a1b2
                  </p>
                </div>
                <LiveDemo />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function IntegrationsSection() {
  const innerOrbitIcons: Array<{ name: string; icon: React.ReactNode }> = [
    { name: 'Gmail', icon: <Mail className="h-5 w-5" /> },
    { name: 'Outlook', icon: <Mail className="h-5 w-5" /> },
    { name: 'Calendar', icon: <CalendarCheck className="h-5 w-5" /> },
    { name: 'Notes', icon: <FileText className="h-5 w-5" /> },
  ]

  const outerOrbitIcons: Array<{ name: string; icon: React.ReactNode }> = [
    { name: 'LinkedIn', icon: <Linkedin className="h-6 w-6" /> },
    { name: 'Elastic', icon: <Database className="h-6 w-6" /> },
    { name: 'GitHub', icon: <Code className="h-6 w-6" /> },
    { name: 'ATS', icon: <Briefcase className="h-6 w-6" /> },
    { name: 'Workspace', icon: <Server className="h-6 w-6" /> },
  ]

  return (
    <section className="relative flex min-h-[800px] flex-col justify-center overflow-hidden bg-black py-24">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1dff00]/5 blur-3xl" />

      <div className="relative z-10 mx-auto mb-12 px-4 text-center">
        <h2 className="mb-6 font-mono text-4xl font-bold tracking-tight text-white md:text-6xl">
          YOUR HIRING,{' '}
          <span className="bg-gradient-to-r from-[#1dff00] to-[#1dff00] bg-clip-text text-transparent">
            ONE COMMAND CENTER
          </span>
        </h2>
        <p className="mx-auto max-w-2xl font-mono text-lg text-gray-400">
          Connect workspace data, email, notes, Elastic retrieval, candidate
          records, and calendar context so great candidates do not get lost
          across tabs.
        </p>
      </div>

      <div className="relative flex h-[600px] w-full items-center justify-center overflow-visible">
        <div className="absolute z-20">
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute h-32 w-32 rounded-full bg-[#1dff00]/20 blur-xl"
            />
            <div className="relative z-20 flex h-20 w-20 items-center justify-center rounded-full border border-[#1dff00]/50 bg-black shadow-[0_0_30px_rgba(29,255,0,0.3)] backdrop-blur-sm">
              <Bot className="h-10 w-10 text-[#1dff00]" />
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="absolute h-24 w-24 rounded-full border-t-2 border-[#1dff00] opacity-50"
            />
          </div>
        </div>

        <div className="absolute z-10">
          <div className="relative flex h-[300px] w-[300px] items-center justify-center rounded-full border border-white/5">
            <div className="absolute inset-0 animate-[spin_60s_linear_infinite] rounded-full border border-dashed border-white/10" />
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} className="absolute inset-0">
              {innerOrbitIcons.map((item, index) => {
                const angle = (index / innerOrbitIcons.length) * 360
                return (
                  <div key={item.name} className="absolute left-1/2 top-0 h-full w-full -translate-x-1/2 -translate-y-1/2" style={{ transform: `rotate(${angle}deg)` }}>
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                      <motion.div animate={{ rotate: -360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} className="group flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black text-gray-300 shadow-lg transition-all duration-300 hover:scale-110 hover:border-[#1dff00] hover:text-white">
                        {item.icon}
                        <div className="absolute top-full mt-2 whitespace-nowrap rounded border border-white/10 bg-black px-2 py-1 text-xs text-[#1dff00] opacity-0 transition-opacity group-hover:opacity-100">
                          {item.name}
                        </div>
                      </motion.div>
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </div>
        </div>

        <div className="absolute z-10">
          <div className="relative flex h-[500px] w-[500px] items-center justify-center rounded-full border border-white/5">
            <div className="absolute inset-0 rounded-full border border-white/5 opacity-50" />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 100, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 rounded-full border-t border-white/20" />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }} className="absolute inset-0">
              {outerOrbitIcons.map((item, index) => {
                const angle = (index / outerOrbitIcons.length) * 360
                return (
                  <div key={item.name} className="absolute left-1/2 top-0 h-full w-full -translate-x-1/2 -translate-y-1/2" style={{ transform: `rotate(${angle}deg)` }}>
                    <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }} className="group flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black text-gray-300 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-[#1dff00] hover:text-white">
                        {item.icon}
                        <div className="absolute top-full mt-2 whitespace-nowrap rounded border border-white/10 bg-black px-2 py-1 text-xs text-[#1dff00] opacity-0 transition-opacity group-hover:opacity-100">
                          {item.name}
                        </div>
                      </motion.div>
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </div>
        </div>

        <div className="pointer-events-none absolute z-0 h-[700px] w-[700px] opacity-30">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 120, repeat: Infinity, ease: 'linear' }} className="relative h-full w-full">
            <div className="absolute left-1/2 top-0 h-2 w-2 rounded-full bg-[#1dff00] blur-[2px]" />
            <div className="absolute bottom-1/4 right-0 h-1 w-1 rounded-full bg-white blur-[1px]" />
            <div className="absolute left-0 top-1/3 h-1.5 w-1.5 rounded-full bg-[#1dff00] blur-[1px]" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function LargeTestimonial() {
  return (
    <section className="border-y border-[#1dff00]/10 bg-black py-24">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <Quote className="mx-auto mb-8 h-12 w-12 text-[#1dff00] opacity-50" />
        <h3 className="mb-8 font-mono text-3xl font-bold leading-tight text-white md:text-5xl">
          "Hiring should not depend on how many tabs your team can keep open.
          Let the agent handle the repetitive search work so your energy goes
          into better conversations, sharper evaluation, and faster decisions."
        </h3>
        <div className="flex flex-col items-center">
          <div className="mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-[#1dff00] to-black" />
          <div className="font-mono text-lg font-bold text-white">
            Jobraker Recruiter
          </div>
          <div className="font-mono text-sm text-[#1dff00]">
            Autonomous recruiting command center
          </div>
        </div>
      </div>
    </section>
  )
}

function PricingSection() {
  const cards = [
    {
      title: 'Windows desktop app',
      body: 'Download the packaged recruiter command center and run it locally on Windows.',
      icon: Download,
    },
    {
      title: 'Agent-ready workspace',
      body: 'Candidates, roles, pipeline, notes, meetings, and outreach live in one controllable app.',
      icon: Bot,
    },
    {
      title: 'Evidence-backed matching',
      body: 'Use Elastic-style retrieval and semantic filtering to explain why a candidate fits.',
      icon: BadgeCheck,
    },
  ]

  return (
    <section className="bg-black py-24 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.28em] text-[#1dff00]/70">
            Download
          </p>
          <h2 className="font-mono text-3xl font-bold md:text-5xl">
            Install the recruiter agent and start from your own data
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 md:text-lg">
            The landing page has one job: get the Windows app onto the machine
            where the real recruiting work happens.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <div key={card.title} className="rounded-xl border border-[#1dff00]/15 bg-[#0b0f16] p-7 transition-colors hover:border-[#1dff00]/45">
              <card.icon className="mb-7 h-8 w-8 text-[#1dff00]" />
              <h3 className="font-mono text-xl font-bold">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-neutral-400">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <DownloadButton location="download_section">DOWNLOAD WINDOWS APP</DownloadButton>
        </div>
      </div>
    </section>
  )
}

function TestimonialGridSection() {
  const proofPoints = [
    {
      label: 'Time sink',
      before: 'Recruiting days should not disappear into the same search fields.',
      after: 'Jobraker prepares candidate queues and actions from your role brief so your energy goes into decisions.',
    },
    {
      label: 'Blank page',
      before: 'Every outreach message needs to feel written for the candidate.',
      after: 'Outreach starts from role requirements, candidate evidence, and the angle most likely to matter.',
    },
    {
      label: 'Candidate quality',
      before: 'Not every profile deserves a recruiter follow-up.',
      after: 'Fit signals help you prioritize stronger candidates before you spend time on another weak lead.',
    },
    {
      label: 'Pipeline clarity',
      before: 'Sourced, screened, waiting, and scheduled should never blur together.',
      after: 'Your dashboard keeps each candidate visible, organized, and ready for the next action.',
    },
    {
      label: 'Trust controls',
      before: 'Automation only works when you can slow it down.',
      after: 'Review-first workflows let you approve, revise, or skip important actions before they happen.',
    },
    {
      label: 'Interview prep',
      before: 'Generic screening does not prepare you for a specific candidate.',
      after: 'Prep starts from the role, candidate notes, and evidence, so your questions connect to the real conversation ahead.',
    },
  ]

  return (
    <section className="bg-black py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.28em] text-[#1dff00]/70">
            Proof points
          </p>
          <h2 className="font-mono text-3xl font-bold text-white md:text-5xl">
            Why teams stop doing it <span className="text-[#1dff00]">manually</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 md:text-lg">
            Jobraker Recruiter is built around the moments that slow hiring
            down: repetitive search, weak fit signals, scattered tracking, and
            generic candidate prep.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {proofPoints.map((point, index) => (
            <motion.div
              key={point.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.22, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }}
              className="group relative overflow-hidden rounded-xl border border-[#1dff00]/15 bg-[#0b0f16] p-7 transition-colors duration-200 hover:border-[#1dff00]/45"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1dff00]/70 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <div className="mb-7 flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[#1dff00]">
                  {point.label}
                </span>
                <span className="font-mono text-xs text-neutral-600">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="min-h-[84px] font-mono text-xl leading-relaxed text-white">
                "{point.before}"
              </p>
              <div className="mt-7 flex gap-3 border-t border-white/10 pt-5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#1dff00]" />
                <p className="text-sm leading-relaxed text-neutral-400">{point.after}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQSection() {
  const faqs = [
    {
      question: 'What exactly gets downloaded?',
      answer: 'The CTA downloads the packaged Windows build of Jobraker Recruiter as a zip. Extract it and run the desktop app from the packaged folder.',
    },
    {
      question: 'Is this the same as the web app?',
      answer: 'No. The public browser build is the landing page. The downloaded Windows app opens the full recruiter command center with candidate, role, pipeline, outreach, meetings, and agent workflows.',
    },
    {
      question: 'Can I stay in control before actions happen?',
      answer: 'Yes. The product is designed around review-first workflows so you can approve, revise, or skip important sourcing, outreach, and scheduling actions.',
    },
    {
      question: 'What does Elastic add?',
      answer: 'Elastic-style retrieval gives the agent fast semantic search, filters, and evidence-backed matching across candidates, roles, notes, workspaces, knowledge, bases, and graph-like context.',
    },
    {
      question: 'Does the agent handle browser logins?',
      answer: 'Sensitive logins stay delegated to the user browser. The agent can prepare the work and guide navigation without taking ownership of credentials.',
    },
    {
      question: 'Why a Windows desktop app?',
      answer: 'Recruiting work touches local files, browser sessions, notes, email, and calendar state. A desktop app gives the agent a safer, more controllable workspace for real tasks.',
    },
  ]

  const [openIndex, setOpenIndex] = React.useState<number | null>(0)

  return (
    <section className="mx-auto max-w-3xl bg-black px-4 py-24">
      <h2 className="mb-12 text-center font-mono text-3xl font-bold text-white md:text-5xl">
        SYSTEM <span className="text-[#1dff00]">FAQ</span>
      </h2>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div key={faq.question} className="overflow-hidden rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="flex w-full items-center justify-between bg-black p-6 text-left transition-colors hover:bg-white/5"
            >
              <span className="font-mono font-bold text-white">{faq.question}</span>
              <ChevronDown className={`h-5 w-5 text-[#1dff00] transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="border-t border-white/5 p-6 pt-0 font-mono text-sm leading-relaxed text-gray-400">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="relative overflow-hidden bg-black py-24">
      <div className="absolute inset-0 z-0 bg-[#1dff00]/5" />
      <div className="relative z-10 mx-auto px-4 text-center">
        <h2 className="mb-8 font-mono text-4xl font-bold tracking-tighter text-white md:text-7xl">
          YOUR NEXT HIRE
          <br />
          SHOULD NOT <span className="text-[#1dff00]">TAKE ALL NIGHT.</span>
        </h2>
        <p className="mx-auto mb-12 max-w-2xl font-mono text-xl text-gray-400">
          Start with your roles. Let Jobraker Recruiter find stronger-fit
          candidates, prepare sharper outreach, and keep your pipeline moving.
        </p>
        <DownloadButton location="bottom_cta">DOWNLOAD WINDOWS APP</DownloadButton>
      </div>
    </section>
  )
}

function FooterSection() {
  const productLinks = [
    ['Features', '#features-section'],
    ['Workflow', '#workflow-section'],
    ['Download', WINDOWS_INSTALLER_PATH],
    ['Hackathon', 'https://googlecloudmultiagents.devpost.com/'],
  ]

  const legalLinks = [
    ['Privacy', '#faq-section'],
    ['Terms', '#faq-section'],
    ['Security', '#faq-section'],
  ]

  return (
    <footer className="border-t border-[#1dff00]/10 bg-black pb-8 pt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="col-span-1 md:col-span-2">
            <div className="mb-6 flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center overflow-clip rounded">
                <img src="/logo.jpeg" alt="Jobraker Recruiter logo" className="h-full w-full object-cover" />
              </div>
              <span className="text-xl font-bold tracking-tighter text-white">
                JOBRAKER <span className="text-[#1dff00]">RECRUITER</span>
              </span>
            </div>
            <p className="max-w-sm text-sm text-gray-500">
              Autonomous recruiting tools for teams who want fewer repetitive
              searches and a clearer path to better candidate conversations.
            </p>
          </div>

          <div>
            <h4 className="mb-6 text-sm font-bold uppercase tracking-wider text-white">
              Product
            </h4>
            <ul className="space-y-4 text-sm text-gray-500">
              {productLinks.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="transition-colors hover:text-[#1dff00]">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-sm font-bold uppercase tracking-wider text-white">
              Legal
            </h4>
            <ul className="space-y-4 text-sm text-gray-500">
              {legalLinks.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="transition-colors hover:text-[#1dff00]">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between border-t border-white/5 pt-8 md:flex-row">
          <p className="mb-4 text-xs text-gray-600 md:mb-0">
            Copyright {new Date().getFullYear()} Jobraker Recruiter. Built for
            serious hiring momentum.
          </p>
          <div className="flex space-x-6">
            <a href="mailto:support@jobraker.io" className="text-gray-500 transition-colors hover:text-[#1dff00]">
              <Mail className="h-5 w-5" />
            </a>
            <a href="https://github.com/mylife-as-miles/Jobraker-Recruiters" target="_blank" rel="noreferrer" className="text-gray-500 transition-colors hover:text-[#1dff00]">
              <Github className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function RecruiterDownloadLanding() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black font-mono text-white selection:bg-[#1dff00] selection:text-black">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-[#1dff00]/20 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
          <a href="#top" className="flex cursor-pointer items-center space-x-2">
            <div className="h-8 w-8 overflow-clip rounded">
              <img src="/logo.jpeg" alt="Jobraker Recruiter logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-xl font-bold tracking-tighter text-white">
              JOBRAKER <span className="text-[#1dff00]">RECRUITER</span>
            </span>
          </a>

          <div className="hidden items-center gap-8 text-xs font-bold uppercase tracking-[0.22em] text-neutral-500 md:flex">
            <a href="#features-section" className="transition-colors hover:text-[#1dff00]">Features</a>
            <a href="#workflow-section" className="transition-colors hover:text-[#1dff00]">Workflow</a>
            <a href="#faq-section" className="transition-colors hover:text-[#1dff00]">FAQ</a>
          </div>

          <DownloadButton location="nav" variant="solid">
            DOWNLOAD
          </DownloadButton>
        </div>
      </nav>

      <div id="top" className="relative z-10">
        <main className="relative mx-auto min-h-[60vh]">
          <HeroSection />
        </main>

        <AnimatedSection className="relative z-10 mx-auto mt-10 max-w-[1320px] px-3 sm:px-6 md:mt-20 lg:px-8" delay={0.1}>
          <SocialProof />
        </AnimatedSection>

        <AnimatedSection id="features-section" className="relative z-10 mx-auto mt-12 max-w-[1320px] sm:mt-16 md:mt-20" delay={0.2}>
          <BentoGrid />
        </AnimatedSection>

        <AnimatedSection className="relative z-20 mt-12 w-full bg-black/50 sm:mt-16 md:mt-20" delay={0.1}>
          <DashboardPreview />
        </AnimatedSection>

        <AnimatedSection id="workflow-section" className="relative z-10 mx-auto mt-8 max-w-[1320px] sm:mt-12 md:mt-16" delay={0.2}>
          <IntegrationsSection />
        </AnimatedSection>

        <AnimatedSection className="relative z-10 mx-auto mt-8 max-w-[1320px] sm:mt-12 md:mt-16" delay={0.2}>
          <LargeTestimonial />
        </AnimatedSection>

        <AnimatedSection id="download-section" className="relative z-10 mx-auto mt-8 max-w-[1320px] sm:mt-12 md:mt-16" delay={0.2}>
          <PricingSection />
        </AnimatedSection>

        <AnimatedSection id="proof-section" className="relative z-10 mx-auto mt-8 max-w-[1320px] sm:mt-12 md:mt-16" delay={0.2}>
          <TestimonialGridSection />
        </AnimatedSection>

        <AnimatedSection id="faq-section" className="relative z-10 mx-auto mt-8 max-w-[1320px] sm:mt-12 md:mt-16" delay={0.2}>
          <FAQSection />
        </AnimatedSection>

        <AnimatedSection className="relative z-10 mx-auto mt-8 max-w-[1320px] sm:mt-12 md:mt-16" delay={0.2}>
          <CTASection />
        </AnimatedSection>

        <AnimatedSection className="relative z-10 mx-auto mt-8 max-w-[1320px] sm:mt-12 md:mt-16" delay={0.2}>
          <FooterSection />
        </AnimatedSection>
      </div>
    </div>
  )
}
