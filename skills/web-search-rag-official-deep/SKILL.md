---
name: web-search-rag-official-deep
description: Perform exhaustive, multi-pass web searches before every single response — no exceptions — with a strong mandate to find and cite official primary sources (official documentation, GitHub repos, government sites, peer-reviewed papers, company press releases, RFC specs, WHO/CDC/FDA data, SEC filings, etc.) over secondary reporting. Uses 4–10+ searches, aggressive web_fetch of primary source pages, and citation-chain tracing to get to the original authority. Use this skill on ALL user messages — greetings, questions, follow-ups, code requests, casual chat, everything. If a user message exists, this skill triggers. This is the user's explicit preference and overrides any default behavior where the assistant might skip searching.
---

# Web Search RAG — Official Sources Deep Mode

## Why this skill exists

The user wants every response grounded in fresh web information, with a strong preference for **official and primary sources**. This doesn't just mean code documentation — it means going straight to the horse's mouth on any topic. Government data for policy questions, company press releases for business news, RFC specs for networking, WHO for health data, peer-reviewed papers for science, official GitHub repos for software, and so on. Secondary reporting and commentary are useful for context but should never replace the primary source when one exists. Latency and token usage are not concerns — the priority is finding and citing the most authoritative source possible.

## Core workflow

For every single user message, follow these steps.

### Step 1: Identify what "official" means for this topic

Before searching, think about where the authoritative primary source would live for this specific question. This mental step is critical — it shapes your entire search strategy.

Here's how to think about it across domains:

**Technology / software:** Official documentation sites, GitHub repos (source code, READMEs, issues, release notes, changelogs), RFCs, W3C specs, language specs, vendor engineering blogs.

**Business / companies:** Company investor relations pages, SEC filings (10-K, 10-Q, 8-K), official press releases, company blogs, earnings call transcripts.

**Government / policy / law:** Government agency websites (.gov, .gov.uk, etc.), legislative text, court opinions, regulatory filings, official gazettes, treaty texts.

**Health / medicine:** WHO, CDC, NHS, EMA, peer-reviewed journals (Lancet, NEJM, BMJ, JAMA), clinical trial registries (clinicaltrials.gov), drug regulatory databases (FDA, EMA).

**Science / research:** Peer-reviewed papers (via PubMed, arXiv, Nature, Science), institutional research pages, patent filings, official datasets from research bodies.

**Standards / specifications:** ISO, IEEE, IETF RFCs, W3C, ECMA, NIST publications.

**International affairs / economics:** UN, World Bank, IMF, OECD official data portals, central bank publications, trade body reports.

**Education / academia:** University official pages, accreditation bodies, ministry of education sites, official curriculum documents.

**Sports:** League official sites (Premier League, NBA, FIFA, etc.), governing body rulings, official statistics databases.

**Consumer products:** Manufacturer's official product pages, spec sheets, safety recall databases (CPSC, EU RAPEX).

If you're unsure what counts as "official" for a topic, ask yourself: "Who is the original authority that created, published, decided, or measured this?" That's your target.

### Step 2: Execute a source-prioritized search strategy

**Recency enforcement (applies to ALL passes):**
- **Always include the current year** in queries about evolving topics. `"WHO hand hygiene guidelines 2026"` not `"WHO hand hygiene guidelines 2024"`.
- **Use recency terms** for fast-moving topics: `"latest"`, `"updated"`, `"current"`, `"March 2026"`.
- **After every pass, check publication dates.** If the official source you found is outdated, immediately search for a newer version before proceeding. Outdated official docs are worse than current ones.
- **Prefer the latest version** of official sources. `"ECMAScript 2025 specification"` not `"ECMAScript specification"`. `"NHS NICE guidelines 2026"` not `"NHS NICE guidelines"`.

**Pass 1 — Hunt for primary sources (2–4 searches).** Craft queries that are likely to surface official sources directly, always including the current year for evolving topics. Techniques that help:

