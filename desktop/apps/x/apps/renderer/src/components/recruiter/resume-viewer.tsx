import * as React from 'react'
import { motion } from 'motion/react'
import {
  X,
  Maximize2,
  Minimize2,
  Download,
  Briefcase,
  GraduationCap,
  Sparkles,
  Mail,
  MapPin,
  Clock,
  Check,
  FileText,
  FileDown,
  Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Candidate, initials, avatarGradient } from './data'
import { toast } from 'sonner'

interface ResumeData {
  summary: string
  education: Array<{ degree: string; school: string; period: string }>
  experience: Array<{
    role: string
    company: string
    period: string
    bullets: string[]
    skillsUsed: string[]
  }>
  projects: Array<{ name: string; description: string }>
  languages: string[]
}

// Rich detailed resumes for main candidates
const MOCK_RESUMES: Record<string, ResumeData> = {
  c1: {
    summary: 'Senior Product Designer with 4+ years of experience building design systems and intuitive user interfaces for high-growth B2B and consumer tech applications. Proven track record leading design cycle phases from extensive user research to production-ready interactive prototyping.',
    education: [
      { degree: 'B.Sc. in Creative Design', school: 'University of Lagos', period: '2018 - 2022' },
      { degree: 'Certified Interaction Design Specialist', school: 'Interaction Design Foundation', period: '2022' }
    ],
    experience: [
      {
        role: 'Lead UX Designer',
        company: 'Stitch Labs',
        period: '2024 - Present',
        bullets: [
          'Led design system revamp that improved frontend implementation efficiency and consistency by 40%.',
          'Conducted 30+ comprehensive user research sessions, translating user pain points into actionable workflows.',
          'Designed and shipped 15+ complex dashboard features, resulting in a 25% increase in monthly active users.'
        ],
        skillsUsed: ['Product Design', 'Figma', 'User Research', 'Design Systems']
      },
      {
        role: 'Product Designer',
        company: 'Paywise Financials',
        period: '2022 - 2024',
        bullets: [
          'Owned end-to-end interface design for new payment gateway checkout flow, decreasing drop-off rates by 18%.',
          'Built high-fidelity interactive prototypes in Figma for executive buy-in and developer specifications.',
          'Established shared components library, standardizing typography, UI grid structures, and interactive states.'
        ],
        skillsUsed: ['Product Design', 'Figma', 'Prototyping']
      }
    ],
    projects: [
      { name: 'Helix UI System', description: 'Open-source design system template with 200+ Figma components optimized for accessibility and automated dark modes.' },
      { name: 'FinFlow Checkout', description: 'Redesigned mobile checkout experience utilizing micro-interactions to ease multi-card billing processes.' }
    ],
    languages: ['English (Native)', 'Yoruba (Fluent)']
  },
  c2: {
    summary: 'Dedicated Product Designer specializing in fintech platforms. Expert at translating complex analytical flows into clear, goal-driven visual systems. 5 years of experience collaborating closely with product managers and engineers in agile environments.',
    education: [
      { degree: 'B.A. in Fine Arts', school: 'Obafemi Awolowo University', period: '2016 - 2020' }
    ],
    experience: [
      {
        role: 'Senior Fintech Designer',
        company: 'Apex Capital',
        period: '2023 - Present',
        bullets: [
          'Scaled a 0→1 investment tracker app to 250K active users within 12 months.',
          'Created animated micro-interactions that boosted user onboarding completion rates by 32%.',
          'Mentored and guided 3 junior designers through UI layout constraints and typography structures.'
        ],
        skillsUsed: ['Product Design', 'Figma', 'Motion']
      },
      {
        role: 'UI Designer',
        company: 'SoftForge Services',
        period: '2020 - 2023',
        bullets: [
          'Designed customizable analytics dashboard reporting systems for business clients.',
          'Implemented design review audits to align design layouts closer to React component limitations.'
        ],
        skillsUsed: ['Design Systems', 'Figma']
      }
    ],
    projects: [
      { name: 'Apex Trader Lite', description: 'Compact brokerage app dashboard showcasing real-time asset pricing feeds.' }
    ],
    languages: ['English (Native)']
  },
  c3: {
    summary: 'UX/UI Designer with a focus on visual polish, responsive marketing pages, and WCAG accessibility compliance. Adept at turning static layouts into dynamic, responsive web experiences.',
    education: [
      { degree: 'Diploma in Web Design', school: 'NIIT Lagos', period: '2019 - 2021' }
    ],
    experience: [
      {
        role: 'Freelance Web Designer',
        company: 'Self-employed',
        period: '2022 - Present',
        bullets: [
          'Redesigned marketing and landing sites for 10+ clients, lifting landing page conversions by average of 22%.',
          'Configured custom Webflow sites with advanced grid animations and custom typography pairings.',
          'Ensured WCAG AA level accessibility standards were met across all client digital portals.'
        ],
        skillsUsed: ['UI Design', 'Figma', 'Webflow', 'Accessibility']
      }
    ],
    projects: [
      { name: 'A11y Grid Kit', description: 'Accessible components reference guide for semantic HTML headers and landmarks.' }
    ],
    languages: ['English (Native)', 'Igbo (Conversational)']
  }
}

