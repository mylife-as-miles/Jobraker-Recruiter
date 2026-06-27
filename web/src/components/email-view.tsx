import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Archive, Bold, CheckCheck, Italic, Link as LinkIcon, List, ListOrdered, LoaderIcon, Mail, Paperclip, Quote, RefreshCw, Reply, Search, Send, Sparkles, Strikethrough, Trash2, TrendingUp, Calendar, ArrowRight, User, ChevronDown, ChevronRight, ChevronUp, AlertCircle, Ban, PanelLeftIcon } from 'lucide-react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import type { blocks } from '@x/shared'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { useTheme } from '@/contexts/theme-context'
import { SettingsDialog } from '@/components/settings-dialog'
import { CANDIDATES, initials, avatarGradient, matchTone } from '@/components/recruiter/data'

type GmailThread = blocks.GmailThread
type GmailThreadMessage = blocks.GmailThreadMessage
type GmailConnectionStatus = {
  connected: boolean
  hasRequiredScope: boolean
  missingScopes: string[]
  email: string | null
}

function formatInboxTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return `${Math.round(diffMin / 60)}h`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yest'
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return date.toLocaleDateString([], { weekday: 'short' })
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' })
}

function formatFullDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function extractName(from?: string): string {
  if (!from) return 'Unknown'
  const match = from.match(/^([^<]+)</)
  if (match?.[1]) return match[1].replace(/^["']|["']$/g, '').trim()
  const address = from.match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1] ?? from
  return address.replace(/@.*/, '').replace(/[._+]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function extractAddress(from?: string): string {
  if (!from) return ''
  return from.match(/<([^>]+)>/)?.[1] ?? from
}

function snippet(text?: string): string {
  return (text || '').replace(/\s+/g, ' ').trim().slice(0, 180)
}

function isReplyQuoteBoundary(lines: string[], index: number): boolean {
  const line = lines[index]?.trim() || ''
  if (/^On\b.+\bwrote:\s*$/i.test(line)) return true
  if (/^-{2,}\s*(Original Message|Forwarded message)\s*-{2,}$/i.test(line)) return true
  if (/^From:\s+\S/i.test(line)) {
    const next = lines.slice(index + 1, index + 6).map((value) => value.trim())
    return next.some((value) => /^(Sent|Date):\s+\S/i.test(value))
      && next.some((value) => /^To:\s+\S/i.test(value))
      && next.some((value) => /^Subject:\s+\S/i.test(value))
  }
  return false
}

function stripQuotedReplyText(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const boundary = lines.findIndex((line, index) => {
    if (isReplyQuoteBoundary(lines, index)) return true
    return index > 0
      && line.trim().startsWith('>')
      && (lines[index - 1]?.trim() === '' || lines[index - 1]?.trim().startsWith('>'))
  })
  const visible = boundary >= 0 ? lines.slice(0, boundary) : lines
  return visible.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function getInitial(from?: string): string {
  return (extractName(from)[0] || '?').toUpperCase()
}

const AVATAR_COLORS = ['#1a73e8', '#e8453c', '#34a853', '#8430ce', '#f29900', '#00796b', '#c62828', '#1565c0']

function avatarColor(from?: string): string {
  const value = from || 'unknown'
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function latestMessage(thread: GmailThread): GmailThreadMessage | undefined {
  return thread.messages[thread.messages.length - 1]
}

function splitAddresses(raw?: string): string[] {
  if (!raw) return []
  const tokens: string[] = []
  let buf = ''
  let inQuote = false
  let depth = 0
  for (const ch of raw) {
    if (ch === '"') inQuote = !inQuote
    else if (ch === '<') depth += 1
    else if (ch === '>') depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === ';' || ch === '\n') && !inQuote && depth === 0) {
      const token = buf.trim()
      if (token) tokens.push(token)
      buf = ''
      continue
    }
    buf += ch
  }
  const last = buf.trim()
  if (last) tokens.push(last)
  return tokens
}

function recipientLabel(token: string): string {
  const named = token.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/)
  if (named?.[1]?.trim()) return named[1].trim()
  return extractAddress(token)
}

function dedupeRecipients(tokens: string[], exclude: Set<string>): string[] {
  const seen = new Set<string>(exclude)
  const out: string[] = []
  for (const token of tokens) {
    const addr = extractAddress(token).toLowerCase()
    if (!addr || seen.has(addr)) continue
    seen.add(addr)
    out.push(token)
  }
  return out
}

function buildRecipients(
  mode: ComposeMode,
  thread: GmailThread,
  selfEmail: string,
): { to: string[]; cc: string[] } {
  if (mode === 'forward') return { to: [], cc: [] }

  const latest = latestMessage(thread)
  const self = selfEmail.toLowerCase()
  const fromAddr = latest?.from ? extractAddress(latest.from).toLowerCase() : ''
  const iAmSender = Boolean(self) && fromAddr === self

  const rawTo = iAmSender ? splitAddresses(latest?.to) : (latest?.from ? [latest.from] : [])
  const ccPool = iAmSender
    ? splitAddresses(latest?.cc)
    : [...splitAddresses(latest?.to), ...splitAddresses(latest?.cc)]

  const selfSet = new Set<string>(self ? [self] : [])
  const to = dedupeRecipients(rawTo, selfSet)
  if (iAmSender && to.length === 0 && self && rawTo.some((token) => extractAddress(token).toLowerCase() === self)) {
    to.push(self)
  }

  if (mode === 'reply') return { to, cc: [] }

  const ccExclude = new Set<string>(selfSet)
  for (const token of to) ccExclude.add(extractAddress(token).toLowerCase())
  const cc = dedupeRecipients(ccPool, ccExclude)
  return { to, cc }
}

function composeSubject(mode: ComposeMode, rawSubject?: string): string {
  const raw = (rawSubject || '').trim()
  if (mode === 'forward') return /^fwd:/i.test(raw) ? raw : `Fwd: ${raw}`.trim()
  return /^re:/i.test(raw) ? raw : `Re: ${raw}`.trim()
}

function buildForwardedContent(thread: GmailThread): string {
  const message = latestMessage(thread)
  if (!message) return ''
  const rows = [
    '---------- Forwarded message ---------',
    message.from ? `From: ${message.from}` : null,
    message.date ? `Date: ${formatFullDate(message.date)}` : null,
    message.subject || thread.subject ? `Subject: ${message.subject || thread.subject}` : null,
    message.to ? `To: ${message.to}` : null,
    message.cc ? `Cc: ${message.cc}` : null,
  ].filter((line): line is string => Boolean(line))
  const body = (message.body || snippet(message.bodyHtml)).trim()
  return [
    '<p></p>',
    '<blockquote>',
    ...rows.map((line) => `<p>${escapeHtml(line)}</p>`),
    body ? `<p>${escapeHtml(body).replace(/\n/g, '<br />')}</p>` : '',
    '</blockquote>',
  ].join('')
}

const PREFETCH_HOVER_MS = 180
const PREFETCH_MAX_IMAGES_PER_THREAD = 12

function extractImageUrls(html: string): string[] {
  const urls: string[] = []
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const url = match[1]
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      urls.push(url)
    }
  }
  return urls
}

