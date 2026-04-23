import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  Copy,
  ExternalLink,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Plus,
  Twitter,
  UserCircle2,
  X,
  Youtube,
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useSearchStore } from '@/stores/searchStore'
import type { Lead } from '@/types'
import { cn } from '@/lib/cn'

type Tab = 'summary' | 'experience' | 'socials'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Slide-in profile panel. Shows a rich view of a single lead — avatar, name,
 * location, socials, AI summary, experience. Opened from LeadRow via
 * `uiStore.openProfile(leadId)`.
 */
export function ProfilePanel() {
  const leadId = useUIStore((s) => s.profileLeadId)
  const closeProfile = useUIStore((s) => s.closeProfile)
  const leads = useSearchStore((s) => s.leads)
  const toggleLead = useSearchStore((s) => s.toggleLead)
  const selected = useSearchStore((s) =>
    leadId ? s.selectedLeadIds.has(leadId) : false,
  )

  const lead = useMemo(
    () => leads.find((l) => l.id === leadId) ?? null,
    [leads, leadId],
  )

  const [tab, setTab] = useState<Tab>('summary')
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    setTab('summary')
  }, [leadId])

  // Slide in after mount (double rAF so the browser paints the initial off-screen state).
  useEffect(() => {
    if (!leadId || !lead) {
      setEntered(false)
      return
    }
    if (prefersReducedMotion()) {
      setEntered(true)
      return
    }
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true))
    })
    return () => window.cancelAnimationFrame(id)
  }, [leadId, lead?.id])

  const requestClose = useCallback(() => {
    if (prefersReducedMotion()) {
      closeProfile()
      return
    }
    setEntered(false)
  }, [closeProfile])

  const onPanelTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLElement>) => {
      if (e.propertyName !== 'transform') return
      if (!entered && leadId) closeProfile()
    },
    [entered, leadId, closeProfile],
  )

  // Dismiss on ESC
  useEffect(() => {
    if (!leadId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leadId, requestClose])

  if (!leadId || !lead) return null

  return (
    <div className="fixed inset-0 z-40 pointer-events-none" aria-modal="true" role="dialog">
      {/* Frosted backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/55 backdrop-blur-md pointer-events-auto',
          'transition-opacity duration-300 ease-out motion-reduce:transition-none',
          entered ? 'opacity-100' : 'opacity-0',
        )}
        onClick={requestClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        onTransitionEnd={onPanelTransitionEnd}
        className={cn(
          'absolute right-0 top-0 h-full w-full sm:w-[640px] lg:w-[760px] bg-nexus-surface/95 backdrop-blur-xl',
          'border-l border-nexus-border shadow-2xl pointer-events-auto',
          'flex flex-col will-change-transform',
          'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          entered ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-nexus-border">
          <div className="flex items-center gap-2 text-sm text-nexus-subtle">
            <UserCircle2 className="w-4 h-4" />
            Profile
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close profile"
            className="p-1.5 rounded-md text-nexus-muted hover:text-nexus-text hover:bg-nexus-elevated"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <ProfileHero lead={lead} />

          <div className="px-6">
            <button
              type="button"
              onClick={() => toggleLead(lead.id)}
              className={cn(
                'w-full mt-4 mb-5 inline-flex items-center justify-center gap-2',
                'rounded-full px-4 py-2.5 text-sm font-medium transition',
                selected
                  ? 'bg-nexus-accent/15 text-nexus-accent border border-nexus-accent/30 hover:bg-nexus-accent/25'
                  : 'bg-nexus-text text-nexus-bg hover:opacity-90',
              )}
            >
              <Plus className="w-4 h-4" />
              {selected ? 'Added to list' : 'Add to list'}
            </button>
          </div>

          <TabBar tab={tab} onChange={setTab} lead={lead} />

          <div className="px-6 pb-8">
            {tab === 'summary' && <SummaryTab lead={lead} />}
            {tab === 'experience' && <ExperienceTab lead={lead} />}
            {tab === 'socials' && <SocialsTab lead={lead} />}
          </div>
        </div>
      </aside>
    </div>
  )
}

function ProfileHero({ lead }: { lead: Lead }) {
  return (
    <div className="px-6 pt-6 pb-2">
      <div className="flex flex-col items-center text-center">
        <LargeAvatar name={lead.name} src={lead.avatar_url} />
        <h2 className="mt-4 text-xl font-semibold text-nexus-text">
          {lead.name || 'Unknown'}
          {lead.person_type && (
            <PersonTypeGlyph type={lead.person_type} />
          )}
        </h2>
        {(lead.headline || lead.title) && (
          <p className="mt-0.5 text-sm text-nexus-subtle">
            {lead.headline || lead.title}
            {lead.company && lead.title && !lead.headline ? ` · ${lead.company}` : ''}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-nexus-muted flex-wrap justify-center">
          {lead.country_code && <CountryFlag code={lead.country_code} />}
          {lead.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {lead.location}
            </span>
          )}
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1 hover:text-nexus-accent"
            >
              <Mail className="w-3 h-3" />
              {lead.email}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Mail className="w-3 h-3" />
              Check email
            </span>
          )}
          {typeof lead.followers === 'number' && lead.followers > 0 && (
            <span className="inline-flex items-center gap-1">
              {formatFollowers(lead.followers)} followers
            </span>
          )}
        </div>

        <SocialIconRow lead={lead} />
      </div>
    </div>
  )
}

function LargeAvatar({
  name,
  src,
}: {
  name: string | null
  src?: string | null
}) {
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')

  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        className="w-24 h-24 rounded-full object-cover border border-nexus-border"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }

  return (
    <div className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-semibold border border-nexus-border bg-nexus-elevated text-nexus-subtle">
      {initials || '?'}
    </div>
  )
}

function SocialIconRow({ lead }: { lead: Lead }) {
  const items: { href: string; label: string; icon: React.ReactNode }[] = []
  if (lead.linkedin_url)
    items.push({
      href: lead.linkedin_url,
      label: 'LinkedIn',
      icon: <Linkedin className="w-4 h-4" />,
    })
  if (lead.github_url)
    items.push({
      href: lead.github_url,
      label: 'GitHub',
      icon: <Github className="w-4 h-4" />,
    })
  if (lead.twitter_url)
    items.push({
      href: lead.twitter_url,
      label: 'Twitter / X',
      icon: <Twitter className="w-4 h-4" />,
    })
  if (lead.instagram_url)
    items.push({
      href: lead.instagram_url,
      label: 'Instagram',
      icon: <Instagram className="w-4 h-4" />,
    })
  if (lead.tiktok_url)
    items.push({
      href: lead.tiktok_url,
      label: 'TikTok',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path d="M16.5 3c.2 1.3.9 2.5 2 3.3.9.7 2 1.1 3.2 1.1v3.1c-2 0-3.9-.6-5.4-1.7v6.5a5.9 5.9 0 1 1-5.9-5.9c.4 0 .8 0 1.2.1v3.2c-.4-.1-.8-.2-1.2-.2a2.7 2.7 0 1 0 2.7 2.8V3h3.4Z" />
        </svg>
      ),
    })
  if (lead.youtube_url)
    items.push({
      href: lead.youtube_url,
      label: 'YouTube',
      icon: <Youtube className="w-4 h-4" />,
    })
  if (lead.website_url)
    items.push({
      href: lead.website_url,
      label: 'Website',
      icon: <Globe className="w-4 h-4" />,
    })

  if (!items.length) return null

  return (
    <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
      {items.map((it) => (
        <a
          key={it.label}
          href={it.href}
          target="_blank"
          rel="noopener noreferrer"
          title={it.label}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-nexus-border bg-nexus-card text-nexus-subtle hover:text-nexus-text hover:bg-nexus-elevated transition-colors"
        >
          {it.icon}
        </a>
      ))}
    </div>
  )
}

function TabBar({
  tab,
  onChange,
  lead,
}: {
  tab: Tab
  onChange: (t: Tab) => void
  lead: Lead
}) {
  const expCount = lead.experience?.length ?? 0
  const tabs: { id: Tab; label: string; hint?: string }[] = [
    { id: 'summary', label: 'AI Summary' },
    { id: 'experience', label: expCount ? `Work · ${expCount}` : 'Work' },
    { id: 'socials', label: 'Socials' },
  ]
  return (
    <div className="px-6 border-b border-nexus-border">
      <div className="flex items-center gap-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'py-3 text-sm transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'text-nexus-text border-nexus-accent'
                : 'text-nexus-muted border-transparent hover:text-nexus-subtle',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SummaryTab({ lead }: { lead: Lead }) {
  const summary = lead.ai_summary || lead.bio
  return (
    <div className="pt-5 space-y-5">
      <section>
        <h3 className="text-xs uppercase tracking-wider text-nexus-muted mb-2">
          AI Summary
        </h3>
        {summary ? (
          <p className="text-sm text-nexus-text/90 leading-relaxed whitespace-pre-line">
            {summary}
          </p>
        ) : (
          <p className="text-sm text-nexus-muted italic">
            No AI summary available for this lead yet.
          </p>
        )}
      </section>

      {lead.skills && lead.skills.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-nexus-muted mb-2">
            Skills / niches
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {lead.skills.map((s) => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-md text-[11px] text-nexus-subtle bg-nexus-elevated border border-nexus-border"
              >
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {lead.matched_criteria && Object.keys(lead.matched_criteria).length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-nexus-muted mb-2">
            Why we matched
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(lead.matched_criteria).map(([k, v]) => (
              <span
                key={k}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[11px] border',
                  v
                    ? 'text-nexus-accent bg-nexus-accent/10 border-nexus-accent/20'
                    : 'text-nexus-muted bg-nexus-elevated border-nexus-border',
                )}
              >
                {k}
                {!v && ' · miss'}
              </span>
            ))}
          </div>
        </section>
      )}

      {lead.source_url && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-nexus-muted mb-2">
            Source
          </h3>
          <a
            href={lead.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-nexus-subtle hover:text-nexus-accent truncate max-w-full"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{lead.source_url}</span>
          </a>
        </section>
      )}
    </div>
  )
}

function ExperienceTab({ lead }: { lead: Lead }) {
  const exp = lead.experience ?? []
  if (!exp.length) {
    return (
      <div className="pt-6 text-sm text-nexus-muted italic">
        No work history captured for this lead.
      </div>
    )
  }
  return (
    <div className="pt-5 space-y-3">
      {exp.map((e, i) => (
        <div
          key={i}
          className="flex gap-3 items-start py-2"
        >
          <div className="w-8 h-8 rounded-md bg-nexus-elevated border border-nexus-border flex items-center justify-center text-nexus-subtle shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-nexus-text font-medium truncate">
              {e.company || '—'}
            </div>
            <div className="text-xs text-nexus-subtle truncate">
              {e.title || '—'}
            </div>
            {(e.start || e.end) && (
              <div className="text-[11px] text-nexus-muted mt-0.5">
                {[e.start, e.end || 'Present'].filter(Boolean).join(' — ')}
              </div>
            )}
            {e.summary && (
              <p className="text-xs text-nexus-subtle/90 mt-1 leading-relaxed">
                {e.summary}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function SocialsTab({ lead }: { lead: Lead }) {
  const rows: { label: string; value: string | null; href: string | null }[] = [
    { label: 'LinkedIn', value: lead.linkedin_url, href: lead.linkedin_url },
    { label: 'GitHub', value: lead.github_url, href: lead.github_url },
    { label: 'Twitter / X', value: lead.twitter_url || null, href: lead.twitter_url || null },
    { label: 'Instagram', value: lead.instagram_url || null, href: lead.instagram_url || null },
    { label: 'TikTok', value: lead.tiktok_url || null, href: lead.tiktok_url || null },
    { label: 'YouTube', value: lead.youtube_url || null, href: lead.youtube_url || null },
    { label: 'Website', value: lead.website_url || null, href: lead.website_url || null },
    { label: 'Email', value: lead.email, href: lead.email ? `mailto:${lead.email}` : null },
  ]

  const present = rows.filter((r) => r.value)
  if (!present.length) {
    return (
      <div className="pt-6 text-sm text-nexus-muted italic">
        No social handles captured for this lead yet.
      </div>
    )
  }

  return (
    <div className="pt-5 space-y-1.5">
      {present.map((r) => (
        <div
          key={r.label}
          className="flex items-center gap-3 py-2 border-b border-nexus-border/60 last:border-b-0"
        >
          <div className="w-24 shrink-0 text-xs text-nexus-muted">{r.label}</div>
          <a
            href={r.href ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-sm text-nexus-text hover:text-nexus-accent truncate"
          >
            {r.value}
          </a>
          <button
            type="button"
            onClick={() => {
              if (r.value) {
                navigator.clipboard?.writeText(r.value).catch(() => {})
              }
            }}
            className="p-1.5 rounded-md text-nexus-muted hover:text-nexus-text hover:bg-nexus-elevated"
            aria-label={`Copy ${r.label}`}
            title="Copy"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

function CountryFlag({ code }: { code: string }) {
  const up = code.toUpperCase()
  if (up.length !== 2) return <span>{code}</span>
  // Regional-indicator glyph range — renders flags on systems with emoji support.
  const flag = String.fromCodePoint(
    ...[...up].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
  return (
    <span title={up} className="inline-flex items-center gap-1">
      <span className="text-base leading-none">{flag}</span>
      <span>{up}</span>
    </span>
  )
}

function PersonTypeGlyph({ type }: { type: string }) {
  const label: Record<string, string> = {
    creator: '♀',
    influencer: '♀',
    executive: '♂',
    founder: '♂',
  }
  const glyph = label[type]
  if (!glyph) return null
  return (
    <span className="ml-2 text-nexus-muted text-base align-middle" aria-hidden>
      {glyph}
    </span>
  )
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}