// Helper to generate mock resume details for custom/newly added candidates
function generateFallbackResume(candidate: Candidate): ResumeData {
  return {
    summary: `Motivated and accomplished ${candidate.title || 'Professional'} based in ${candidate.location || 'Remote'}. Over ${candidate.experienceYears || '3'} years of experience focusing on ${candidate.skills.slice(0, 3).join(', ')}. Strong team player with a dedication to delivering top-tier project results.`,
    education: [
      { degree: 'B.Sc. in Computer Science & Engineering', school: 'Tech Institute', period: '2017 - 2021' }
    ],
    experience: [
      {
        role: candidate.title || 'Professional',
        company: 'Innovate Solutions Ltd.',
        period: '2021 - Present',
        bullets: candidate.highlights.length > 0 ? candidate.highlights : [
          'Led core developments on primary features, delivering them ahead of schedule.',
          'Coordinated with multidisciplinary teams to ensure UI assets matched development endpoints.',
          'Troubleshot bottleneck operations, optimization loading flows by 20%.'
        ],
        skillsUsed: candidate.skills.slice(0, 3)
      }
    ],
    projects: [
      { name: 'Project Synergy', description: 'Coordinated task automation service simplifying pipeline tracking metrics.' }
    ],
    languages: ['English (Fluent)']
  }
}

interface ResumeViewerProps {
  candidate: Candidate | null
  onClose: () => void
}

