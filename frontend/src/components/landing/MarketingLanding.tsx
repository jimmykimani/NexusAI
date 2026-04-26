import { ArrowRight, BarChart3, CheckCircle2, Mail, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { SignInButton, SignUpButton } from '@clerk/clerk-react'

export function MarketingLanding() {
  return (
    <div className="marketing-landing min-h-screen overflow-y-auto bg-nexus-bg text-nexus-text">
      <div className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.7),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.6),rgba(248,250,252,0.05))]" />
        {/* Soft pastel wash — light, airy */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(72vh,640px)]
                     bg-[radial-gradient(ellipse_55%_45%_at_12%_-8%,rgba(251,207,232,0.55),transparent_52%),
                          radial-gradient(ellipse_50%_42%_at_88%_4%,rgba(219,234,254,0.65),transparent_50%),
                          radial-gradient(ellipse_45%_38%_at_52%_18%,rgba(254,243,199,0.45),transparent_48%)]"
        />
        <section className="relative mx-auto flex max-w-[1080px] flex-col gap-14 px-5 pb-24 pt-8 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between rounded-full border border-nexus-border bg-white/82 px-5 py-3 shadow-[0_18px_60px_-32px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:bg-nexus-card/75">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-nexus-accent/10 text-nexus-accent ring-1 ring-nexus-accent/10">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold">NexusAI</div>
                <div className="text-xs text-nexus-muted">AI people search and outreach engine</div>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <SignInButton mode="modal">
                <button type="button" className="btn-ghost">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button type="button" className="btn-primary">
                  Start for free
                </button>
              </SignUpButton>
            </div>
          </header>

          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div className="mx-auto flex w-full max-w-[36rem] flex-col items-center text-center lg:items-start lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-nexus-border bg-nexus-card px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-nexus-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-nexus-accent" strokeWidth={2} />
                Search, score, verify, outreach
              </div>

              <h1 className="mt-8 font-display text-[2.125rem] font-semibold leading-[1.12] tracking-tight text-nexus-text sm:text-5xl sm:leading-[1.1] md:text-[3.15rem] md:leading-[1.06]">
                Find <span className="italic font-medium text-nexus-accent">anyone</span>.
                <br />
                Write to <span className="italic font-medium text-nexus-text">everyone</span>.
              </h1>

              <p className="mt-6 max-w-xl text-[15px] leading-7 text-nexus-muted sm:text-base sm:leading-8">
                NexusAI turns natural-language people search into a live pipeline: the system plans the hunt,
                searches the web, ranks results, flags weak facts, and prepares outreach you can scan in
                seconds.
              </p>

              <div className="mt-11 grid w-full max-w-xl gap-4 sm:grid-cols-2 sm:text-left">
                <div className="rounded-2xl border border-nexus-border bg-nexus-card p-5 sm:p-6">
                  <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-nexus-border bg-nexus-elevated text-nexus-accent sm:mx-0">
                    <Search className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-nexus-text sm:text-[1.75rem]">100+</div>
                  <p className="mt-2 text-sm leading-relaxed text-nexus-muted">
                    Signals blended across search, social, profiles, and personal sites.
                  </p>
                </div>
                <div className="rounded-2xl border border-nexus-border bg-nexus-card p-5 sm:p-6">
                  <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-nexus-border bg-nexus-elevated text-sky-700 sm:mx-0">
                    <BarChart3 className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-nexus-text sm:text-[1.75rem]">Live</div>
                  <p className="mt-2 text-sm leading-relaxed text-nexus-muted">
                    Narration, pipeline metrics, evals, and faithfulness review in one workspace.
                  </p>
                </div>
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <SignUpButton mode="modal">
                  <button type="button" className="btn-primary px-7 py-2.5 text-[0.9375rem]">
                    Start for free
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button type="button" className="btn-primary-dark px-7 py-2.5 text-[0.9375rem]">
                    Sign in
                  </button>
                </SignInButton>
              </div>
            </div>

            {/* Product preview — mirror the app with a larger card stack */}
            <div className="relative w-full">
              <div
                aria-hidden
                className="absolute -inset-8 rounded-[2rem] bg-[radial-gradient(circle_at_16%_18%,rgba(34,197,94,0.16),transparent_26%),radial-gradient(circle_at_84%_12%,rgba(59,130,246,0.14),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(244,114,182,0.12),transparent_28%)] blur-2xl"
              />
              <div className="relative rounded-[2rem] border border-nexus-border bg-white/80 p-5 shadow-[0_32px_100px_-44px_rgba(15,23,42,0.32)] backdrop-blur-2xl dark:bg-nexus-card/70">
                <div className="flex items-center justify-between border-b border-nexus-border/70 px-1 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-nexus-muted">Example search</p>
                    <p className="mt-1 text-sm text-nexus-subtle">Find codex engineers in Nairobi</p>
                  </div>
                  <span className="rounded-full border border-nexus-accent/20 bg-nexus-accent/10 px-3 py-1 text-[11px] font-semibold text-nexus-accent">
                    The Hunt
                  </span>
                </div>

                <div className="mt-5 rounded-[1.35rem] border border-nexus-border bg-nexus-bg/70 px-5 py-4 shadow-sm">
                  <p className="text-left text-[0.975rem] leading-relaxed text-nexus-text">
                    Find <span className="font-medium text-nexus-accent">Codex engineers</span> in{' '}
                    <span className="font-medium text-nexus-accent">Nairobi</span> who are active in{' '}
                    <span className="font-medium text-nexus-accent">AI tooling</span> and open source.
                  </p>
                </div>

                <div className="mt-5 rounded-[1.35rem] border border-nexus-border bg-nexus-card p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="font-medium text-nexus-text">Supervisor → Search → Ranking</span>
                    <span className="text-xs text-nexus-muted">live</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      ['David Muna', 'DM', '98%', 'Verified fit, strong role and location signals'],
                      ['Isaak Kamau', 'IK', '95%', 'Partial match, good title coverage'],
                      ['Mashel O.', 'MO', '90%', 'Needs review on company/location'],
                    ].map(([name, initials, score, text]) => (
                      <div
                        key={name}
                        className="flex items-center gap-3 rounded-2xl border border-nexus-border bg-nexus-surface px-3.5 py-3"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-nexus-border bg-nexus-elevated text-[11px] font-semibold text-nexus-subtle">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-nexus-text">{name}</span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                              {score}
                            </span>
                          </div>
                          <div className="mt-0.5 line-clamp-1 text-xs text-nexus-muted">{text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <main className="mx-auto max-w-5xl px-5 pb-28 sm:px-8 lg:px-10">
        <section className="grid gap-6 border-t border-nexus-border py-20 md:grid-cols-3 md:gap-8">
          {[
            {
              icon: Search,
              title: 'Natural language search',
              body: 'Describe who you want in plain English. NexusAI translates intent into a targeted search plan automatically.',
            },
            {
              icon: ShieldCheck,
              title: 'Hallucination review',
              body: 'Weakly supported fields are marked for review so you can trust what you export.',
            },
            {
              icon: Mail,
              title: 'Outreach-ready workflows',
              body: 'Move from discovery to ranked leads to email composition without leaving the workspace.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-nexus-border bg-nexus-card px-5 py-6 transition-colors hover:border-nexus-text/15"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-nexus-border bg-nexus-elevated text-nexus-subtle">
                <item.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-nexus-text">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-nexus-muted">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-12 py-6 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-16">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-nexus-muted">How it works</div>
            <h2 className="mt-4 max-w-[14ch] text-3xl font-semibold leading-tight tracking-tight text-nexus-text sm:text-4xl">
              A search engine that shows its work.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-nexus-muted">
              Built for demos and testers: watch the plan form, see the pipeline run, inspect match logic, and open
              raw logs when something looks off.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              'Supervisor decomposes the request into criteria and web search angles.',
              'Search fans out across open-web and directory sources, then deduplicates candidates.',
              'Ranking scores results, groups by strength, and exposes why a row matched.',
              'Faithfulness checks flag fields that need manual review before outreach.',
            ].map((line, index) => (
              <div
                key={line}
                className="flex items-start gap-3 rounded-2xl border border-nexus-border bg-nexus-card px-4 py-3.5 sm:px-5 sm:py-4"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-nexus-accent/20 bg-nexus-accent/10 text-xs font-bold text-nexus-accent">
                  {index + 1}
                </div>
                <p className="text-sm leading-7 text-nexus-subtle">{line}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-14">
          <div className="mb-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-nexus-muted">Use cases</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Talent', 'Find engineers, researchers, or operators by role, company history, location, and skills.'],
              ['Creators', 'Source TikTok, Instagram, YouTube, and newsletter creators with audience and niche signals.'],
              ['Clients', 'Discover buyers, founders, or revenue leaders who match your ICP and growth stage.'],
              ['Partners', 'Map podcast hosts, agencies, event organizers, and ecosystem operators worth contacting.'],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded-2xl border border-nexus-border bg-nexus-card p-5 sm:p-6 transition-colors hover:border-nexus-text/12"
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-nexus-text">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-nexus-accent" strokeWidth={2} />
                  {title}
                </div>
                <p className="text-sm leading-relaxed text-nexus-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-6">
          <div className="rounded-[1.75rem] border border-nexus-border bg-gradient-to-br from-nexus-card via-nexus-card to-nexus-elevated/40 px-6 py-10 sm:px-10 sm:py-12">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-nexus-muted">Get started</div>
            <h2 className="mt-4 max-w-[16ch] text-3xl font-semibold leading-tight tracking-tight text-nexus-text sm:text-4xl">
              Put the workspace in front of testers with context built in.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-nexus-muted">
              Sign in when you are ready — the full workspace, search pipeline, and demo tools are one click away once
              you land inside the app.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <SignUpButton mode="modal">
                <button type="button" className="btn-primary px-7 py-2.5">
                  Start for free
                </button>
              </SignUpButton>
              <SignInButton mode="modal">
                <button type="button" className="btn-primary-dark px-7 py-2.5">
                  Sign in
                </button>
              </SignInButton>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