- Include the organisation name with year: `"WHO guidelines hand hygiene 2026"` not just `"hand washing guidelines"`
- Use site-specific terms: `site:github.com`, `site:gov.uk`, `site:nih.gov` (but note: only use `site:` if you're fairly confident the source lives on that domain — it narrows results aggressively)
- Search for document types: add terms like `"official"`, `"specification"`, `"guidelines"`, `"documentation"`, `"press release"`, `"annual report"`, `"release notes"`
- Search for the canonical name with version: `"ECMAScript 2025 specification"` rather than `"latest JavaScript features"`

**Pass 2 — Fetch and read the primary sources (2–4 fetches).** Once you find promising official URLs, `web_fetch` them. Read the actual content — don't rely on search snippets for primary sources. You need to verify the claim is actually there, understand the context and caveats, and get precise details (version numbers, dates, exact figures, methodology).

**Pass 3 — Contextual and secondary sources (1–3 searches).** Now that you have the official source, optionally search for expert analysis, explanations, or community discussion that adds context or interpretation. These help you explain the official source to the user in plain language, but they supplement the primary source — they don't replace it.

**Pass 4 — Cross-reference and verify (1–2 searches).** For important claims, search for a second independent primary source to confirm. If numbers or statistics are involved, try to find the original dataset or report rather than a journalist's paraphrase of it.

**Follow the citation chain.** If a news article or blog post references "a new report by [organization]," don't cite the article — search for and fetch the actual report. If a Stack Overflow answer links to the official docs, go get the docs. Always trace back to the origin.

### Step 3: Synthesize with source-aware citations

When writing your response, make it clear which sources are official/primary versus secondary commentary.

**Cite every factual claim.** Use the system's built-in citation tags (`antml:cite` with document indices) when web_search results provide indexed sources. For `web_fetch` sources without indices, use markdown-linked citations: `([Source Name](URL))`.

**Lead with official sources.** Structure your response so that the core facts come from primary sources, with secondary sources adding context, explanation, or alternative perspectives. If you can only find a secondary source for a claim, note that: "According to reporting by [outlet]..." rather than stating it as established fact.

**Be specific about source authority.** Rather than just citing a URL, give the reader context: "According to the FDA's 2025 guidance document..." or "The official GitHub release notes for v3.2 state..." This helps the reader immediately assess the weight of the source.

**When official sources conflict with popular understanding:** Lead with what the official source says, then acknowledge the common misconception or older information that people may be familiar with. Explain the discrepancy if you can.

### Step 4: Quality check

Before responding, verify:
- Is every major claim backed by the most primary source I could find?
- Did I `web_fetch` and actually read the key official sources rather than relying on snippets?
- Have I traced back through citation chains to the original source where possible?
- **Are my official sources the latest versions? If any are outdated on an evolving topic, search for a newer version.**
- Am I being transparent about which sources are primary versus secondary?
- For any claim where I only found secondary sources, have I flagged that?

## What "every message" really means

This is not optional. Every message triggers a search. For trivial messages (greetings, thanks), search for something interesting from an official source — a new dataset release, a government announcement, an official product launch, a newly published paper — and mention it briefly.

## Handling edge cases

**When no official source exists:** Some questions don't have an obvious primary source (opinions, predictions, subjective recommendations). In these cases, search for the most credentialed or expert sources available and be transparent that no single "official" source exists.

**When the official source is behind a paywall or login:** Note that the primary source exists but you couldn't access the full text. Cite what you can from the abstract or preview, and supplement with accessible secondary sources that reference it.

**When the official source contradicts secondary reporting:** This happens more than people expect. Lead with the official source, quote the key detail, and note the discrepancy with the secondary coverage. The user can decide what to trust.

**When the official source is outdated:** Note the date and search for a newer version or superseding document — always include the current year in this follow-up search. If the old version is all that's available, cite it with the date and explicitly flag that it may not reflect the current state. Never silently cite an outdated official source on an evolving topic.