export function ResumeViewer({ candidate, onClose }: ResumeViewerProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [downloadState, setDownloadState] = React.useState<'idle' | 'generating' | 'downloading' | 'done'>('idle')
  const [selectedSkill, setSelectedSkill] = React.useState<string | null>(null)
  
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    // Reset state when candidate changes
    setDownloadState('idle')
    setSelectedSkill(null)
  }, [candidate])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  if (!candidate) return null

  const resume = MOCK_RESUMES[candidate.id] || generateFallbackResume(candidate)

  const handleDownload = () => {
    if (downloadState !== 'idle') return

    setDownloadState('generating')
    
    // Simulate steps of compiler
    setTimeout(() => {
      setDownloadState('downloading')
      
      setTimeout(() => {
        // Trigger actual download of Markdown representation of CV
        const cvContent = `
# ${candidate.name}
**${candidate.title}** · ${candidate.location}
Email: ${candidate.email}

---

## PROFESSIONAL SUMMARY
${resume.summary}

## SKILLS
${candidate.skills.join(' | ')}

## EXPERIENCE
${resume.experience.map(exp => `
### ${exp.role} @ ${exp.company} (${exp.period})
${exp.bullets.map(b => `* ${b}`).join('\n')}
Skills: ${exp.skillsUsed.join(', ')}
`).join('\n')}

## EDUCATION
${resume.education.map(edu => `
### ${edu.degree}
${edu.school} (${edu.period})
`).join('\n')}

## LANGUAGES
${resume.languages.join(', ')}
        `.trim()

        const blob = new Blob([cvContent], { type: 'text/markdown;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `${candidate.name.replace(/\s+/g, '_')}_Resume.md`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setDownloadState('done')
        toast.success(`Resume downloaded for ${candidate.name}!`, {
          description: "Structured Markdown file downloaded successfully.",
        })

        setTimeout(() => {
          setDownloadState('idle')
        }, 2000)
      }, 800)
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end overflow-hidden">
      {/* Dim backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Slide-over panel */}
      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 220 }}
        className={cn(
          "group relative z-10 flex h-full flex-col border-l border-zinc-800/80 bg-zinc-950/90 shadow-2xl backdrop-blur-xl transition-all duration-300",
          isFullscreen ? "w-full" : "w-full md:w-[min(650px,90vw)]"
        )}
      >
        {/* Interactive Radial glow backlighting */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(500px circle at ${mousePos.x}px ${mousePos.y}px, rgba(29, 255, 0, 0.03), transparent 75%)`,
          }}
        />

        {/* Top toolbar header */}
        <div className="relative z-10 flex h-14 items-center justify-between border-b border-zinc-900 bg-zinc-950/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <FileText className="size-4.5 text-brand" />
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Interactive Resume</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Expand / fullscreen toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex size-9 items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-900/40 text-muted-foreground transition hover:border-brand/40 hover:text-foreground cursor-pointer"
              title={isFullscreen ? "Collapse" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>

            {/* Simulated PDF compiler and downloader */}
            <button
              type="button"
              onClick={handleDownload}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition cursor-pointer",
                downloadState === 'idle'
                  ? "border-zinc-800/60 bg-zinc-900/40 text-muted-foreground hover:border-brand/40 hover:text-foreground"
                  : "border-brand/40 bg-brand/10 text-brand"
              )}
              disabled={downloadState !== 'idle'}
            >
              {downloadState === 'idle' && (
                <>
                  <Download className="size-3.5" />
                  <span>Download CV</span>
                </>
              )}
              {downloadState === 'generating' && (
                <>
                  <Cpu className="size-3.5 animate-spin" />
                  <span>Compiling PDF...</span>
                </>
              )}
              {downloadState === 'downloading' && (
                <>
                  <FileDown className="size-3.5 animate-bounce" />
                  <span>Downloading...</span>
                </>
              )}
              {downloadState === 'done' && (
                <>
                  <Check className="size-3.5 text-brand" />
                  <span>Downloaded!</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="mx-1 h-5 w-px bg-zinc-800/80" />

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-900/40 text-muted-foreground transition hover:border-red-500/40 hover:text-red-400 cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable CV body */}
        <div className="recruiter-scroll relative z-10 flex-1 overflow-y-auto p-6 md:p-8">
          <div className="space-y-8">
            {/* Header / Bio section */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <span
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl ring-2 ring-brand/40"
                  style={{ background: avatarGradient(candidate.name) }}
                >
                  <span className="text-lg font-bold text-black">{initials(candidate.name)}</span>
                </span>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">{candidate.name}</h1>
                  <p className="text-xs font-medium text-brand">{candidate.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {candidate.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" />
                      {candidate.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* Match Score Badge */}
              <div className="flex items-center gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-3 sm:self-center">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Match Score</p>
                  <p className="text-lg font-bold text-brand">{candidate.matchScore}%</p>
                </div>
                <div className="size-10 rounded-full border-2 border-brand/40 flex items-center justify-center bg-brand/10">
                  <Sparkles className="size-4.5 text-brand" />
                </div>
              </div>
            </motion.div>

            {/* AI Summary / Assessment */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-4 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-brand/5 via-transparent to-transparent pointer-events-none" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
                <Sparkles className="size-3.5" />
                AI Summary & Fit Assessment
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{resume.summary}</p>
            </motion.div>

            {/* Interactive Core Skills badging */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Skills Directory</h3>
                {selectedSkill && (
                  <button
                    type="button"
                    onClick={() => setSelectedSkill(null)}
                    className="text-[10px] font-medium text-brand hover:underline cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((skill) => {
                  const active = selectedSkill === skill
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => setSelectedSkill(active ? null : skill)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
                        active
                          ? "border-brand/40 bg-brand/20 text-brand"
                          : "border-zinc-800 bg-zinc-900/30 text-muted-foreground hover:border-brand/30 hover:text-foreground"
                      )}
                    >
                      {skill}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/60 italic">
                Tip: Click any skill to highlight where it was applied in work history below.
              </p>
            </motion.div>

            {/* Work History Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-4"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Professional Timeline</h3>

              <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-1.5 before:bottom-1.5 before:w-px before:bg-zinc-800">
                {resume.experience.map((exp) => {
                  // Check if this experience contains the selected skill
                  const isHighlighted = selectedSkill ? exp.skillsUsed.includes(selectedSkill) : false
                  const hasSelection = selectedSkill !== null

                  return (
                    <div
                      key={exp.role + exp.company}
                      className={cn(
                        "relative transition-all duration-300",
                        hasSelection && !isHighlighted ? "opacity-35" : "opacity-100"
                      )}
                    >
                      {/* Timeline dot */}
                      <span
                        className={cn(
                          "absolute -left-[22px] top-1.5 size-2.5 rounded-full border-2 transition-all duration-300",
                          isHighlighted
                            ? "border-brand bg-brand shadow-[0_0_8px_#1dff00]"
                            : "border-zinc-800 bg-zinc-950"
                        )}
                      />

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-start justify-between gap-1.5">
                          <div>
                            <h4 className="text-xs font-bold text-foreground">{exp.role}</h4>
                            <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                              <Briefcase className="size-3 text-muted-foreground/80" />
                              {exp.company}
                            </p>
                          </div>
                          <span className="flex items-center gap-1 rounded bg-zinc-900/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/80">
                            <Clock className="size-2.5" />
                            {exp.period}
                          </span>
                        </div>

                        {/* Bullets */}
                        <ul className="space-y-1.5 pl-3 pt-1">
                          {exp.bullets.map((bullet, bIdx) => {
                            // Highlights details of experiences containing selected skill
                            return (
                              <li
                                key={bIdx}
                                className={cn(
                                  "list-disc text-[11px] leading-relaxed text-muted-foreground/90 transition-all duration-300",
                                  isHighlighted && "text-foreground font-medium"
                                )}
                              >
                                {bullet}
                              </li>
                            )
                          })}
                        </ul>

                        {/* Experience specific skills tags */}
                        <div className="flex flex-wrap gap-1 pt-2">
                          {exp.skillsUsed.map(s => (
                            <span
                              key={s}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors",
                                selectedSkill === s
                                  ? "bg-brand/20 text-brand"
                                  : "bg-zinc-900/60 text-muted-foreground/60"
                              )}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* Education Section */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4 border-t border-zinc-900 pt-6"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <GraduationCap className="size-4 text-brand" />
                Education & Credentials
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {resume.education.map((edu, idx) => (
                  <div key={idx} className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-4">
                    <h4 className="text-xs font-bold text-foreground">{edu.degree}</h4>
                    <p className="text-[11px] text-muted-foreground mt-1">{edu.school}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                      <Clock className="size-2.5" />
                      {edu.period}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Projects & Languages grid */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="grid gap-6 border-t border-zinc-900 pt-6 md:grid-cols-[1.8fr_1fr]"
            >
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key Projects</h3>
                <div className="space-y-2">
                  {resume.projects.map((proj, idx) => (
                    <div key={idx} className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-3">
                      <h4 className="text-xs font-semibold text-foreground">{proj.name}</h4>
                      <p className="text-[10px] leading-relaxed text-muted-foreground mt-1">{proj.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Languages</h3>
                <div className="flex flex-col gap-1.5">
                  {resume.languages.map((lang, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-zinc-900/40 bg-zinc-900/10 px-3 py-2 text-[11px]">
                      <span className="font-medium text-foreground">{lang.split(' ')[0]}</span>
                      <span className="text-[10px] text-brand">{lang.split(' ')[1] || 'Fluent'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </motion.div>
    </div>
  )
}