function prefetchThreadImages(thread: GmailThread): void {
  const seen = new Set<string>()
  for (const msg of thread.messages) {
    if (!msg.bodyHtml) continue
    for (const url of extractImageUrls(msg.bodyHtml)) {
      if (seen.has(url)) continue
      seen.add(url)
      if (seen.size > PREFETCH_MAX_IMAGES_PER_THREAD) return
      const img = new Image()
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.src = url
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function splitPlainTextQuote(text: string): { visible: string; quoted: string | null } {
  const re = /(?:^|\n)On\s+.+?\swrote:\s*(?:\n|$)/
  const match = re.exec(text)
  if (!match) return { visible: text, quoted: null }
  const start = match.index === 0 ? 0 : match.index + 1
  const visible = text.slice(0, start).trimEnd()
  const quoted = text.slice(start)
  if (!quoted.trim()) return { visible: text, quoted: null }
  return { visible, quoted }
}

function isStyledHtml(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('.gmail_quote, .gmail_attr, blockquote[type="cite"]').forEach((n) => n.remove())
  if (doc.querySelector('table')) return true
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const w = parseInt(img.getAttribute('width') || '0', 10)
    const h = parseInt(img.getAttribute('height') || '0', 10)
    if (w === 1 && h === 1) continue
    const style = img.getAttribute('style') || ''
    if (/display\s*:\s*none/i.test(style)) continue
    if (/visibility\s*:\s*hidden/i.test(style)) continue
    return true
  }
  const visible = doc.body?.innerHTML || ''
  if (/bgcolor\s*=/i.test(visible)) return true
  if (/background-(color|image)\s*:/i.test(visible)) return true
  return false
}

function buildEmailDocument(
  html: string,
  opts: { theme: 'light' | 'dark'; adaptToTheme: boolean },
): string {
  const useDark = opts.theme === 'dark'
  const colorScheme = useDark ? 'dark' : 'light'
  const bodyColor = useDark ? '#e4e4e7' : '#202124'
  const linkColor = useDark ? '#1dff00' : '#1a73e8'
  const quoteBorder = useDark ? '#27272a' : '#dadce0'
  const quoteColor = useDark ? '#a1a1aa' : '#5f6368'

  const darkThemeOverrides = useDark ? `
    * { background-color: transparent !important; color: inherit !important; }
    body { background: transparent !important; color: ${bodyColor} !important; }
    a { color: ${linkColor} !important; text-decoration: underline; }
    td, th { border-color: #27272a !important; }
  ` : ''

  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="color-scheme" content="${colorScheme}">
<base target="_blank">
<style>
  :root { color-scheme: ${colorScheme}; }
  html, body { margin: 0; padding: 0; }
  body {
    font: 13px/1.6 Arial, sans-serif;
    background: transparent;
    color: ${bodyColor};
    overflow-x: auto;
    overflow-y: hidden;
    word-wrap: break-word;
    padding-bottom: 4px;
  }
  body > *:last-child { margin-bottom: 0; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; border-collapse: collapse; }
  a { color: ${linkColor}; }
  blockquote {
    margin: 0 0 0 6px;
    padding-left: 12px;
    border-left: 2px solid ${quoteBorder};
    color: ${quoteColor};
  }
  .gmail_quote,
  .gmail_attr,
  blockquote[type="cite"] { display: none; }
  [data-show-quotes="true"] .gmail_quote,
  [data-show-quotes="true"] .gmail_attr,
  [data-show-quotes="true"] blockquote[type="cite"] { display: block; }
  ${darkThemeOverrides}
</style>
</head><body>${html}</body></html>`
}

function MessageBody({ message, threadId }: { message: GmailThreadMessage; threadId: string }) {
  const isPlainText = !(message.bodyHtml && message.bodyHtml.trim())
  return isPlainText
    ? <PlainTextBody message={message} />
    : <HtmlMessageBody message={message} threadId={threadId} />
}

function PlainTextBody({ message }: { message: GmailThreadMessage }) {
  const text = (message.body || '(No message body)').trim()
  const { visible, quoted } = splitPlainTextQuote(text)
  const [showQuote, setShowQuote] = useState(false)
  return (
    <>
      <div className="gmail-message-plain">
        <pre className="gmail-message-pre">{visible}</pre>
        {quoted && showQuote && <pre className="gmail-message-pre gmail-message-pre-quoted">{quoted}</pre>}
      </div>
      {quoted && (
        <button
          type="button"
          className="gmail-quote-toggle"
          onClick={() => setShowQuote((v) => !v)}
          aria-label={showQuote ? 'Hide quoted text' : 'Show quoted text'}
          aria-expanded={showQuote}
        >
          <span>•••</span>
        </button>
      )}
      {message.attachments && message.attachments.length > 0 && (
        <MessageAttachments attachments={message.attachments} />
      )}
    </>
  )
}

function HtmlMessageBody({ message, threadId }: { message: GmailThreadMessage; threadId: string }) {
  const { resolvedTheme } = useTheme()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedHeightRef = useRef<number>(message.bodyHeight ?? 0)
  const [height, setHeight] = useState(message.bodyHeight ?? 80)
  const [hasQuote, setHasQuote] = useState(false)
  const [showQuotes, setShowQuotes] = useState(false)

  const adaptToTheme = useMemo(() => !isStyledHtml(message.bodyHtml!), [message.bodyHtml])
  const srcDoc = useMemo(
    () => buildEmailDocument(message.bodyHtml!, { theme: resolvedTheme, adaptToTheme }),
    [message.bodyHtml, resolvedTheme, adaptToTheme],
  )

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!doc?.body) return
    setHasQuote(!!doc.querySelector('.gmail_quote, .gmail_attr, blockquote[type="cite"]'))
    const measure = () => {
      const next = Math.max(40, doc.body.scrollHeight, doc.body.offsetHeight)
      setHeight((current) => (current === next ? current : next))
      if (!message.id) return
      if (Math.abs(next - lastSavedHeightRef.current) < 4) return
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        lastSavedHeightRef.current = next
        void window.ipc.invoke('gmail:saveMessageHeight', {
          threadId,
          messageId: message.id!,
          height: next,
        }).catch(() => {})
      }, 500)
    }
    measure()
    observerRef.current?.disconnect()
    if (typeof ResizeObserver !== 'undefined') {
      observerRef.current = new ResizeObserver(measure)
      observerRef.current.observe(doc.body)
    }
  }, [message.id, threadId])

  const toggleQuotes = useCallback(() => {
    setShowQuotes((prev) => {
      const next = !prev
      const doc = iframeRef.current?.contentDocument
      if (doc) doc.documentElement.dataset.showQuotes = next ? 'true' : ''
      return next
    })
  }, [])

  useEffect(() => () => {
    observerRef.current?.disconnect()
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  return (
    <>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        title="Email content"
        className={cn('gmail-message-iframe', adaptToTheme && 'gmail-message-iframe-adaptive')}
        style={{ height }}
        onLoad={handleLoad}
      />
      {hasQuote && (
        <button
          type="button"
          className="gmail-quote-toggle"
          onClick={toggleQuotes}
          aria-label={showQuotes ? 'Hide quoted text' : 'Show quoted text'}
          aria-expanded={showQuotes}
        >
          <span>•••</span>
        </button>
      )}
      {message.attachments && message.attachments.length > 0 && (
        <MessageAttachments attachments={message.attachments} />
      )}
    </>
  )
}

function formatAttachmentSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return ''
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const num = (bytes / Math.pow(k, i)).toFixed(1)
  return `${num} ${sizes[i]}`
}

function MessageAttachments({ attachments }: { attachments: NonNullable<GmailThreadMessage['attachments']> }) {
  const openAttachment = (path: string, filename: string) => {
    void window.ipc
      .invoke('shell:openPath', { path })
      .then((result) => {
        if (result?.error) toast(`Could not open ${filename}: ${result.error}`, 'error')
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        toast(`Could not open ${filename}: ${message}`, 'error')
      })
  }

  return (
    <div className="gmail-message-attachments">
      {attachments.map((att) => {
        const size = formatAttachmentSize(att.sizeBytes)
        return (
          <button
            key={att.savedPath}
            type="button"
            className="gmail-attachment"
            onClick={() => openAttachment(att.savedPath, att.filename)}
            title={`Open ${att.filename}`}
          >
            <Paperclip size={13} />
            <span className="gmail-attachment-name">{att.filename}</span>
            {size && <span className="gmail-attachment-size">{size}</span>}
          </button>
        )
      })}
    </div>
  )
}

type ComposeMode = 'reply' | 'replyAll' | 'forward'

function ComposeToolbarButton({
  editor,
  command,
  isActive,
  label,
  children,
}: {
  editor: Editor
  command: () => void
  isActive: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={cn('gmail-compose-tool', isActive && 'is-active')}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        command()
        editor.chain().focus().run()
      }}
      aria-label={label}
      aria-pressed={isActive}
      title={label}
    >
      {children}
    </button>
  )
}

function ComposeToolbar({ editor, onOpenLink }: { editor: Editor; onOpenLink: () => void }) {
  return (
    <div className="gmail-compose-toolbar">
      <ComposeToolbarButton
        editor={editor}
        command={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        label="Bold"
      >
        <Bold size={14} />
      </ComposeToolbarButton>
      <ComposeToolbarButton
        editor={editor}
        command={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        label="Italic"
      >
        <Italic size={14} />
      </ComposeToolbarButton>
      <ComposeToolbarButton
        editor={editor}
        command={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        label="Strikethrough"
      >
        <Strikethrough size={14} />
      </ComposeToolbarButton>
      <span className="gmail-compose-tool-sep" />
      <ComposeToolbarButton
        editor={editor}
        command={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        label="Bulleted list"
      >
        <List size={14} />
      </ComposeToolbarButton>
      <ComposeToolbarButton
        editor={editor}
        command={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        label="Numbered list"
      >
        <ListOrdered size={14} />
      </ComposeToolbarButton>
      <ComposeToolbarButton
        editor={editor}
        command={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        label="Quote"
      >
        <Quote size={14} />
      </ComposeToolbarButton>
      <span className="gmail-compose-tool-sep" />
      <button
        type="button"
        className={cn('gmail-compose-tool', editor.isActive('link') && 'is-active')}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onOpenLink}
        aria-label="Link"
        aria-pressed={editor.isActive('link')}
        title="Link"
      >
        <LinkIcon size={14} />
      </button>
    </div>
  )
}

function RecipientField({
  label,
  value,
  onChange,
  autoFocus,
  trailing,
}: {
  label: string
  value: string[]
  onChange: (next: string[]) => void
  autoFocus?: boolean
  trailing?: React.ReactNode
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const commit = (raw: string) => {
    const additions = splitAddresses(raw)
    if (additions.length === 0) return
    onChange(dedupeRecipients([...value, ...additions], new Set()))
    setDraft('')
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';' || (event.key === 'Tab' && draft.trim())) {
      if (draft.trim()) {
        event.preventDefault()
        commit(draft)
      }
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="gmail-recipient-row">
      <span className="gmail-recipient-label">{label}</span>
      <div className="gmail-recipient-field">
        {value.map((token, index) => (
          <span key={`${token}-${index}`} className="gmail-recipient-chip" title={extractAddress(token)}>
            <span className="gmail-recipient-chip-label">{recipientLabel(token)}</span>
            <button
              type="button"
              className="gmail-recipient-chip-remove"
              aria-label={`Remove ${extractAddress(token)}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange(value.filter((_, idx) => idx !== index))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="gmail-recipient-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (draft.trim()) commit(draft) }}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text')
            if (text && /[,;\n]/.test(text)) {
              event.preventDefault()
              commit(text)
            }
          }}
        />
      </div>
      {trailing && <div className="gmail-recipient-trailing">{trailing}</div>}
    </div>
  )
}

