---
name: web-research
description: Perform targeted or multi-pass web research with inline citations and primary-source priority. Use only when the user explicitly invokes web-research or explicitly requests web research.
---

# Web Research

Scope this workflow strictly to the requested research task. Do not run web searches for unrelated turns or non-research messages.

## Depth And Source Modes

Choose depth and source strategy to match the user's request:

- **Quick (default):** 1–3 targeted searches for a focused lookup. Fetch full pages only when snippets are too thin to verify accurately.
- **Deep (when exhaustive research is requested):** Run iterative passes — Pass 1 broad discovery (1–3 searches), Pass 2 targeted deep-dives on sub-questions and counterarguments (2–5 searches), Pass 3 verification and gap-filling (1–3 searches). Read key pages in full when your active fetch/browser tools allow it.
- **Official / primary-source priority (default for technical, regulatory, policy, or version-sensitive questions, or when explicitly requested):** Target the original authority first — official documentation, specifications/RFCs, release notes, source repositories, government or standards publications, peer-reviewed papers, or primary filings. Trace citation chains back to the origin rather than stopping at secondary commentary.

## Recency And Verification

- Include the current year or exact version number in queries about evolving topics.
- Check publication dates on results; if top results are stale on a fast-moving topic, re-search with explicit recency qualifiers.
- Prefer newer sources within the same authority tier.
- Cross-check critical factual claims across independent sources in deep mode, and surface contradictions transparently rather than silently choosing one side.

## Citation Rules

- Use your active tool's web search / page-fetch capabilities and place inline markdown citations `([Source Name](URL))` immediately after the claims they support.
- Distinguish primary/official sources from secondary reporting in your phrasing (for example, *"According to the official release notes..."* vs *"Secondary coverage reports..."*).
- If a claim cannot be verified from a retrieved source, mark it explicitly as *(unsourced — general knowledge)* or state the gap.
- Avoid citing content farms, SEO listicles, or unverified forums when authoritative sources exist.
