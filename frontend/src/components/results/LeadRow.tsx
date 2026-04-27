import {
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  Twitter,
  Youtube,
} from 'lucide-react'
import { useSearchStore } from '@/stores/searchStore'
import { useUIStore } from '@/stores/uiStore'
import type { Lead } from '@/types'
import { MatchBadge } from './MatchBadge'
import { ActionMenu } from './ActionMenu'
import { dynamicColMaxClass } from './dynamicColLayout'
import type { DynamicCol } from './ResultsTable'

interface Props {
  lead: Lead
  rank: number
  dynamicCols: DynamicCol[]
}

/** One row in the results table — compact, single accent color. */
export function LeadRow({ lead, rank, dynamicCols }: Props) {
  const selected = useSearchStore((s) => s.selectedLeadIds.has(lead.id))
  const toggle = useSearchStore((s) => s.toggleLead)
  const openProfile = useUIStore((s) => s.openProfile)

  return (
    <tr className="border-b border-nexus-border/70 hover:bg-nexus-elevated/60 transition-colors">
      <td className="px-4 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggle(lead.id)}
          className="accent-nexus-accent cursor-pointer"
          aria-label={`Select ${lead.name ?? 'lead'}`}
        />
      </td>
      <td className="px-2 py-2.5 text-nexus-muted text-[11px] font-mono text-right w-8">
        {rank}
      </td>
      <td className="px-3 py-2.5 min-w-0 max-w-[14rem]">
        <button
          type="button"
          onClick={() => openProfile(lead.id)}
          className="flex items-center gap-2.5 min-w-0 text-left w-full group"
          title={
            [lead.name, lead.headline || lead.title].filter(Boolean).join(' — ') ||
            'Open profile'
          }
        >
          <Avatar name={lead.name} src={lead.avatar_url} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-nexus-text truncate group-hover:text-nexus-accent transition-colors">
              {lead.name || '—'}
            </div>
            {(lead.headline || lead.title) && (
              <div className="text-[11px] text-nexus-muted truncate" title={lead.headline || lead.title || undefined}>
                {lead.headline || lead.title}
              </div>
            )}
            {lead.source_query && (
              <div className="text-[10px] text-nexus-subtle/90 truncate mt-0.5" title={lead.source_query}>
                From: {lead.source_query}
              </div>
            )}
          </div>
        </button>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {lead.linkedin_url && (
            <SocialPill href={lead.linkedin_url} label="LinkedIn" tone="sky">
              <Linkedin className="w-3 h-3" />
            </SocialPill>
          )}
          {lead.github_url && (
            <SocialPill href={lead.github_url} label="GitHub" tone="neutral">
              <Github className="w-3 h-3" />
            </SocialPill>
          )}
          {lead.twitter_url && (
            <SocialPill href={lead.twitter_url} label="Twitter / X" tone="neutral">
              <Twitter className="w-3 h-3" />
            </SocialPill>
          )}
          {lead.instagram_url && (
            <SocialPill
              href={lead.instagram_url}
              label="Instagram"
              tone="rose"
            >
              <Instagram className="w-3 h-3" />
            </SocialPill>
          )}
          {lead.tiktok_url && (
            <SocialPill href={lead.tiktok_url} label="TikTok" tone="neutral">
              <TikTokIcon />
            </SocialPill>
          )}
          {lead.youtube_url && (
            <SocialPill href={lead.youtube_url} label="YouTube" tone="red">
              <Youtube className="w-3 h-3" />
            </SocialPill>
          )}
          {lead.website_url && (
            <SocialPill href={lead.website_url} label="Website" tone="neutral">
              <Globe className="w-3 h-3" />
            </SocialPill>
          )}
          {!lead.linkedin_url &&
            !lead.github_url &&
            !lead.twitter_url &&
            !lead.instagram_url &&
            !lead.tiktok_url &&
            !lead.youtube_url &&
            !lead.website_url && (
              <span className="text-nexus-muted text-xs">—</span>
            )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <MatchBadge status={lead.match_status} score={lead.match_score} />
      </td>
      {dynamicCols.map((c) => {
        const raw = c.get(lead)
        const text = raw == null || raw === '' ? null : String(raw)
        const mw = dynamicColMaxClass(c.key)
        return (
          <td
            key={c.key}
            className={`px-3 py-2.5 text-[12px] text-nexus-subtle overflow-hidden ${mw}`}
          >
            {text == null ? (
              <span className="text-nexus-muted">—</span>
            ) : (
              <span className="block truncate" title={text}>
                {text}
              </span>
            )}
          </td>
        )
      })}
      <td className="px-3 py-2.5 max-w-[11rem] min-w-0 overflow-hidden">
        {lead.email ? (
          <a
            href={`mailto:${lead.email}`}
            className="text-[12px] text-nexus-text block truncate hover:text-nexus-accent transition-colors"
            title={lead.email}
          >
            {lead.email}
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] text-nexus-muted
                       px-2 py-0.5 rounded-md border border-nexus-border/70 bg-nexus-elevated/50"
          >
            <Mail className="w-3 h-3" />
            Check
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <ActionMenu lead={lead} />
      </td>
    </tr>
  )
}

function Avatar({
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
        className="w-7 h-7 rounded-full object-cover border border-nexus-border shrink-0"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }

  const palette = [
    'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    'bg-sky-500/15 text-sky-400 border-sky-500/20',
    'bg-amber-500/15 text-amber-400 border-amber-500/20',
    'bg-rose-500/15 text-rose-300 border-rose-500/20',
    'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  ]
  const seed = (name || '?')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0)
  const cls = palette[seed % palette.length]
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center
                  text-[10px] font-semibold shrink-0 border ${cls}`}
    >
      {initials || '?'}
    </div>
  )
}

type Tone = 'sky' | 'neutral' | 'rose' | 'red'

function SocialPill({
  href,
  label,
  tone,
  children,
}: {
  href: string
  label: string
  tone: Tone
  children: React.ReactNode
}) {
  const tones: Record<Tone, string> = {
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20',
    neutral:
      'bg-nexus-elevated text-nexus-subtle border-nexus-border hover:bg-nexus-elevated/70 hover:text-nexus-text',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open ${label}`}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${tones[tone]}`}
    >
      {children}
    </a>
  )
}

function TikTokIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-3 h-3"
      aria-hidden="true"
    >
      <path d="M16.5 3c.2 1.3.9 2.5 2 3.3.9.7 2 1.1 3.2 1.1v3.1c-2 0-3.9-.6-5.4-1.7v6.5a5.9 5.9 0 1 1-5.9-5.9c.4 0 .8 0 1.2.1v3.2c-.4-.1-.8-.2-1.2-.2a2.7 2.7 0 1 0 2.7 2.8V3h3.4Z" />
    </svg>
  )
}
