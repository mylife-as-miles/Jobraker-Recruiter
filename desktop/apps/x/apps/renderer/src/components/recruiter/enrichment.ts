import type {
  Candidate,
  CandidateEducation,
  CandidateExperience,
  CompanyStage,
  GrowthTrajectory,
  VestingStatus,
  IntentSignal,
} from './data'

export type EnrichmentProvider = 'pdl' | 'enrich.so'

export type EnrichmentResult = {
  success: boolean
  provider: EnrichmentProvider
  candidate: Partial<Candidate>
  rawResponse?: any
  error?: string
}

const STORAGE_KEYS = {
  pdl: 'jobraker-recruiter-ui:api-key:pdl',
  enrichso: 'jobraker-recruiter-ui:api-key:enrichso',
}

export function getApiKey(provider: EnrichmentProvider): string | null {
  return localStorage.getItem(STORAGE_KEYS[provider === 'pdl' ? 'pdl' : 'enrichso'])
}

export function setApiKey(provider: EnrichmentProvider, key: string): void {
  localStorage.setItem(STORAGE_KEYS[provider === 'pdl' ? 'pdl' : 'enrichso'], key.trim())
}

export function clearApiKey(provider: EnrichmentProvider): void {
  localStorage.removeItem(STORAGE_KEYS[provider === 'pdl' ? 'pdl' : 'enrichso'])
}

