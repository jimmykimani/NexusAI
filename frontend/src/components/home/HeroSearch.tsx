import { ArrowUp, Briefcase, Loader2, Megaphone, TrendingUp, Users } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useSearch } from '@/hooks/useSearch'

type ExampleChip = {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  text: string
}

const EXAMPLES: ExampleChip[] = [
  {
    id: 'clients',
    icon: Briefcase,
    label: 'Clients',
    text: 'Find suitable European customers for harvey.ai, prioritizing the UK and France',
  },
  {
    id: 'experts',
    icon: Users,
    label: 'Experts',
    text: 'Product managers who previously worked at Microsoft, Meta, or Google and are now at AI companies',
  },
  {
    id: 'influencers',
    icon: Megaphone,
    label: 'Influencers',
    text: 'TikTok beauty creators in the U.S. with more than 100K followers who post makeup tutorials',
  },
  {
    id: 'partners',
    icon: TrendingUp,
    label: 'Partners',
    text: 'North American pet supplies distributors for premium organic brands',
  },
]

/** Landing hero: serif-italic flourish, minimalist search, subtle example chips. */
export function HeroSearch() {
  const { query, setQuery, isSearching, submit } = useSearch()

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isSearching && query.trim()) void submit()
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-nexus-bg relative overflow-hidden">
      {/* very subtle ambient glow, no purple */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[320px] pointer-events-none
                   bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.08),transparent_60%)]"
      />

      <div className="w-full max-w-2xl relative">
        <p className="text-center text-xs uppercase tracking-[0.22em] text-nexus-muted mb-4">
          AI people search engine
        </p>
        <h1 className="text-center text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] mb-10">
          Find <span className="serif-italic text-nexus-accent">anyone</span>.
          <br />
          Write to <span className="serif-italic">everyone</span>.
        </h1>

        <div
          className="rounded-2xl bg-nexus-card border border-nexus-border
                     shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]
                     focus-within:border-nexus-accent/40 transition-colors"
        >
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isSearching}
            placeholder="Describe who you're looking for — role, company, location, signals…"
            rows={3}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-2
                       border-0 focus:outline-none focus:ring-0
                       text-[15px] placeholder:text-nexus-muted leading-relaxed min-h-[5.5rem]"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-3">
            <span className="text-xs text-nexus-muted px-2">
              {isSearching ? 'Running agents…' : 'Enter to search · Shift+Enter for newline'}
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={isSearching || !query.trim()}
              className="btn-primary py-2 px-5"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  Find
                  <ArrowUp className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EXAMPLES.map((ex) => {
            const Icon = ex.icon
            return (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => setQuery(ex.text)}
                  className="group w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl
                             bg-nexus-elevated/40 hover:bg-nexus-elevated
                             border border-nexus-border/70 hover:border-nexus-border
                             transition-colors"
                >
                  <span className="mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-lg
                                   bg-nexus-elevated border border-nexus-border text-nexus-subtle
                                   group-hover:text-nexus-accent transition-colors shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs uppercase tracking-wider text-nexus-muted mb-0.5">
                      {ex.label}
                    </span>
                    <span className="block text-[13px] text-nexus-text/90 leading-snug line-clamp-2">
                      {ex.text}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <p className="mt-10 text-center text-xs text-nexus-muted">
          Scans LinkedIn, GitHub, personal sites and more. Ranks by match score.
        </p>
      </div>
    </div>
  )
}
