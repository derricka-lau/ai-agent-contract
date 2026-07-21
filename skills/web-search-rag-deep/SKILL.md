---
name: web-search-rag-deep
description: Perform exhaustive, multi-pass web research with citations. Use only when the user explicitly invokes web-search-rag-deep or explicitly requests exhaustive web research where depth matters more than latency and token cost.
---

# Web Search RAG — Always Search, Always Cite, Maximum Depth

## Why this skill exists

The user wants every response grounded in fresh, real-world information — not training data alone. The goal is maximum factual reliability and transparency, where every claim is traceable to a source. Latency and token usage are explicitly not concerns — the priority is response quality above all else. This means doing as many searches and page fetches as needed to give the best, most well-rounded, most accurate answer possible.

## Core workflow

For every single user message, follow these steps in order.

### Step 1: Plan your research

Before searching, spend a moment thinking about what information would produce the best possible response. Consider:

- What are the core factual claims the response will need to make?
- What are the different angles or perspectives worth covering?
- What primary/authoritative sources would be ideal to find?
- Are there sub-questions embedded in the main question that each deserve their own search?

For complex or multi-faceted questions, mentally outline 3–8 distinct search queries that approach the topic from different angles. For simpler questions, 1–3 targeted queries may suffice — but err on the side of more searches, not fewer.

### Step 2: Execute a multi-pass search strategy

This is the heart of the skill. The user has explicitly opted out of efficiency concerns, so go deep.

**Recency enforcement (applies to ALL passes):**
- **Always include the current year** in queries about evolving topics. `"React Server Components 2026"` not `"React Server Components"`.
- **Use recency terms** for fast-moving topics: `"latest"`, `"new"`, `"updated"`, `"March 2026"`.
- **After every pass, check publication dates.** If the top results are 6+ months old on a current topic, immediately re-search with explicit date qualifiers before moving to the next pass. Do not carry stale sources forward.
- **Prefer recent sources** when ranking results of similar authority. A 2026 article from a domain expert beats a 2023 article from the same expert if the topic has evolved.

**Pass 1 — Broad discovery (1–3 searches):** Start with the most direct queries for the core topic, including the current year for evolving topics. Scan the results for key themes, terminology, source quality, and **publication dates**.

**Pass 2 — Targeted deep-dives (2–5 searches):** Based on what Pass 1 revealed, search for specific sub-topics, named entities, technical details, statistics, or counterarguments that surfaced. Use more specific and refined queries now that you know the landscape. If Pass 1 results were stale, front-load date qualifiers here.

**Pass 3 — Verification and gap-filling (1–3 searches):** Search for anything that seems under-supported, contradictory, or that you want to cross-reference. Look for primary sources (official reports, documentation, government data, peer-reviewed papers) to replace or supplement secondary sources. Also use this pass to find more recent versions of any older sources cited in earlier passes.

**Use `web_fetch` aggressively.** Search result snippets are often too brief to fully understand a source's claims. After searching, `web_fetch` the most promising URLs to read the full content. This is especially important for:
- News articles where the headline and snippet don't tell the full story
- Technical documentation where you need precise details
- Reports or studies where methodology and caveats matter
- Any source you plan to cite heavily — read it first

**Iterative refinement is encouraged.** If reading a full article reveals new terminology, names, or concepts you didn't know to search for initially, run additional searches. Follow the information trail wherever it leads.

#### Search strategy by query type

**Factual / informational queries:** Aim for 5–10 total searches. Prioritize primary sources. Cross-reference key claims across at least 2 independent sources. Fetch full articles for the top 2–3 most authoritative results.

**Current events / news:** Search for the specific event, then search for reaction, analysis, and context separately. Fetch at least 2 full articles from different outlets to get a multi-perspective view. Check for the most recent developments — news moves fast.

**Technical / code questions:** Search official documentation first, then community sources (Stack Overflow, GitHub issues, blog posts). Fetch the relevant documentation pages in full. Search for known issues, gotchas, or recent changes to the API/library/tool in question. Check version-specific details if relevant.

**Opinions / recommendations / "best of" queries:** Search for expert reviews, comparison articles, and community discussions. Fetch multiple perspectives. Search specifically for dissenting views or criticisms of popular options to give a balanced picture.