// Generate realistic mock data based on the LinkedIn URL slug for instant demo capability
export function generateMockEnrichment(url: string, provider: EnrichmentProvider): Partial<Candidate> {
  // Extract a name from the URL slug, e.g., "https://www.linkedin.com/in/sarah-chen-3a1b2c" -> "Sarah Chen"
  let slug = 'john-doe'
  try {
    const urlObj = new URL(url)
    const paths = urlObj.pathname.split('/').filter(Boolean)
    if (paths[0] === 'in' && paths[1]) {
      slug = paths[1]
    } else if (paths[0]) {
      slug = paths[0]
    }
  } catch (e) {
    // Fallback if URL is invalid or simple string
    slug = url.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || 'candidate-slug'
  }

  // Format slug to Name
  const cleanSlug = slug.split('-').filter(p => isNaN(Number(p))).join(' ')
  const name = cleanSlug
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'John Doe'

  // Deterministic choices based on name length/hash
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  const titles = [
    'Lead Frontend Engineer',
    'Senior Product Designer',
    'VP of Engineering',
    'Staff AI Researcher',
    'Growth Product Manager',
    'Full Stack Engineer',
  ]
  const title = titles[hash % titles.length]

  const locations = [
    'San Francisco, CA',
    'New York, NY',
    'Austin, TX',
    'Seattle, WA',
    'Remote, US',
    'London, UK',
    'Berlin, Germany',
  ]
  const location = locations[hash % locations.length]

  const skillsPool = [
    ['React', 'TypeScript', 'Next.js', 'TailwindCSS', 'Web Performance', 'GraphQL', 'System Design'],
    ['Figma', 'Product Design', 'User Research', 'Design Systems', 'Prototyping', 'Interaction Design'],
    ['Engineering Management', 'System Architecture', 'Agile', 'Team Scaling', 'Technical Strategy'],
    ['Python', 'PyTorch', 'Large Language Models', 'Transformers', 'Reinforcement Learning', 'NLP'],
    ['Growth Hacking', 'A/B Testing', 'Product Analytics', 'SQL', 'User Acquisition', 'Funnels'],
    ['Node.js', 'Go', 'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'Redis', 'Microservices'],
  ]
  const skills = skillsPool[hash % skillsPool.length]

  const companies = ['Stripe', 'Linear', 'Vercel', 'Airbnb', 'Brex', 'Ramp', 'Figma']
  const prevCompanies = ['Google', 'Meta', 'Uber', 'Coinbase', 'Dropbox']

  const currentCompany = companies[hash % companies.length]
  const prevCompany1 = prevCompanies[hash % prevCompanies.length]
  const prevCompany2 = prevCompanies[(hash + 1) % prevCompanies.length]

  const experienceYears = (hash % 8) + 4 // 4 to 11 years

  const email = `${name.toLowerCase().replace(/\s+/g, '.')}@${currentCompany.toLowerCase()}.com`

  const headline = `${title} at ${currentCompany} | ex-${prevCompany1}, ${prevCompany2}`
  const summary = `Driven ${title.toLowerCase()} with over ${experienceYears} years of experience building high-performance systems and user-centric products. Passionate about startup culture, clean code, and pushing the boundaries of web experiences. Active open-source contributor.`

  // Generate experiences
  const experience: CandidateExperience[] = [
    {
      company: currentCompany,
      title: title,
      startDate: 'Jan 2024',
      isCurrent: true,
    },
    {
      company: prevCompany1,
      title: `Senior ${title.split(' ').slice(1).join(' ') || 'Engineer'}`,
      startDate: 'Aug 2021',
      endDate: 'Dec 2023',
      isCurrent: false,
    },
    {
      company: prevCompany2,
      title: title.split(' ').slice(1).join(' ') || 'Engineer',
      startDate: 'Jun 2019',
      endDate: 'Jul 2021',
      isCurrent: false,
    },
  ]

  // Generate education
  const schools = ['Stanford University', 'UC Berkeley', 'MIT', 'Carnegie Mellon', 'University of Waterloo']
  const degrees = ['B.S.', 'M.S.']
  const fields = ['Computer Science', 'Human-Computer Interaction', 'Electrical Engineering']
  
  const education: CandidateEducation[] = [
    {
      school: schools[hash % schools.length],
      degree: degrees[hash % degrees.length],
      field: fields[hash % fields.length],
      startYear: 2015,
      endYear: 2019,
    },
  ]

  const companyStages: CompanyStage[] = ['Seed', 'Series A', 'Series B']
  const growthTrajectories: GrowthTrajectory[] = ['Fast', 'Moderate']
  const vestingStatuses: VestingStatus[] = ['Partially Vested', 'Unvested', 'Fully Vested']
  const intentSignals: IntentSignal[] = ['High Engagement', 'Actively Sourcing', 'Passive']

  // Photo URLs from Unsplash for realistic mockup
  const photoIds = [
    'photo-1534528741775-53994a69daeb', // Woman
    'photo-1507003211169-0a1dd7228f2d', // Man
    'photo-1539571696357-5a69c17a67c6', // Man
    'photo-1494790108377-be9c29b29330', // Woman
    'photo-1506794778202-cad84cf45f1d', // Man
    'photo-1508214751196-bcfd4ca60f91', // Woman
  ]
  const photoUrl = `https://images.unsplash.com/${photoIds[hash % photoIds.length]}?w=150&h=150&fit=crop&crop=faces&q=80`

  return {
    name,
    title,
    location,
    experienceYears,
    matchScore: (hash % 25) + 75, // 75 to 99
    stage: 'New',
    source: provider === 'pdl' ? 'PDL Enrichment' : 'Enrich.so',
    lastActivity: 'Just now',
    fit: (hash % 3 === 0) ? 'High fit' : 'Recommended',
    skills,
    highlights: [
      `Developed core features at ${currentCompany} improving metrics by ${((hash % 15) + 10)}%`,
      `Led cross-functional design and engineering initiatives at ${prevCompany1}`,
      `Graduated with Honors from ${education[0].school}`,
    ],
    aiInsight: `${name} shows an exceptional background in early-stage growth environments. Strong fit for agile team configurations but may require competitive equity matching.`,
    note: `Automatically enriched from LinkedIn profile (${url}).`,
    email,
    companyStages: [companyStages[hash % companyStages.length], companyStages[(hash + 1) % companyStages.length]],
    growthTrajectory: growthTrajectories[hash % growthTrajectories.length],
    vestingStatus: vestingStatuses[hash % vestingStatuses.length],
    intentSignal: intentSignals[hash % intentSignals.length],
    startupFitScore: (hash % 20) + 80, // 80 to 99
    startupFitInsight: `Proven ability to ship quickly in ${currentCompany}'s pace. Background at ${prevCompany1} demonstrates solid scaling principles.`,
    
    // Enrichment fields
    linkedinUrl: url,
    enrichedAt: new Date().toISOString(),
    enrichmentSource: provider,
    photoUrl,
    headline,
    summary,
    education,
    experience,
    emails: [email, `${slug}@gmail.com`],
    phones: ['+1 (555) 019-2834'],
    socialProfiles: {
      github: `https://github.com/${slug}`,
      twitter: `https://twitter.com/${slug}`,
    },
  }
}

export async function enrichLinkedInProfile(
  url: string,
  provider: EnrichmentProvider = 'pdl'
): Promise<EnrichmentResult> {
  const apiKey = getApiKey(provider)

  // Validate URL format
  if (!url || (!url.includes('linkedin.com/') && !url.startsWith('http'))) {
    return {
      success: false,
      provider,
      candidate: {},
      error: 'Invalid LinkedIn URL format. Please provide a link like linkedin.com/in/username',
    }
  }

  // Fallback to high-fidelity mock if no API key is set
  if (!apiKey) {
    // Simulate a brief network delay (800ms) for realistic UX
    await new Promise(resolve => setTimeout(resolve, 800))
    const mockCandidate = generateMockEnrichment(url, provider)
    return {
      success: true,
      provider,
      candidate: mockCandidate,
      rawResponse: { mock: true, provider, enrichedAt: new Date().toISOString() },
    }
  }

  try {
    if (provider === 'pdl') {
      // Call People Data Labs API
      const enrichUrl = `https://api.peopledatalabs.com/v5/person/enrich?profile=${encodeURIComponent(url)}&min_likelihood=6`
      const response = await fetch(enrichUrl, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          provider,
          candidate: {},
          error: `PDL API Error (${response.status}): ${errorText || response.statusText}`,
        }
      }

      const data = await response.json()
      if (data.status !== 200 || !data.data) {
        return {
          success: false,
          provider,
          candidate: {},
          error: `PDL Enrichment missed: Likelihood score too low or profile not found.`,
          rawResponse: data,
        }
      }

      const mapped = mapPdlToCandidate(data.data, url)
      return {
        success: true,
        provider,
        candidate: mapped,
        rawResponse: data,
      }
    } else {
      // Call Enrich.so API
      const enrichUrl = `https://api.enrich.so/v1/person?linkedin_url=${encodeURIComponent(url)}`
      const response = await fetch(enrichUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          provider,
          candidate: {},
          error: `Enrich.so API Error (${response.status}): ${errorText || response.statusText}`,
        }
      }

      const data = await response.json()
      const mapped = mapEnrichSoToCandidate(data, url)
      return {
        success: true,
        provider,
        candidate: mapped,
        rawResponse: data,
      }
    }
  } catch (error: any) {
    console.error('Enrichment API failed:', error)
    return {
      success: false,
      provider,
      candidate: {},
      error: error.message || 'Network error connecting to enrichment provider.',
    }
  }
}

