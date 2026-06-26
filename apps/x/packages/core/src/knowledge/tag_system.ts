import path from "path";
import fs from "fs";
import { WorkDir } from "../config/config.js";

export type TagApplicability = 'email' | 'notes' | 'both';

export type TagType =
  | 'relationship'
  | 'relationship-sub'
  | 'topic'
  | 'email-type'
  | 'noise'
  | 'action'
  | 'status'
  | 'source';

export type NoteEffect = 'create' | 'skip' | 'none';

export interface TagDefinition {
  tag: string;
  type: TagType;
  applicability: TagApplicability;
  description: string;
  example?: string;
  /** Whether an email with this tag should create notes ('create'), be skipped ('skip'), or has no effect on note creation ('none'). */
  noteEffect?: NoteEffect;
}

// ?? Default definitions (used to seed WorkDir/config/tags.json) ?????????????

const DEFAULT_TAG_DEFINITIONS: TagDefinition[] = [
  // ?? Relationship — who is this from/about (all create) ????????????????
  { tag: 'candidate', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Active or potential candidates in a hiring pipeline', example: 'Thanks for the outreach. I\'m interested in the Senior Product Designer role and can interview this week.' },
  { tag: 'hiring-manager', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Role owners, department leads, and managers making hiring decisions', example: 'Please prioritize candidates with B2B SaaS experience for the product design search.' },
  { tag: 'interviewer', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Interview panel members and evaluators', example: 'I submitted my scorecard. Strong systems thinking, but weaker on stakeholder management.' },
  { tag: 'referrer', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Employees or partners referring candidates', example: 'I referred Teni for the Product Designer role. She led design systems at my last company.' },
  { tag: 'agency', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'External recruiters, staffing firms, and sourcing partners', example: 'We have three Lagos-based senior design candidates ready for review.' },
  { tag: 'client', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Employers, business units, or internal teams hiring through Jobraker Recruiter', example: 'We need to fill two backend engineer seats before the end of the month.' },
  { tag: 'team', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Internal recruiting, people, and operations teammates', example: 'Here is the updated shortlist for the Product Designer pipeline.' },
  { tag: 'executive', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Founders, executives, and final approval stakeholders', example: 'Please send the top three finalists for leadership review by Friday.' },
  { tag: 'vendor', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Recruiting tools, background check providers, job boards, and assessment vendors', example: 'Your background check package renewal is attached for review.' },
  { tag: 'talent-community', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Past applicants, silver medalists, alumni, and nurture-pool contacts', example: 'I saw the new Staff Designer opening and would love to reconnect.' },
  { tag: 'candidate-support', type: 'relationship', applicability: 'both', noteEffect: 'create', description: 'Candidate coordinators, assistants, relocation contacts, and logistics helpers', example: 'I am coordinating David\'s travel and can confirm his onsite availability.' },
  // ?? Relationship Sub-Tags — role metadata (notes only, all none) ??????
  { tag: 'primary', type: 'relationship-sub', applicability: 'notes', noteEffect: 'none', description: 'Main candidate, hiring owner, or decision maker', example: 'Teni Ogunleye - primary candidate for Senior Product Designer.' },
  { tag: 'secondary', type: 'relationship-sub', applicability: 'notes', noteEffect: 'none', description: 'Supporting contact, involved but not the lead', example: 'Femi Okoro - backup interviewer for the design systems round.' },
  { tag: 'coordinator', type: 'relationship-sub', applicability: 'notes', noteEffect: 'none', description: 'Recruiting coordinator or admin handling scheduling and logistics', example: 'Lisa coordinates candidate interview loops and follow-ups.' },
  { tag: 'cc', type: 'relationship-sub', applicability: 'notes', noteEffect: 'none', description: 'Person who is CC\'d but not actively engaged', example: 'Compensation approver looped in for offer visibility.' },
  { tag: 'referred-by', type: 'relationship-sub', applicability: 'notes', noteEffect: 'none', description: 'Person who made an introduction or referral', example: 'Chinaza Uche - referred by Teni from the design community.' },
  { tag: 'former', type: 'relationship-sub', applicability: 'notes', noteEffect: 'none', description: 'Previously held this relationship, no longer active', example: 'Former candidate from the 2025 backend search.' },
  { tag: 'champion', type: 'relationship-sub', applicability: 'notes', noteEffect: 'none', description: 'Advocate pushing a candidate, role, or hire forward', example: 'Hiring manager is championing the candidate for final round.' },
  { tag: 'blocker', type: 'relationship-sub', applicability: 'notes', noteEffect: 'none', description: 'Person or concern slowing the hire down', example: 'Compensation approver is blocking offer approval.' },
  // ?? Topic — what the email is about (all create) ??????????????????????
  { tag: 'sourcing', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Candidate sourcing, search criteria, and talent discovery', example: 'Find senior backend engineers in Lagos with fintech and TypeScript experience.' },
  { tag: 'screening', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Resume review, profile screening, and qualification decisions', example: 'This candidate passes screening for React, design systems, and senior stakeholder experience.' },
  { tag: 'interview', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Interview scheduling, feedback, scorecards, and panel coordination', example: 'Can we schedule Teni for a portfolio review on Thursday afternoon?' },
  { tag: 'offer', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Offer details, compensation, approvals, and negotiations', example: 'The candidate is asking for a higher base salary before accepting the offer.' },
  { tag: 'pipeline', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Pipeline movement, stages, status changes, and recruiting operations', example: 'Move Femi to technical interview and keep Chinaza in review.' },
  { tag: 'role-intake', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Role requirements, intake meetings, must-haves, and hiring plan', example: 'The role requires 5+ years, marketplace experience, and strong stakeholder management.' },
  { tag: 'outreach', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Recruiting outreach, replies, nurture campaigns, and follow-ups', example: 'Draft a warmer follow-up for product designers who opened but did not reply.' },
  { tag: 'compliance', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Background checks, right-to-work, privacy, and recruiting compliance', example: 'Background check is complete and right-to-work documents are verified.' },
  { tag: 'meeting', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Calendar invites and scheduling for real recruiting meetings with named people', example: 'Interview: Teni Ogunleye <> Product Design Panel @ Thu 2:00 PM' },
  { tag: 'event', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Recruiting events, career fairs, talent meetups, and hiring webinars', example: 'You are invited to the Lagos Design Talent Mixer next Friday.' },
  { tag: 'research', type: 'topic', applicability: 'both', noteEffect: 'create', description: 'Market mapping, talent intelligence, salary benchmarks, and competitor research', example: 'Here is the salary benchmark for senior product designers in Lagos.' },
  // ?? Email Type — high-signal email formats (all create) ???????????????
  { tag: 'intro', type: 'email-type', applicability: 'both', noteEffect: 'create', description: 'Warm candidate, hiring manager, or referral introduction', example: 'I\'d like to introduce you to Sarah Chen, a senior product designer from my team.' },
  { tag: 'followup', type: 'email-type', applicability: 'both', noteEffect: 'create', description: 'Following up on a previous two-way recruiting conversation. A cold sender bumping their own unanswered email is cold-outreach.', example: 'Following up on our interview last week. Do you have feedback for the candidate?' },
  // ?? Noise — all skip signals in one place ?????????????????????????????
  // NOTE: Noise tags override relationship/topic tags. An email can have
  // relationship: team AND filter: receipt — the noise tag wins and skips note creation.
  { tag: 'spam', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Junk and unwanted email, including Google Groups spam moderation digests (from noreply-spamdigest)', example: 'Congratulations! You\'ve won $1,000,000...' },
  { tag: 'promotion', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Marketing offers, sales pitches, product launches, vendor upgrade campaigns, and hiring webinars or events you did not register for', example: 'Register now: AI sourcing automation trends for recruiting teams' },
  { tag: 'cold-outreach', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Unsolicited pitches from people or vendors you have no prior recruiting relationship with, including agencies, job boards, assessment tools, freelance sourcers, and candidates mass-mailing for attention. Even if they mention Jobraker Recruiter or a live role by name.', example: 'We can deliver 50 qualified product design candidates for your open roles this week.' },
  { tag: 'newsletter', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Recruiting newsletters, market reports, subscription emails, product tips/tutorials from vendors, and research digests - even from platforms you actively use', example: 'Weekly talent market report: design hiring benchmarks and sourcing trends' },
  { tag: 'notification', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Automated system messages requiring no decision: email verifications, meeting recording uploads, platform policy/permission changes, billing console updates, password resets, and expired OTPs', example: 'Meeting records: your recording has been uploaded to Google Drive.' },
  { tag: 'digest', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Community digests, forum roundups, and aggregated recruiting updates', example: 'Recruiting community weekly: 12 new sourcing threads this week...' },
  { tag: 'product-update', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Product changelogs, feature announcements, and recruiting vendor marketing disguised as tips', example: 'Discover new candidate enrichment workflows in your free account' },
  { tag: 'receipt', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Completed transaction confirmations with no decision remaining: payment receipts, salary/payroll disbursements, tax payment acknowledgements (challans), GST/VAT filing confirmations (GSTR1 ARNs), TDS workings, recurring invoice-sharing threads, and transfer-initiated confirmations', example: 'Challan payment under section 200 for TAN BLXXXXXX4B has been successfully paid.' },
  { tag: 'social', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Social media notifications', example: 'John Smith commented on your post.' },
  { tag: 'forums', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Mailing lists, group discussions, and Google Groups moderation digests that are not spam digests', example: 'Re: [dev-list] Question about API design' },
  { tag: 'scheduling', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Automated meeting reminders, scheduling tool confirmations, and calendar system notifications with no named person or context. NOT real meeting invites with specific people — those are topic: meeting.', example: 'Reminder: your meeting is about to start. Join with Google Meet.' },
  { tag: 'travel', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Flights, hotels, trips, and travel logistics', example: 'Your flight to Tokyo on March 15 is confirmed. Confirmation #ABC123.' },
  { tag: 'shopping', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Purchases, orders, and returns', example: 'Your order #12345 has shipped. Track it here.' },
  { tag: 'health', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Medical, wellness, and health-related matters', example: 'Your appointment with Dr. Smith is confirmed for Monday at 2pm.' },
  { tag: 'learning', type: 'noise', applicability: 'email', noteEffect: 'skip', description: 'Courses, webinars, workshops, knowledge sessions, and education marketing — even from platforms you are enrolled in', example: 'Welcome to the Advanced Python course. Here\'s your access link.' },

  // ?? Action — urgency signals (all create) ?????????????????????????????
  { tag: 'action-required', type: 'action', applicability: 'both', noteEffect: 'create', description: 'Needs a response or recruiting action from you', example: 'Can you send the shortlist to the hiring manager by Friday?' },
  { tag: 'urgent', type: 'action', applicability: 'both', noteEffect: 'create', description: 'Time-sensitive, needs immediate attention', example: 'The candidate needs offer approval by EOD or we risk losing them.' },
  { tag: 'waiting', type: 'action', applicability: 'both', noteEffect: 'create', description: 'Waiting on a response from them' },

  // ?? Status — workflow state (all none) ????????????????????????????????
  { tag: 'unread', type: 'status', applicability: 'email', noteEffect: 'none', description: 'Not yet processed' },
  { tag: 'to-reply', type: 'status', applicability: 'email', noteEffect: 'none', description: 'Need to respond' },
  { tag: 'done', type: 'status', applicability: 'email', noteEffect: 'none', description: 'Handled, can be archived' },
  { tag: 'active', type: 'status', applicability: 'notes', noteEffect: 'none', description: 'Currently relevant, recent activity' },
  { tag: 'archived', type: 'status', applicability: 'notes', noteEffect: 'none', description: 'No longer active, kept for reference' },
  { tag: 'stale', type: 'status', applicability: 'notes', noteEffect: 'none', description: 'No activity in 60+ days, needs attention or archive' },

  // ?? Source — origin metadata (notes only, all none) ???????????????????
  { tag: 'email', type: 'source', applicability: 'notes', noteEffect: 'none', description: 'Created or updated from email' },
  { tag: 'meeting', type: 'source', applicability: 'notes', noteEffect: 'none', description: 'Created or updated from meeting transcript' },
  { tag: 'browser', type: 'source', applicability: 'notes', noteEffect: 'none', description: 'Content captured from web browsing' },
  { tag: 'web-search', type: 'source', applicability: 'notes', noteEffect: 'none', description: 'Information from web search' },
  { tag: 'manual', type: 'source', applicability: 'notes', noteEffect: 'none', description: 'Manually entered by user' },
  { tag: 'import', type: 'source', applicability: 'notes', noteEffect: 'none', description: 'Imported from another system' },
];

// ?? Disk-backed config with mtime caching ??????????????????????????????????

export const TAGS_CONFIG_PATH = path.join(WorkDir, "config", "tags.json");

let cachedTagDefinitions: TagDefinition[] | null = null;
let cachedMtimeMs: number | null = null;

function ensureTagsConfigSync(): void {
  if (!fs.existsSync(TAGS_CONFIG_PATH)) {
    fs.writeFileSync(
      TAGS_CONFIG_PATH,
      JSON.stringify(DEFAULT_TAG_DEFINITIONS, null, 2) + "\n",
      "utf8",
    );
  }
}

export function getTagDefinitions(): TagDefinition[] {
  ensureTagsConfigSync();
  try {
    const stats = fs.statSync(TAGS_CONFIG_PATH);
    if (cachedTagDefinitions && cachedMtimeMs === stats.mtimeMs) {
      return cachedTagDefinitions;
    }
    const content = fs.readFileSync(TAGS_CONFIG_PATH, "utf8");
    cachedTagDefinitions = JSON.parse(content);
    cachedMtimeMs = stats.mtimeMs;
    return cachedTagDefinitions!;
  } catch {
    cachedTagDefinitions = null;
    cachedMtimeMs = null;
    return DEFAULT_TAG_DEFINITIONS;
  }
}

// ?? Render helpers ???????????????????????????????????????????????????????

const TYPE_ORDER: TagType[] = [
  'relationship', 'relationship-sub', 'topic', 'email-type',
  'noise', 'action', 'status', 'source',
];

const TYPE_LABELS: Record<TagType, string> = {
  'relationship': 'Relationship',
  'relationship-sub': 'Relationship Sub-Tags',
  'topic': 'Topic',
  'email-type': 'Email Type',
  'noise': 'Noise',
  'action': 'Action',
  'status': 'Status',
  'source': 'Source',
};

function renderTagGroups(tags: TagDefinition[]): string {
  const groups = new Map<TagType, TagDefinition[]>();
  for (const tag of tags) {
    const list = groups.get(tag.type) ?? [];
    list.push(tag);
    groups.set(tag.type, list);
  }

  const sections: string[] = [];
  for (const type of TYPE_ORDER) {
    const group = groups.get(type);
    if (!group || group.length === 0) continue;

    const label = TYPE_LABELS[type];
    const rows = group.map(t => {
      const example = t.example ?? '';
      return `| ${t.tag} | ${t.description} | ${example} |`;
    });

    sections.push(
      `## ${label}\n\n` +
      `| Tag | Description | Example |\n` +
      `|-----|-------------|---------|\n` +
      rows.join('\n'),
    );
  }

  return `# Tag System Reference\n\n${sections.join('\n\n')}`;
}

export function renderNoteEffectRules(): string {
  const tags = getTagDefinitions();
  const skipByType = new Map<string, string[]>();
  const createByType = new Map<string, string[]>();

  for (const t of tags) {
    const effect = t.noteEffect ?? 'none';
    if (effect === 'none') continue;
    const label = TYPE_LABELS[t.type] ?? t.type;
    const map = effect === 'skip' ? skipByType : createByType;
    const list = map.get(label) ?? [];
    list.push(t.tag.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '));
    map.set(label, list);
  }

  const formatList = (map: Map<string, string[]>) =>
    Array.from(map.entries()).map(([type, tags]) => `- **${type}:** ${tags.join(', ')}`).join('\n');

  return [
    `**SKIP if the email has ANY of these labels (skip labels override everything):**`,
    formatList(skipByType),
    ``,
    `**CREATE/UPDATE notes if the email has ANY of these labels (and no skip labels present):**`,
    formatList(createByType),
    ``,
    `**Logic:** If even one label falls in the "skip" list, skip the email — skip labels are hard filters that override create labels.`,
  ].join('\n');
}

export function renderTagSystemForNotes(): string {
  const tags = getTagDefinitions().filter(t => t.applicability !== 'email');
  return renderTagGroups(tags);
}

export function renderTagSystemForEmails(): string {
  const tags = getTagDefinitions().filter(t => t.applicability !== 'notes');
  return renderTagGroups(tags);
}