**Historical / established knowledge:** Even for well-known topics, search to verify details and find the most up-to-date framing. Historical understanding evolves — new research may have changed the consensus since training data was collected.

**Creative requests:** Search for relevant background, current trends, style references, and similar works. This grounds creative output in real-world context and ensures contemporary relevance.

**Greetings / small talk / trivial messages:** Search for something genuinely interesting — a trending story, a "today in history" event, a recent scientific discovery, or a notable cultural moment. Pick something surprising or delightful, not just the top headline. Weave it in naturally.

### Step 3: Synthesize and cite

Once research is complete, write your response. The quality standard here is high — think of yourself as a well-resourced journalist or analyst who has done thorough homework.

**Synthesis over summarization.** Don't just restate what each source says sequentially. Combine insights across sources into a coherent narrative. Draw connections. Identify patterns. Highlight where sources agree and where they diverge.

**Cite every factual claim.** Every factual statement in your response must have an inline citation. Use the system's built-in citation mechanism (antml:cite tags with document indices) when web_search results provide indexed sources — this is the preferred method since it renders linked citations automatically. When referencing information from `web_fetch` results or sources without search indices, use markdown-linked citations as a fallback: `([Source Name](URL))`.

**Citation placement rules:**
- Place citations immediately after the claim they support, not at the end of paragraphs
- If multiple sources support the same claim, cite the most authoritative one (or two if they're both strong)
- If you can't find a source for a claim, flag it explicitly: *(unsourced — based on general knowledge)*
- For code, cite the documentation at the point where the pattern is introduced

**Handle contradictions transparently.** When sources disagree, say so. Present the competing claims with their respective sources and, if possible, explain why the disagreement exists (different methodologies, different time periods, different definitions, etc.). Don't silently pick one side.

**Acknowledge uncertainty.** If search results are sparse, low-quality, or contradictory, be transparent about the limitations. The user values honesty over false confidence.

### Step 4: Quality check before responding

Before finalising your response, mentally verify:
- Does every factual claim have a citation?
- Have I cross-referenced the most important claims against multiple sources?
- Am I using the most authoritative and recent sources available?
- **Are any of my key sources older than 12 months on an evolving topic? If so, search again with date qualifiers.**
- Have I been transparent about any contradictions or limitations in the evidence?
- Is the response actually better than what I could have produced from training data alone? (If not, search more.)

## What "every message" really means

This is not optional or conditional. The user has explicitly requested this behavior on every message. That includes simple greetings, thank-yous, follow-up questions, code requests, creative writing, opinions, recommendations, and literally anything else. For trivial messages where a full research-backed essay would feel excessive, keep the search-informed content lighter — but the search still happens, and at least one interesting, cited piece of information makes it into the response.

## Source quality hierarchy

When multiple sources are available, prefer them in roughly this order:

1. **Primary sources** — official documentation, government data, peer-reviewed research, court records, original announcements, SEC filings
2. **Authoritative secondary sources** — established news organisations (Reuters, AP, major national papers), specialist publications, encyclopaedia entries
3. **Expert analysis** — think tanks, research institutions, domain-specific analysts with named credentials
4. **High-quality community sources** — well-maintained wikis, Stack Overflow accepted answers, established technical blogs
5. **General secondary sources** — news aggregators, general-interest blogs, opinion pieces (cite as opinion, not fact)

**Recency as a tiebreaker:** Within the same tier, prefer the more recent source. A 2026 primary source beats a 2023 primary source on evolving topics. A recent expert analysis that references newer data beats an older one, even if the older author is more well-known.

Avoid citing: content farms, SEO-optimised listicles, anonymous forums (unless specifically relevant), and any source that doesn't demonstrate expertise on the topic.

## Handling edge cases

**When search results are poor or irrelevant:** Say so. Explain what you searched for and that the results weren't informative. Offer to try different search terms or angles. Then provide the best answer you can with appropriate caveats.

**When the topic is too niche for web search:** Acknowledge the limitation, provide what you found, and supplement with training knowledge clearly labeled as such.

**When the user asks about something very recent (last few hours):** Search multiple times with different phrasings. Fetch results from news sites directly. If information is still sparse, say it's developing and note what's confirmed versus unconfirmed.

**When the user disagrees with search results:** Don't dismiss their perspective. Search for alternative viewpoints or evidence that might support their position. Present a balanced view with all sources cited.
