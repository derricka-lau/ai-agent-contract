---
name: web-search-rag-quick
description: Perform fast, lean web research with concise citations. Use only when the user explicitly invokes web-search-rag-quick or explicitly requests a quick web lookup.
---

# Web Search RAG — Always Search, Always Cite (Quick Mode)

## Why this skill exists

The user wants every response grounded in fresh web information. This is the **fast variant** — search on every message without exception, cite what you find, but keep the research tight and efficient. One or two well-chosen searches, not a deep investigation.

## Core rules

1. **Always search first.** No message gets a response without at least one `web_search` call. No exceptions — greetings, follow-ups, code questions, everything.
2. **Cite every factual claim.** Use the system's built-in citation tags (`antml:cite`) when search indices are available. Fall back to markdown links `([Source](URL))` for `web_fetch` sources.
3. **Keep it lean.** 1–2 searches for simple queries. 2–3 for moderate ones. Only go beyond 3 if the question genuinely demands it. Skip `web_fetch` unless a snippet is too vague to cite confidently.

## Recency enforcement

Fresh results don't happen by accident — you must actively force them:

- **Append the current year** to any query about an evolving topic. `"CakePHP authentication 2026"` not `"CakePHP authentication"`.
- **Use recency terms** for fast-moving topics: `"latest"`, `"new"`, `"updated"`, `"March 2026"`.
- **Check publication dates** on results. If the top results are 6+ months old on a current topic, immediately re-search with a year or date qualifier — this counts as your second search, not a waste.
- **Prefer recent over old** when two sources have similar authority. A 2026 blog post from a core maintainer beats a 2023 official doc if the API has changed.

Example: `"Python 3.13 new features 2026"` not `"Python new features"`. `"NHS diabetes guidelines latest update"` not `"NHS diabetes guidelines"`.

## Search guidance by query type

**Factual questions:** One targeted search with the current year if relevant, cite the best result. A second search only if the first didn't surface a strong primary source or results are stale.

**Technical / code:** One search for official docs with version or year qualifier. Cite it, then write your response.

**News / current events:** One search for the event with date terms. If the top results are hours old, one more to check for updates.

**Opinions / recommendations:** One search for expert reviews or comparisons, preferring recent results. Synthesise briefly.

**Greetings / trivial messages:** One search for a trending topic or "today in history" fact. Mention it briefly and naturally — don't force it.

## Citation rules

Place citations inline, right after the claim they support. Prefer authoritative sources (official docs, major outlets, government data) over blogs and forums. If you can't source a claim, mark it: *(unsourced — general knowledge)*.

## What not to do

Don't run 5+ searches for a simple factual question. Don't `web_fetch` every result. Don't write a research report when the user asked a yes/no question. Match your response depth to the question's complexity — but always search first.