function ComposeBox({
  mode,
  thread,
  selfEmail,
  onClose,
  onModeChange,
}: {
  mode: ComposeMode
  thread: GmailThread
  selfEmail: string
  onClose: () => void
  onModeChange?: (mode: ComposeMode) => void
}) {
  const latest = latestMessage(thread)
  const initialRecipients = useMemo(
    () => buildRecipients(mode, thread, selfEmail),
    [mode, thread, selfEmail],
  )

  const [toList, setToList] = useState<string[]>(initialRecipients.to)
  const [ccList, setCcList] = useState<string[]>(initialRecipients.cc)
  const [bccList, setBccList] = useState<string[]>([])
  const [showCc, setShowCc] = useState<boolean>(initialRecipients.cc.length > 0)
  const [showBcc, setShowBcc] = useState<boolean>(false)
  const [subject, setSubject] = useState<string>(() => composeSubject(mode, thread.subject))
  const modeLabel = mode === 'forward' ? 'Forward' : mode === 'replyAll' ? 'Reply all' : 'Reply'

  const initialContent = useMemo(() => {
    if (mode === 'forward') return buildForwardedContent(thread)
    const source = stripQuotedReplyText(thread.gmail_draft || thread.draft_response || '')
    if (!source) return ''
    return source
      .split(/\n{2,}/)
      .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br />')}</p>`)
      .join('')
  }, [mode, thread])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({
        placeholder: mode === 'forward' ? 'Write a message…' : 'Write your reply…',
      }),
    ],
    editorProps: {
      attributes: { class: 'gmail-compose-content' },
    },
    content: initialContent,
  })

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)

  const openLink = () => {
    if (!editor) return
    const { from, to: selTo } = editor.state.selection
    savedSelectionRef.current = { from, to: selTo }
    const existing = editor.getAttributes('link').href as string | undefined
    setLinkUrl(existing || 'https://')
    setLinkOpen(true)
  }

  useEffect(() => {
    if (!linkOpen) return
    const id = window.setTimeout(() => linkInputRef.current?.select(), 0)
    return () => window.clearTimeout(id)
  }, [linkOpen])

  const applyLink = () => {
    if (!editor) {
      setLinkOpen(false)
      return
    }
    const sel = savedSelectionRef.current
    setLinkOpen(false)
    if (!sel) return
    const trimmed = linkUrl.trim()
    if (!trimmed || trimmed === 'https://') {
      editor.chain().focus().setTextSelection(sel).extendMarkRange('link').unsetLink().run()
      return
    }
    const href = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    editor.chain().focus().setTextSelection(sel).extendMarkRange('link').setLink({ href }).run()
  }

  const cancelLink = () => {
    setLinkOpen(false)
    const sel = savedSelectionRef.current
    if (editor && sel) editor.chain().focus().setTextSelection(sel).run()
  }

  const [sending, setSending] = useState(false)
  const sendInGmail = async () => {
    if (!editor || sending) return
    const html = editor.getHTML()
    const text = editor.getText().trim()
    if (!text) {
      toast('Draft is empty.', 'error')
      return
    }

    if (toList.length === 0) {
      toast('Add at least one recipient.', 'error')
      return
    }

    const messageIds = thread.messages
      .map((m) => m.messageIdHeader)
      .filter((v): v is string => Boolean(v))
    const references = messageIds.join(' ')
    const inReplyTo = latest?.messageIdHeader
    const isForward = mode === 'forward'

    setSending(true)
    try {
      const result = await window.ipc.invoke('gmail:sendReply', {
        threadId: isForward ? undefined : thread.threadId,
        to: toList.join(', '),
        cc: ccList.length ? ccList.join(', ') : undefined,
        bcc: bccList.length ? bccList.join(', ') : undefined,
        subject: subject.trim() || composeSubject(mode, thread.subject),
        bodyHtml: html,
        bodyText: text,
        inReplyTo: isForward ? undefined : inReplyTo,
        references: isForward ? undefined : references || undefined,
      })
      if (result.error) {
        toast(`Send failed: ${result.error}`, 'error')
        return
      }
      toast('Sent.', 'success')
      onClose()
    } catch (err) {
      toast(`Send failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setSending(false)
    }
  }

  const refineWithCopilot = () => {
    if (!editor) return
    const currentDraft = editor.getText().trim()
    const threadSubject = thread.subject || '(No subject)'

    const lines: string[] = []
    lines.push(`Help me refine this draft email response. **Please ask me how I want to refine it before making any changes** — wait for my answer, then apply the edits.`)
    lines.push('')
    lines.push(`**Mode:** ${modeLabel}`)
    lines.push(`**Subject:** ${threadSubject}`)
    lines.push('')
    lines.push(`## Thread (${thread.messages.length} message${thread.messages.length === 1 ? '' : 's'})`)
    lines.push('')
    thread.messages.forEach((message, index) => {
      lines.push(`### Message ${index + 1}`)
      if (message.from) lines.push(`**From:** ${message.from}`)
      if (message.to) lines.push(`**To:** ${message.to}`)
      if (message.date) lines.push(`**Date:** ${message.date}`)
      lines.push('')
      lines.push((message.body || '(empty)').trim())
      lines.push('')
    })

    lines.push(`## Current draft`)
    lines.push('')
    lines.push(currentDraft || '(empty — no draft yet)')

    window.__pendingEmailDraft = { prompt: lines.join('\n') }
    window.dispatchEvent(new Event('email-block:draft-with-assistant'))
  }

  return (
    <div className="gmail-compose-card border-none bg-transparent p-0 shadow-none ml-0">
      <div className="gmail-compose-header flex items-center justify-between border-b border-white/5 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={() => onModeChange?.('reply')}
            className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition", mode === 'reply' ? "bg-[#1dff00]/15 text-[#1dff00]" : "text-zinc-400 hover:text-zinc-300")}
          >
            Reply
          </button>
          <button 
            type="button" 
            onClick={() => onModeChange?.('replyAll')}
            className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition", mode === 'replyAll' ? "bg-[#1dff00]/15 text-[#1dff00]" : "text-zinc-400 hover:text-zinc-300")}
          >
            Reply All
          </button>
          <button 
            type="button" 
            onClick={() => onModeChange?.('forward')}
            className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition", mode === 'forward' ? "bg-[#1dff00]/15 text-[#1dff00]" : "text-zinc-400 hover:text-zinc-300")}
          >
            Forward
          </button>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">Draft Auto-Saved</span>
      </div>
      <RecipientField
        label="To"
        value={toList}
        onChange={setToList}
        autoFocus={mode === 'forward'}
        trailing={
          <div className="gmail-recipient-toggles">
            {!showCc && <button type="button" onClick={() => setShowCc(true)}>Cc</button>}
            {!showBcc && <button type="button" onClick={() => setShowBcc(true)}>Bcc</button>}
          </div>
        }
      />
      {showCc && <RecipientField label="Cc" value={ccList} onChange={setCcList} />}
      {showBcc && <RecipientField label="Bcc" value={bccList} onChange={setBccList} />}
      {mode === 'forward' && (
        <div className="gmail-compose-line">
          <span className="gmail-compose-label">Subject</span>
          <input
            className="gmail-compose-subject-input"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
          />
        </div>
      )}
      <div className="border border-white/5 rounded-xl bg-black/40 overflow-hidden mb-3">
        <EditorContent editor={editor} className="gmail-compose-editor max-h-48 overflow-y-auto" />
      </div>
      {linkOpen && (
        <div className="gmail-compose-link-popover" onMouseDown={(event) => event.preventDefault()}>
          <input
            ref={linkInputRef}
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://example.com"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applyLink()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancelLink()
              }
            }}
          />
          <button type="button" className="gmail-compose-link-popover-apply" onClick={applyLink}>Apply</button>
          <button type="button" className="gmail-compose-link-popover-cancel" onClick={cancelLink}>Cancel</button>
        </div>
      )}
      <div className="gmail-compose-actions mt-3">
        <div className="gmail-compose-actions-primary">
          <button
            type="button"
            className="gmail-send-button"
            onClick={() => { void sendInGmail() }}
            disabled={sending}
            title="Send this reply via Gmail"
          >
            {sending ? <LoaderIcon size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Sending…' : 'Send reply'}
          </button>
          <button
            type="button"
            className="gmail-refine-button"
            onClick={refineWithCopilot}
            title="Refine this draft with Copilot"
          >
            <Sparkles size={15} />
            Refine with AI
          </button>
        </div>
        {editor && <ComposeToolbar editor={editor} onOpenLink={openLink} />}
      </div>
    </div>
  )
}

function findCandidateForThread(thread: GmailThread) {
  const latest = thread.messages[thread.messages.length - 1] || thread
  const fromStr = latest.from || thread.from || ''
  const email = extractAddress(fromStr).toLowerCase().trim()
  const name = extractName(fromStr).trim()

  let candidate = CANDIDATES.find((c) => c.email.toLowerCase().trim() === email)
  if (candidate) return candidate

  candidate = CANDIDATES.find((c) => c.name.toLowerCase().trim() === name.toLowerCase())
  if (candidate) return candidate

  return null
}

function getCandidateContext(thread: GmailThread) {
  const match = findCandidateForThread(thread)
  if (match) return match

  const latest = thread.messages[thread.messages.length - 1] || thread
  const fromStr = latest.from || thread.from || ''
  const name = extractName(fromStr)
  const email = extractAddress(fromStr)

  let score = 75
  let intent: any = 'Passive'
  let role = 'Software Engineer'
  let stage: any = 'Screening'
  let aiInsight = 'AI-generated candidate placeholder.'

  if (name.toLowerCase().includes('devpost')) {
    role = 'Hackathon Developer'
    intent = 'High Engagement'
    stage = 'New'
    score = 88
    aiInsight = 'Candidate has submitted hackathon project details. Showed strong proactive builder qualities.'
  } else if (name.toLowerCase().includes('vercel')) {
    role = 'Frontend / Platform Engineer'
    intent = 'Actively Sourcing'
    stage = 'Contacted'
    score = 92
    aiInsight = 'Vercel deploy builder. Experience in Edge environments, Next.js architecture, and React optimizations.'
  } else {
    let hash = 0
    for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0
    score = 65 + (hash % 30)
    const roles = ['Frontend Engineer', 'Fullstack Engineer', 'Mobile Dev', 'Product Designer']
    role = roles[hash % roles.length]
    const intents = ['Actively Sourcing', 'Recently Promoted', 'High Engagement', 'Passive']
    intent = intents[hash % intents.length]
    const stages = ['New', 'Contacted', 'Screening', 'In Review', 'Shortlisted', 'Interview']
    stage = stages[hash % stages.length]
    aiInsight = `Candidate ${name} sent an email response. Match score ${score}% based on resume profile.`
  }

  return {
    id: `dyn-${thread.threadId}`,
    name,
    title: role,
    location: 'Remote',
    experienceYears: 4,
    matchScore: score,
    stage: stage,
    source: 'LinkedIn' as any,
    lastActivity: formatInboxTime(latest.date || thread.date),
    skills: ['React', 'TypeScript', 'Node.js'],
    highlights: ['Contributor to open-source repos', 'Experienced in fast-paced software environments'],
    aiInsight,
    email,
    companyStages: ['Seed', 'Series A'] as any,
    growthTrajectory: 'Fast' as any,
    vestingStatus: 'Partially Vested' as any,
    intentSignal: intent,
    startupFitScore: score - 2,
    startupFitInsight: 'Demonstrates fast adaptation cycles and solid individual output capabilities.',
  }
}

function getThreadIntent(thread: GmailThread) {
  const text = (thread.summary || thread.subject || '').toLowerCase() + 
               (thread.messages.map(m => m.body || m.bodyHtml || '').join(' ')).toLowerCase()
  
  if (text.includes('salary') || text.includes('compensation') || text.includes('range') || text.includes('rate')) {
    return 'Salary Questions'
  }
  if (text.includes('schedule') || text.includes('calendar') || text.includes('meet') || text.includes('call') || text.includes('interview') || text.includes('zoom')) {
    return 'Scheduling'
  }
  if (text.includes('no thank') || text.includes('not interested') || text.includes('decline') || text.includes('another time') || text.includes('busy')) {
    return 'Not Interested'
  }
  if (text.includes('objection') || text.includes('but') || text.includes('cannot') || text.includes('remote') || text.includes('location')) {
    return 'Objections'
  }
  if (text.includes('interested') || text.includes('would love') || text.includes('sounds good') || text.includes('excited') || text.includes('resume')) {
    return 'Interested'
  }
  
  const intents = ['Interested', 'Needs Reply', 'Human Review', 'AI Drafts']
  let hash = 0
  for (let i = 0; i < thread.threadId.length; i++) hash = (hash * 31 + thread.threadId.charCodeAt(i)) >>> 0
  return intents[hash % intents.length]
}

function ThreadDetail({
  thread,
  onClose,
  hidden,
}: {
  thread: GmailThread
  onClose: () => void
  hidden?: boolean
}) {
  const [composeMode, setComposeMode] = useState<ComposeMode>('reply')
  const [selfEmail, setSelfEmail] = useState<string>('')
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(
    () => new Set(thread.messages.length > 0 ? [thread.messages.length - 1] : [])
  )
  const [candidateCardExpanded, setCandidateCardExpanded] = useState(true)
  const [aiCardExpanded, setAiCardExpanded] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.ipc.invoke('gmail:getAccountEmail', {})
      .then((res) => { if (!cancelled && res?.email) setSelfEmail(res.email) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const toggleExpand = useCallback((index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const candidate = useMemo(() => getCandidateContext(thread), [thread])
  const intent = useMemo(() => getThreadIntent(thread), [thread])

  const suggestedAction = useMemo(() => {
    if (intent === 'Salary Questions') return 'Provide salary band ($130k-$165k) and check remote flexibility constraints.'
    if (intent === 'Objections') return 'Address timezone mismatch objections. Offer flexible scheduling.'
    if (intent === 'Interested') return 'Approve AI follow-up draft and offer next Monday/Wednesday slots.'
    if (intent === 'Scheduling') return 'Send calendar scheduler link and confirm resume attachment.'
    return 'Review response and formulate standard reply.'
  }, [intent])

  const handlePipelineMove = () => {
    toast(`Candidate ${candidate.name} moved to screening stage!`, 'success')
  }

  const handleScheduleCall = () => {
    toast(`Opening calendar slots for ${candidate.name}...`, 'success')
    window.dispatchEvent(new CustomEvent('outreach:schedule-meeting', { detail: { name: candidate.name } }))
  }

  const threadSummary = thread.summary || thread.messages[0]?.body || 'Candidate replied positively and requested more information about the role.'

  return (
    <div className={cn('gmail-detail-view flex flex-col h-full overflow-hidden w-full', hidden && 'hidden')}>
      {/* Header Panel */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 flex-shrink-0 bg-black/10">
        <div>
          <h1 className="text-sm font-semibold text-white tracking-wide truncate max-w-lg">{thread.subject || '(No subject)'}</h1>
          <p className="text-[10px] text-zinc-500 mt-0.5">Thread ID: {thread.threadId}</p>
        </div>
        <button 
          type="button" 
          onClick={onClose} 
          className="size-8 rounded-lg flex items-center justify-center border border-white/10 hover:bg-white/5 transition text-zinc-400 hover:text-white pr-0"
          aria-label="Close details"
        >
          <X size={14} />
        </button>
      </div>

      {/* Main Details and Messages scroll container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Candidate Context Card (Collapsible) */}
        <div className="bg-white/[0.015] border border-white/5 rounded-xl overflow-hidden shadow-sm transition-all duration-250">
          <button
            type="button"
            onClick={() => setCandidateCardExpanded(!candidateCardExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.01] hover:bg-white/[0.03] transition text-left select-none outline-none"
          >
            <div className="flex items-center gap-2">
              <User size={13} className="text-zinc-400" />
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">Candidate Context</span>
              {!candidateCardExpanded && (
                <span className="text-xs text-zinc-300 font-medium ml-2">— {candidate.name} ({candidate.title})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!candidateCardExpanded && (
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#1dff00]/10 text-[#1dff00]">
                  {candidate.matchScore}% fit
                </div>
              )}
              <span className="text-zinc-500 pr-0">
                {candidateCardExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </div>
          </button>

          {candidateCardExpanded && (
            <div className="p-4 border-t border-white/5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-inner"
                    style={{ background: avatarGradient(candidate.name) }}
                  >
                    {initials(candidate.name)}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white tracking-wide">{candidate.name}</h2>
                    <p className="text-xs text-zinc-400 font-medium">{candidate.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-zinc-500 font-medium">
                      <span>{candidate.location}</span>
                      <span className="text-zinc-700">•</span>
                      <span>{candidate.experienceYears} yrs exp</span>
                      <span className="text-zinc-700">•</span>
                      <span className="capitalize">{candidate.source}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: matchTone(candidate.matchScore).bg, color: matchTone(candidate.matchScore).text }}>
                    Match {candidate.matchScore}%
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1.5">Stage: <span className="text-zinc-300 font-medium">{candidate.stage}</span></p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 flex-wrap">
                <button 
                  type="button" 
                  onClick={handlePipelineMove}
                  className="px-2.5 py-1 rounded-lg bg-[#1dff00]/10 hover:bg-[#1dff00]/20 text-[#1dff00] text-[10px] font-semibold flex items-center gap-1 transition-all"
                >
                  <ArrowRight size={10} /> Move to Pipeline
                </button>
                <button 
                  type="button" 
                  onClick={handleScheduleCall}
                  className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-semibold flex items-center gap-1 transition-all"
                >
                  <Calendar size={10} /> Schedule Interview
                </button>
                <span className="text-[10px] text-zinc-500 font-mono ml-auto">Fit score: {candidate.startupFitScore}%</span>
              </div>
            </div>
          )}
        </div>

        {/* AI Assistant Insight (Collapsible) */}
        <div className="bg-[#1dff00]/[0.015] border border-[#1dff00]/10 rounded-xl overflow-hidden transition-all duration-250">
          <button
            type="button"
            onClick={() => setAiCardExpanded(!aiCardExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#1dff00]/[0.01] hover:bg-[#1dff00]/[0.03] transition text-left select-none outline-none"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-[#1dff00]" />
              <span className="text-[10px] font-bold text-[#1dff00] uppercase tracking-wider">AI Recruiter Assistant</span>
              {!aiCardExpanded && (
                <span className="text-[10px] text-zinc-400 font-medium ml-2">— suggested action: {intent}</span>
              )}
            </div>
            <span className="text-zinc-500 pr-0">
              {aiCardExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          </button>

          {aiCardExpanded && (
            <div className="p-4 border-t border-[#1dff00]/5">
              <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                <strong className="text-white">Summary: </strong>{threadSummary}
              </p>
              <div className="text-xs text-zinc-400 flex items-start gap-1 pt-2.5 border-t border-white/5">
                <strong className="text-zinc-300 flex-shrink-0">Suggested Action: </strong>
                <span>{suggestedAction}</span>
              </div>
            </div>
          )}
        </div>

        {/* Message stack */}
        <div className="space-y-4">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Message Stack</div>
          <div className="gmail-message-stack">
            {thread.messages.map((message, index) => {
              const isExpanded = expandedIndices.has(index)
              return (
                <div key={message.id || index} className={cn('gmail-message border border-white/5 bg-white/[0.01] rounded-xl overflow-hidden', isExpanded && 'gmail-message-expanded')}>
                  <div className="gmail-message-header-bar flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.01] transition select-none" onClick={() => toggleExpand(index)}>
                    <div className="gmail-message-avatar flex-shrink-0" style={{ backgroundColor: avatarColor(message.from) }}>
                      {getInitial(message.from)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-white tracking-wide truncate">{extractName(message.from)}</strong>
                        <span className="text-[10px] text-zinc-500 font-mono">{isExpanded ? formatFullDate(message.date) : formatInboxTime(message.date)}</span>
                      </div>
                      {!isExpanded && <div className="text-[11px] text-zinc-500 truncate mt-0.5">{snippet(message.body)}</div>}
                      {isExpanded && (
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          to {message.to || 'me'}
                          {message.cc && <span className="ml-2">cc {message.cc}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-white/5">
                      <MessageBody message={message} threadId={thread.threadId} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Docked Reply Box */}
      <div className="border-t border-white/5 p-5 bg-black/20 flex-shrink-0">
        <ComposeBox
          key={composeMode}
          mode={composeMode}
          thread={thread}
          selfEmail={selfEmail}
          onClose={() => {}}
          onModeChange={setComposeMode}
        />
      </div>
    </div>
  )
}

const PAGE_SIZE = 25
type InboxSection = 'important' | 'other'

interface SectionState {
  threads: GmailThread[]
  nextCursor: string | null
  hasReachedEnd: boolean
  loadingPage: boolean
}

const initialSectionState: SectionState = {
  threads: [],
  nextCursor: null,
  hasReachedEnd: false,
  loadingPage: false,
}

let persistedImportant: SectionState | null = null
let persistedOther: SectionState | null = null

function clearLoadingFlag(state: SectionState | null): SectionState {
  if (!state) return initialSectionState
  return { ...state, loadingPage: false }
}

export type EmailViewProps = {
  initialThreadId?: string | null
  threadIdVersion?: number
}

const INBOX_FILTERS = [
  { id: 'all', label: 'All Conversations' },
  { id: 'unread', label: 'Unread' },
  { id: 'needs-reply', label: 'Needs Reply' },
  { id: 'interested', label: 'Interested' },
  { id: 'scheduling', label: 'Interview Scheduling' },
  { id: 'salary', label: 'Salary Question' },
  { id: 'objection', label: 'Objections' },
  { id: 'not-interested', label: 'Not Interested' },
  { id: 'ai-drafts', label: 'AI Drafts' },
  { id: 'human-review', label: 'Human Review' },
  { id: 'bounced', label: 'Bounced' }
]

export function EmailView({ initialThreadId, threadIdVersion }: EmailViewProps = {}) {
  const [important, setImportant] = useState<SectionState>(() => clearLoadingFlag(persistedImportant))
  const [other, setOther] = useState<SectionState>(() => clearLoadingFlag(persistedOther))
  const hadPersistedDataOnMount = useRef(persistedImportant !== null)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreadId ?? null)
  const [selectedFilter, setSelectedFilter] = useState<string>('all')

  const [filtersCollapsed, setFiltersCollapsed] = useState<boolean>(false)
  const [importantExpanded, setImportantExpanded] = useState<boolean>(true)
  const [otherExpanded, setOtherExpanded] = useState<boolean>(true)

  useEffect(() => {
    setSelectedThreadId(initialThreadId ?? null)
  }, [initialThreadId, threadIdVersion])

  const [refreshing, setRefreshing] = useState(!hadPersistedDataOnMount.current)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [emailConnection, setEmailConnection] = useState<GmailConnectionStatus | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const status = await window.ipc.invoke('gmail:getConnectionStatus', {})
        if (!cancelled) setEmailConnection(status)
      } catch {
        if (!cancelled) {
          setEmailConnection({
            connected: false,
            hasRequiredScope: false,
            missingScopes: [],
            email: null,
          })
        }
      }
    }
    void check()
    const cleanupOAuthConnect = window.ipc.on('oauth:didConnect', () => { void check() })
    return () => {
      cancelled = true
      cleanupOAuthConnect()
    }
  }, [])

  useEffect(() => { persistedImportant = important }, [important])
  useEffect(() => { persistedOther = other }, [other])

  const setSection = useCallback((section: InboxSection, updater: (prev: SectionState) => SectionState) => {
    if (section === 'important') setImportant(updater)
    else setOther(updater)
  }, [])

  const updateThreadInState = useCallback((threadId: string, updater: (t: GmailThread) => GmailThread) => {
    const mapSection = (prev: SectionState): SectionState => ({
      ...prev,
      threads: prev.threads.map((t) => (t.threadId === threadId ? updater(t) : t)),
    })
    setImportant(mapSection)
    setOther(mapSection)
  }, [])

  const removeThreadFromState = useCallback((threadId: string) => {
    const filterSection = (prev: SectionState): SectionState => ({
      ...prev,
      threads: prev.threads.filter((t) => t.threadId !== threadId),
    })
    setImportant(filterSection)
    setOther(filterSection)
    setSelectedThreadId((current) => (current === threadId ? null : current))
  }, [])

  const markThreadReadAction = useCallback(async (threadId: string) => {
    updateThreadInState(threadId, (t) => ({
      ...t,
      unread: false,
      messages: t.messages.map((m) => ({ ...m, unread: false })),
    }))
    try {
      const result = await window.ipc.invoke('gmail:markThreadRead', { threadId })
      if (!result.ok && result.error) console.warn('[Gmail] mark-read failed:', result.error)
    } catch (err) {
      console.warn('[Gmail] mark-read failed:', err)
    }
  }, [updateThreadInState])

  const archiveThreadAction = useCallback(async (threadId: string) => {
    try {
      const result = await window.ipc.invoke('gmail:archiveThread', { threadId })
      if (result.ok) {
        removeThreadFromState(threadId)
      } else if (result.error) {
        toast(`Archive failed: ${result.error}`, 'error')
      }
    } catch (err) {
      toast(`Archive failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }, [removeThreadFromState])

  const trashThreadAction = useCallback(async (threadId: string) => {
    try {
      const result = await window.ipc.invoke('gmail:trashThread', { threadId })
      if (result.ok) {
        removeThreadFromState(threadId)
      } else if (result.error) {
        toast(`Delete failed: ${result.error}`, 'error')
      }
    } catch (err) {
      toast(`Delete failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }, [removeThreadFromState])

  const selectThread = useCallback((thread: GmailThread) => {
    setSelectedThreadId(thread.threadId)
    if (thread.unread) {
      void markThreadReadAction(thread.threadId)
    }
  }, [markThreadReadAction])

  const prefetchedRef = useRef<Set<string>>(new Set())
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelHoverPrefetch = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const scheduleHoverPrefetch = useCallback((thread: GmailThread) => {
    cancelHoverPrefetch()
    if (prefetchedRef.current.has(thread.threadId)) return
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null
      prefetchedRef.current.add(thread.threadId)
      prefetchThreadImages(thread)
    }, PREFETCH_HOVER_MS)
  }, [cancelHoverPrefetch])

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
  }, [])

  const epochsRef = useRef<Record<InboxSection, number>>({ important: 0, other: 0 })

  const sectionChannel = (section: InboxSection) =>
    section === 'important' ? 'gmail:getImportant' as const : 'gmail:getEverythingElse' as const

  const loadNextPage = useCallback(async (section: InboxSection) => {
    const current = section === 'important' ? important : other
    if (current.loadingPage || current.hasReachedEnd) return

    const epoch = epochsRef.current[section]
    setSection(section, (prev) => ({ ...prev, loadingPage: true }))
    try {
      const result = await window.ipc.invoke(sectionChannel(section), {
        cursor: current.nextCursor ?? undefined,
        limit: PAGE_SIZE,
      })
      if (epoch !== epochsRef.current[section]) return
      setSection(section, (prev) => ({
        threads: [...prev.threads, ...result.threads],
        nextCursor: result.nextCursor,
        hasReachedEnd: result.nextCursor === null,
        loadingPage: false,
      }))
    } catch (err) {
      if (epoch !== epochsRef.current[section]) return
      console.warn(`[Gmail] page load failed for ${section}:`, err)
      setSection(section, (prev) => ({ ...prev, loadingPage: false }))
    }
  }, [important, other, setSection])

  const reloadFirstPage = useCallback(async (section: InboxSection, options: { silent?: boolean } = {}) => {
    const epoch = ++epochsRef.current[section]
    if (options.silent) {
      setSection(section, (prev) => ({ ...prev, loadingPage: true }))
    } else {
      setSection(section, () => ({ ...initialSectionState, loadingPage: true }))
    }
    try {
      const result = await window.ipc.invoke(sectionChannel(section), {
        limit: PAGE_SIZE,
      })
      if (epoch !== epochsRef.current[section]) return
      setSection(section, () => ({
        threads: result.threads,
        nextCursor: result.nextCursor,
        hasReachedEnd: result.nextCursor === null,
        loadingPage: false,
      }))
    } catch (err) {
      if (epoch !== epochsRef.current[section]) return
      console.warn(`[Gmail] initial page load failed for ${section}:`, err)
      setSection(section, (prev) => ({ ...prev, loadingPage: false }))
    }
  }, [setSection])

  useEffect(() => {
    if (hadPersistedDataOnMount.current) {
      void reloadFirstPage('important', { silent: true })
      if (other.threads.length > 0) {
        void reloadFirstPage('other', { silent: true })
      }
    } else {
      void reloadFirstPage('important')
    }
  }, [])

  useEffect(() => {
    if (!important.hasReachedEnd) return
    if (other.threads.length > 0) return
    if (other.loadingPage) return
    void reloadFirstPage('other')
  }, [important.hasReachedEnd, other.threads.length, other.loadingPage, reloadFirstPage])

  const pendingReloadRef = useRef(false)
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReloadAtRef = useRef(0)
  const isSelectedRef = useRef<string | null>(null)
  isSelectedRef.current = selectedThreadId
  const isRefreshingRef = useRef(false)
  isRefreshingRef.current = refreshing
  const otherHasThreadsRef = useRef(false)
  otherHasThreadsRef.current = other.threads.length > 0

  const RELOAD_THROTTLE_MS = 3000

  const doReload = useCallback(() => {
    if (isRefreshingRef.current) return
    if (isSelectedRef.current !== null) {
      pendingReloadRef.current = true
      return
    }
    lastReloadAtRef.current = Date.now()
    void reloadFirstPage('important', { silent: true })
    if (otherHasThreadsRef.current) {
      void reloadFirstPage('other', { silent: true })
    }
  }, [reloadFirstPage])

  const triggerLiveReload = useCallback(() => {
    const sinceLast = Date.now() - lastReloadAtRef.current
    if (sinceLast >= RELOAD_THROTTLE_MS && !reloadDebounceRef.current) {
      doReload()
      return
    }
    if (reloadDebounceRef.current) return
    const wait = Math.max(200, RELOAD_THROTTLE_MS - sinceLast)
    reloadDebounceRef.current = setTimeout(() => {
      reloadDebounceRef.current = null
      doReload()
    }, wait)
  }, [doReload])

  useEffect(() => {
    const cleanup = window.ipc.on('workspace:didChange', (event) => {
      const matches = (p: string) => p.startsWith('inbox_lists/')
      switch (event.type) {
        case 'created':
        case 'changed':
        case 'deleted':
          if (event.path && matches(event.path)) triggerLiveReload()
          break
        case 'moved':
          if ((event.from && matches(event.from)) || (event.to && matches(event.to))) triggerLiveReload()
          break
        case 'bulkChanged':
          if (event.paths?.some(matches)) triggerLiveReload()
          break
      }
    })
    return () => {
      cleanup()
      if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current)
    }
  }, [triggerLiveReload])

  useEffect(() => {
    if (selectedThreadId !== null) return
    if (!pendingReloadRef.current) return
    pendingReloadRef.current = false
    lastReloadAtRef.current = Date.now()
    void reloadFirstPage('important', { silent: true })
    if (otherHasThreadsRef.current) {
      void reloadFirstPage('other', { silent: true })
    }
  }, [selectedThreadId, reloadFirstPage])

  const refreshInFlightRef = useRef(false)
  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    setRefreshing(true)
    setError(null)
    try {
      await window.ipc.invoke('gmail:triggerSync', {})
    } catch (err) {
      console.warn('[Gmail] triggerSync failed:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setTimeout(() => {
        refreshInFlightRef.current = false
        setRefreshing(false)
      }, 800)
    }
  }, [])

  useEffect(() => {
    if (hadPersistedDataOnMount.current) return
    void refresh()
  }, [])

  const getFilteredThreads = useCallback((threads: GmailThread[]) => {
    return threads.filter((thread) => {
      const latest = latestMessage(thread)
      const queryNormalized = query.trim().toLowerCase()
      if (queryNormalized) {
        const matchSearch = [
          thread.subject,
          latest?.from,
          latest?.to,
          latest?.body,
        ].some(value => (value || '').toLowerCase().includes(queryNormalized))
        if (!matchSearch) return false
      }

      const intent = getThreadIntent(thread)
      const hasDraft = thread.gmail_draft || thread.draft_response
      
      switch (selectedFilter) {
        case 'unread':
          return thread.unread === true
        case 'needs-reply':
          return thread.unread === true || intent === 'Needs Reply' || intent === 'Interested'
        case 'interested':
          return intent === 'Interested'
        case 'scheduling':
          return intent === 'Scheduling'
        case 'salary':
          return intent === 'Salary Questions'
        case 'objection':
          return intent === 'Objections'
        case 'not-interested':
          return intent === 'Not Interested'
        case 'ai-drafts':
          return !!hasDraft
        case 'human-review':
          return intent === 'Human Review'
        case 'bounced':
          return (thread.subject || '').toLowerCase().includes('bounce') || (latest?.body || '').toLowerCase().includes('delivery status notification')
        default:
          return true
      }
    })
  }, [selectedFilter, query])

  const visibleImportant = useMemo(() => getFilteredThreads(important.threads), [important.threads, getFilteredThreads])
  const visibleOther = useMemo(() => getFilteredThreads(other.threads), [other.threads, getFilteredThreads])

  const hasAny = important.threads.length > 0 || other.threads.length > 0
  const initialLoading = !hasAny && refreshing
  const needsEmailConnect = emailConnection?.connected === false
  const needsEmailReconnect = emailConnection?.connected === true && !emailConnection.hasRequiredScope

  const outreachStats = useMemo(() => {
    const threads = [...important.threads, ...other.threads]
    const unread = threads.filter((thread) => thread.unread).length
    const drafts = threads.filter((thread) => thread.gmail_draft || thread.draft_response).length
    const replies = threads.filter((thread) => thread.messages.length > 1).length
    return {
      active: threads.length,
      unread,
      drafts,
      replies,
    }
  }, [important.threads, other.threads])

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null
    return important.threads.find((t) => t.threadId === selectedThreadId)
      || other.threads.find((t) => t.threadId === selectedThreadId)
      || null
  }, [selectedThreadId, important.threads, other.threads])

  function getFilterIcon(id: string) {
    switch (id) {
      case 'all': return <Mail size={14} />
      case 'unread': return <CheckCheck size={14} />
      case 'needs-reply': return <Reply size={14} />
      case 'interested': return <Sparkles size={14} className="text-[#1dff00]" />
      case 'scheduling': return <Calendar size={14} />
      case 'salary': return <TrendingUp size={14} />
      case 'objection': return <AlertCircle size={14} />
      case 'not-interested': return <Ban size={14} />
      case 'ai-drafts': return <Sparkles size={14} className="text-purple-400" />
      case 'human-review': return <User size={14} />
      case 'bounced': return <Archive size={14} />
      default: return <Mail size={14} />
    }
  }

  const renderRow = (thread: GmailThread) => {
    const latest = latestMessage(thread)
    const isSelected = thread.threadId === selectedThreadId
    const isUnread = thread.unread === true
    const candidate = getCandidateContext(thread)
    const intent = getThreadIntent(thread)

    const isLinkedIn = candidate.source === 'LinkedIn'

    let intentBg = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    if (intent === 'Interested') intentBg = 'bg-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/25'
    if (intent === 'Salary Questions') intentBg = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    if (intent === 'Objections') intentBg = 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    if (intent === 'Not Interested') intentBg = 'bg-red-500/10 text-red-400 border-red-500/20'
    if (intent === 'Scheduling') intentBg = 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    if (intent === 'AI Drafts') intentBg = 'bg-purple-500/10 text-purple-400 border-purple-500/20'

    const stop = (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation()
    }

    return (
      <div 
        key={thread.threadId} 
        className={cn(
          "gmail-row-shell transition-all duration-150 border-b border-white/5 relative",
          isSelected ? "bg-white/[0.03] border-l-2 border-l-[#1dff00]" : "hover:bg-white/[0.015] border-l-2 border-l-transparent",
          isUnread && "bg-[#1dff00]/[0.01]"
        )}
        onMouseEnter={() => scheduleHoverPrefetch(thread)}
        onMouseLeave={cancelHoverPrefetch}
      >
        <button
          type="button"
          className="w-full flex flex-col p-4 text-left outline-none pr-20"
          onClick={() => selectThread(thread)}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", isUnread ? "bg-[#1dff00]" : "bg-transparent")} />
              <span className="font-semibold text-xs text-white tracking-wide truncate">{candidate.name}</span>
              <span className="text-[10px] text-zinc-500 font-mono flex-shrink-0">Fit: {candidate.matchScore}%</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium flex-shrink-0 pl-2">{formatInboxTime(latest?.date || thread.date)}</span>
          </div>

          <div className="text-[11px] text-zinc-400 font-medium truncate mb-2 pr-4">
            {candidate.title}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className={cn("text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold", intentBg)}>
              {intent}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/5 bg-white/5 text-zinc-400 font-medium capitalize">
              {candidate.stage}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/5 bg-white/5 text-zinc-400 font-medium uppercase tracking-wide flex items-center gap-1">
              <span className={cn("w-1 h-1 rounded-full", isLinkedIn ? "bg-blue-400" : "bg-red-400")} />
              {isLinkedIn ? 'LinkedIn' : 'Gmail'}
            </span>
            {(thread.gmail_draft || thread.draft_response) && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-purple-500/20 bg-purple-500/10 text-purple-400 font-semibold flex items-center gap-1">
                <Sparkles size={8} /> Draft
              </span>
            )}
          </div>

          <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed pr-2">
            {snippet(latest?.body || thread.latest_email)}
          </p>
        </button>

        <div className="gmail-row-actions absolute right-3 top-3 flex items-center gap-1 z-10" onMouseDown={stop} onClick={stop}>
          {isUnread && (
            <button
              type="button"
              className="gmail-row-action flex items-center justify-center border border-white/10 bg-black/40 hover:bg-[#1dff00]/10 hover:text-[#1dff00] transition rounded-lg size-7"
              title="Mark as read"
              aria-label="Mark as read"
              onClick={(e) => { stop(e); void markThreadReadAction(thread.threadId) }}
            >
              <CheckCheck size={13} />
            </button>
          )}
          <button
            type="button"
            className="gmail-row-action flex items-center justify-center border border-white/10 bg-black/40 hover:bg-white/10 hover:text-white transition rounded-lg size-7"
            title="Archive"
            aria-label="Archive"
            onClick={(e) => { stop(e); void archiveThreadAction(thread.threadId) }}
          >
            <Archive size={13} />
          </button>
          <button
            type="button"
            className="gmail-row-action gmail-row-action-danger flex items-center justify-center border border-white/10 bg-black/40 hover:bg-red-500/15 hover:text-red-400 transition rounded-lg size-7"
            title="Delete"
            aria-label="Delete"
            onClick={(e) => { stop(e); void trashThreadAction(thread.threadId) }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="gmail-shell flex flex-col h-full overflow-hidden w-full bg-[#020302]">
      {/* Top Header */}
      <div className="gmail-outreach-hero flex-shrink-0 border-b border-white/5 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="gmail-outreach-orb">
            <Send size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight leading-none">Unified Inbox</h1>
            <p className="text-[11px] text-zinc-500 mt-1">Manage candidate replies, AI follow-ups, and recruiting conversations across channels.</p>
            {/* Stats pills */}
            <div className="flex items-center gap-2 mt-2">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/5 text-[10px] text-zinc-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1dff00]" />
                <strong>{outreachStats.active}</strong> active threads
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/5 text-[10px] text-zinc-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1dff00]" />
                <strong>{outreachStats.unread}</strong> unread
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400 font-bold">
                <Sparkles size={9} />
                <strong>{outreachStats.drafts}</strong> AI drafts
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/5 text-[10px] text-zinc-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <strong>{outreachStats.replies}</strong> warm replies
              </div>
            </div>
          </div>
        </div>

        <div className="gmail-outreach-actions flex items-center gap-3">
          <div className="gmail-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search candidates, roles, or threads..."
            />
          </div>
          <button type="button" className="gmail-icon-button flex items-center justify-center rounded-xl size-10 bg-white/[0.02] hover:bg-white/5 border border-white/5 transition" onClick={() => void refresh()} aria-label="Refresh">
            {refreshing ? <LoaderIcon size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {/* Main 3-panel container */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-black/15">
        
        {/* Left Column: Filters (Collapsible) */}
        <div className={cn(
          "border-r border-white/5 flex flex-col py-4 bg-black/10 select-none flex-shrink-0 transition-all duration-300",
          filtersCollapsed ? "w-16 px-1" : "w-56 px-3"
        )}>
          {/* Header + Collapse toggle */}
          <div className={cn("flex items-center mb-2.5", filtersCollapsed ? "justify-center px-1" : "justify-between px-3")}>
            {!filtersCollapsed && <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Filters</div>}
            <button 
              type="button" 
              onClick={() => setFiltersCollapsed(!filtersCollapsed)}
              className={cn(
                "transition rounded-lg flex items-center justify-center p-0 size-7 border transition-all duration-200 pr-0",
                filtersCollapsed 
                  ? "text-[#1dff00] border-[#1dff00]/30 bg-[#1dff00]/10 hover:bg-[#1dff00]/20 shadow-[0_0_10px_rgba(29,255,0,0.15)]" 
                  : "text-zinc-500 hover:text-white border-transparent hover:bg-white/5"
              )}
              title={filtersCollapsed ? "Expand Filters" : "Collapse Filters"}
            >
              <PanelLeftIcon size={14} />
            </button>
          </div>

          <div className="space-y-1">
            {INBOX_FILTERS.map((f) => {
              const active = selectedFilter === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFilter(f.id)}
                  title={filtersCollapsed ? f.label : undefined}
                  className={cn(
                    "w-full flex items-center rounded-lg transition-all duration-150 border border-transparent",
                    filtersCollapsed ? "justify-center h-10 w-10 mx-auto px-0 py-0" : "justify-between px-3 py-2 text-[11px] font-semibold text-left pr-2",
                    active
                      ? "bg-[#1dff00]/10 text-[#1dff00] border-[#1dff00]/25"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {getFilterIcon(f.id)}
                    {!filtersCollapsed && <span>{f.label}</span>}
                  </div>
                  {!filtersCollapsed && (
                    <>
                      {f.id === 'unread' && outreachStats.unread > 0 && (
                        <span className="bg-[#1dff00]/15 text-[#1dff00] px-1.5 py-0.5 text-[9px] font-bold rounded-md">
                          {outreachStats.unread}
                        </span>
                      )}
                      {f.id === 'ai-drafts' && outreachStats.drafts > 0 && (
                        <span className="bg-purple-500/15 text-purple-400 px-1.5 py-0.5 text-[9px] font-bold rounded-md">
                          {outreachStats.drafts}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Middle Column: Conversation List */}
        <div className="w-[390px] border-r border-white/5 flex flex-col overflow-hidden bg-black/5 flex-shrink-0">
          <div className="flex-1 overflow-y-auto">
            {error && !hasAny ? (
              <div className="gmail-empty-state text-center py-12 text-xs text-zinc-500">Could not load mail: {error}</div>
            ) : hasAny ? (
              <div className="flex flex-col">
                {visibleImportant.length > 0 && (
                  <section className="gmail-section">
                    <button
                      type="button"
                      onClick={() => setImportantExpanded(!importantExpanded)}
                      className="w-full flex items-center justify-between bg-white/[0.01] border-b border-white/5 px-4 py-2 text-[10px] text-zinc-500 tracking-wider uppercase font-semibold hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 transition-transform duration-200">
                          {importantExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        </span>
                        <span>Important</span>
                      </div>
                      <span>
                        {visibleImportant.length} thread{visibleImportant.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    {importantExpanded && (
                      <div>
                        {visibleImportant.map(renderRow)}
                      </div>
                    )}
                    {!important.hasReachedEnd && importantExpanded && (
                      <SectionSentinel
                        disabled={important.loadingPage || important.hasReachedEnd}
                        onIntersect={() => loadNextPage('important')}
                        loading={important.loadingPage}
                      />
                    )}
                  </section>
                )}
                {visibleOther.length > 0 && (
                  <section className="gmail-section">
                    <button
                      type="button"
                      onClick={() => setOtherExpanded(!otherExpanded)}
                      className="w-full flex items-center justify-between bg-white/[0.01] border-b border-white/5 px-4 py-2 text-[10px] text-zinc-500 tracking-wider uppercase font-semibold hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500 transition-transform duration-200">
                          {otherExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        </span>
                        <span>Everything else</span>
                      </div>
                      <span>
                        {visibleOther.length} thread{visibleOther.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    {otherExpanded && (
                      <div>
                        {visibleOther.map(renderRow)}
                      </div>
                    )}
                    {!other.hasReachedEnd && otherExpanded && (
                      <SectionSentinel
                        disabled={other.loadingPage || other.hasReachedEnd}
                        onIntersect={() => loadNextPage('other')}
                        loading={other.loadingPage}
                      />
                    )}
                  </section>
                )}
                {visibleImportant.length === 0 && visibleOther.length === 0 && (
                  <div className="gmail-empty-state text-center py-16 text-zinc-500 text-xs">
                    No conversations match the selected filter.
                  </div>
                )}
              </div>
            ) : needsEmailConnect || needsEmailReconnect ? (
              <div className="gmail-empty-state flex flex-col items-center gap-3 py-16 text-center px-4">
                <Mail size={24} className="opacity-40 text-[#1dff00]" />
                <p className="text-xs text-zinc-400">
                  {needsEmailReconnect
                    ? 'Reconnect your email to enable Gmail sync and actions.'
                    : 'Connect your email to see your inbox here.'}
                </p>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 mt-1"
                >
                  <Mail size={13} />
                  {needsEmailReconnect ? 'Reconnect email' : 'Connect email'}
                </button>
              </div>
            ) : (
              <div className="gmail-empty-state text-center py-16 text-zinc-500 text-xs">
                {initialLoading ? 'Loading threads from Gmail...' : 'No conversations in your cache yet.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Thread Detail View */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-black/[0.08]">
          {selectedThread ? (
            <ThreadDetail
              thread={selectedThread}
              onClose={() => setSelectedThreadId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3 select-none">
              <div className="size-12 rounded-2xl bg-white/[0.015] border border-white/5 flex items-center justify-center text-zinc-600">
                <Mail size={22} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-400">No conversation selected</h3>
                <p className="text-xs text-zinc-600 mt-1 max-w-xs leading-relaxed">Choose a candidate thread from the list to view profile, message history, and AI reply drafts.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} defaultTab="connections" />
    </div>
  )
}

function SectionSentinel({
  disabled,
  onIntersect,
  loading,
}: {
  disabled: boolean
  onIntersect: () => void
  loading: boolean
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (disabled) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onIntersect()
      }
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [disabled, onIntersect])

  return (
    <div ref={sentinelRef} className="gmail-section-sentinel py-4 flex items-center justify-center" aria-hidden>
      {loading ? <LoaderIcon size={14} className="animate-spin text-zinc-500" /> : null}
    </div>
  )
}