// Maps People Data Labs schema to Candidate fields
function mapPdlToCandidate(pdl: any, linkedinUrl: string): Partial<Candidate> {
  const name = pdl.full_name || `${pdl.first_name || ''} ${pdl.last_name || ''}`.trim() || 'Enriched Candidate'
  
  // Format experience
  const rawExp = pdl.experience || []
  const experience: CandidateExperience[] = rawExp.map((exp: any) => ({
    company: exp.company?.name || 'Unknown Company',
    title: exp.title?.name || 'Software Professional',
    startDate: exp.start_date || undefined,
    endDate: exp.end_date || undefined,
    isCurrent: exp.is_primary || false,
  }))

  const currentRole = experience.find(exp => exp.isCurrent) || experience[0]
  const title = currentRole?.title || pdl.job_title || 'Software Professional'
  const currentCompany = currentRole?.company || pdl.job_company_name || 'Technology Company'
  
  // Format education
  const rawEdu = pdl.education || []
  const education: CandidateEducation[] = rawEdu.map((edu: any) => ({
    school: edu.school?.name || 'University',
    degree: edu.degree || undefined,
    field: edu.majors?.[0] || undefined,
    startYear: edu.start_date ? new Date(edu.start_date).getFullYear() : undefined,
    endYear: edu.end_date ? new Date(edu.end_date).getFullYear() : undefined,
  }))

  const skills = pdl.skills || []
  const emails = pdl.emails?.map((e: any) => e.address) || []
  const phones = pdl.phone_numbers || []
  
  // Determine experience years
  const experienceYears = pdl.experience_years || Math.max(1, Math.round(experience.length * 1.5))

  // Map socials
  const socialProfiles: Record<string, string> = {}
  if (pdl.github_url) socialProfiles.github = pdl.github_url
  if (pdl.twitter_url) socialProfiles.twitter = pdl.twitter_url
  if (pdl.facebook_url) socialProfiles.facebook = pdl.facebook_url

  // Deterministic fallback profile photos if missing
  const photoUrl = pdl.image_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces&q=80`

  // Base highlights
  const highlights = experience.slice(0, 2).map(
    exp => `Worked as ${exp.title} at ${exp.company}${exp.startDate ? ` since ${exp.startDate}` : ''}`
  )
  if (education[0]) {
    highlights.push(`Studied at ${education[0].school}`)
  }

  return {
    name,
    title,
    location: pdl.location_names?.[0] || pdl.location_name || 'Remote',
    experienceYears,
    matchScore: 85, // Default baseline for candidate fit
    stage: 'New',
    source: 'PDL Enrichment',
    lastActivity: 'Just now',
    fit: 'Recommended',
    skills: skills.slice(0, 8),
    highlights: highlights.slice(0, 3),
    aiInsight: `${name} has been enriched via People Data Labs. Strong credentials found at ${currentCompany}.`,
    note: `Successfully enriched via PDL on ${new Date().toLocaleDateString()}.`,
    email: emails[0] || 'no-email@pdl-enrich.com',
    companyStages: ['Series A', 'Series B'],
    growthTrajectory: 'Fast',
    vestingStatus: 'Partially Vested',
    intentSignal: 'High Engagement',
    startupFitScore: 82,
    startupFitInsight: `Experience at ${currentCompany} indicates suitability for venture-backed environments.`,
    
    // Enrichment
    linkedinUrl,
    enrichedAt: new Date().toISOString(),
    enrichmentSource: 'pdl',
    photoUrl,
    headline: pdl.headline || `${title} at ${currentCompany}`,
    summary: pdl.summary || `Professional profile for ${name}, specializing in ${skills.slice(0, 3).join(', ')}.`,
    education,
    experience,
    emails,
    phones,
    socialProfiles,
  }
}

// Maps Enrich.so response to Candidate fields
function mapEnrichSoToCandidate(enrich: any, linkedinUrl: string): Partial<Candidate> {
  const name = enrich.fullName || enrich.name || 'Enriched Candidate'
  const title = enrich.title || 'Software Professional'
  const currentCompany = enrich.company || 'Technology Company'
  
  const rawExp = enrich.experience || []
  const experience: CandidateExperience[] = rawExp.map((exp: any) => ({
    company: exp.company || 'Company',
    title: exp.title || 'Role',
    startDate: exp.startDate || undefined,
    endDate: exp.endDate || undefined,
    isCurrent: exp.isCurrent || false,
  }))

  const rawEdu = enrich.education || []
  const education: CandidateEducation[] = rawEdu.map((edu: any) => ({
    school: edu.school || 'University',
    degree: edu.degree || undefined,
    field: edu.field || undefined,
    startYear: edu.startYear || undefined,
    endYear: edu.endYear || undefined,
  }))

  const skills = enrich.skills || []
  const emails = enrich.emails || [enrich.email].filter(Boolean) || []
  const phones = enrich.phones || [enrich.phone].filter(Boolean) || []
  const experienceYears = enrich.yearsOfExperience || Math.max(1, experience.length * 2)

  const socialProfiles: Record<string, string> = {}
  if (enrich.github) socialProfiles.github = enrich.github
  if (enrich.twitter) socialProfiles.twitter = enrich.twitter

  const photoUrl = enrich.avatarUrl || enrich.photo || `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces&q=80`

  return {
    name,
    title,
    location: enrich.location || 'Remote',
    experienceYears,
    matchScore: 80,
    stage: 'New',
    source: 'Enrich.so',
    lastActivity: 'Just now',
    fit: 'Recommended',
    skills: skills.slice(0, 8),
    highlights: experience.slice(0, 3).map(exp => `${exp.title} at ${exp.company}`),
    aiInsight: `${name} was enriched via Enrich.so. Profile indicates a background at ${currentCompany}.`,
    note: `Enriched via Enrich.so on ${new Date().toLocaleDateString()}.`,
    email: emails[0] || 'no-email@enrich.so',
    companyStages: ['Seed', 'Series A'],
    growthTrajectory: 'Fast',
    vestingStatus: 'Unvested',
    intentSignal: 'Actively Sourcing',
    startupFitScore: 80,
    startupFitInsight: `Enrichment indicates a history of tech roles, matching standard startup profiles.`,
    
    // Enrichment
    linkedinUrl,
    enrichedAt: new Date().toISOString(),
    enrichmentSource: 'enrich.so',
    photoUrl,
    headline: enrich.headline || `${title} at ${currentCompany}`,
    summary: enrich.summary || `Enriched profile for ${name}.`,
    education,
    experience,
    emails,
    phones,
    socialProfiles,
  }
}
