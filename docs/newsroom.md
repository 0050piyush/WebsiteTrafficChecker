# Newsroom playbook

How TrafficLens publishes tech news on `/blog`. A scheduled routine follows this file on every run, and so should anyone writing a post by hand. The public version of these rules is `/blog/how-we-write`; keep the two consistent.

**The goal:** be fast on the day's biggest tech stories, never wrong, and never generic. One accurate, useful story beats three thin ones. Publishing nothing is a valid outcome of a run.

---

## 1. Each run, step by step

1. **Sync.** `git fetch origin claude/focused-planck-jtyu0y && git checkout claude/focused-planck-jtyu0y && git pull --ff-only`, then `npm ci`.
2. **Check today's output.** List `content/blog/<today, UTC>-*.md`. The cap is **3 posts per UTC day**. If it's reached, stop.
3. **Check recent coverage.** Read the titles and slugs of posts from the last 7 days. Don't publish a story that's already covered unless there's a material new development; in that case update the existing post (see section 7).
4. **Find candidates.** Use web search (extended mode) for news from roughly the last 12 hours, for example:
   - `tech news today <Month D YYYY>`, `top tech news <Month D YYYY>`
   - `<Month D YYYY> AI announcement`, `<Month D YYYY> Google`, `... Apple`, `... Microsoft`, `... Nvidia`, `... OpenAI`, `... Meta`, `... Amazon`
   - events scheduled today (keynotes, earnings) that have now *happened*
5. **Pick at most one story per run** using section 2. If nothing qualifies, publish nothing.
6. **Verify** every fact you plan to use (section 3).
7. **Write** the post (sections 4–6).
8. **Validate:** `npx vitest run tests/blog.test.ts`, `npx tsc --noEmit -p .`, `npx eslint .` and `npx next build`. All must pass. Fix the post, never the tests.
9. **Final read-through** against the checklist in section 8.
10. **Publish:** commit only the new or changed post (`git add content/blog/<file>.md`), message `Blog: <headline>`, and `git push origin claude/focused-planck-jtyu0y`. If the push is rejected because the branch moved, `git pull --rebase` and push again. Retry network failures up to 4 times (2s, 4s, 8s, 16s).
11. **Report** in one short paragraph: what was published (title and URL path), or why nothing was.

**Daily minimum:** if a run starts after 18:00 UTC and nothing has been published that UTC day, publish the day's most significant *verified* story even if it isn't breaking.

## 2. What makes a story worth publishing

Publish when **all** of these hold:

- It's **significant**: a major product launch, deal, earnings surprise, regulation, outage, security incident, AI model release or market move from a company people know, or anything that changes how websites, search, advertising or online businesses work.
- It's **widely reported**: covered by at least two independent outlets, or the company's own announcement plus at least one independent outlet.
- It's **fresh**: announced in roughly the last 24 hours (prefer the last 12).
- It has **already happened**. Don't write up an event before it takes place, and don't treat a leak or rumor as fact. A clearly labeled "what's expected" preview is allowed only when its details are confirmed by the organizer.

Prefer stories where TrafficLens readers (site owners, marketers, developers) get a clear "what it means for me". Skip celebrity gossip, deals roundups, stock-tip pieces and press releases nobody else covered.

## 3. Verification rules

- **Two independent sources per fact.** Every fact in `keyFacts` must cite sources from at least two different websites (the tests enforce this). Facts in the body must meet the same bar, or be clearly attributed ("according to Reuters") to a single named source.
- **Search for each claim separately.** Don't trust one summary; run targeted searches for the specific number, date or quote and compare outlets.
- **Conflicting numbers:** use the primary source (company announcement, filing, official blog). If you can't resolve the conflict, leave the number out.
- **Quotes** must be word for word from a source, attributed to the speaker and linked to where they were reported. Never paraphrase into quotation marks.
- **Dates:** state the weekday only after computing it (October 6, 2026 was a Tuesday). Use the event's date, not the article's.
- **Background** (earlier deals, well-known history) may come from general knowledge only if it's long-established and not time-sensitive. Anything recent or numeric needs a source.
- **Primary sources first.** Link the company's own announcement when there is one.
- If a key fact can't be verified, cut it. If the story's core can't be verified, don't publish.

Many news sites block automated fetching, so verification usually means comparing search results from several outlets. That's fine, as long as the facts genuinely agree across independent sources.

## 4. Writing style (people first, never generic)

Write like a sharp tech reporter explaining a story to a smart friend.

- **Lead with the news:** who did what, when, and the one number or detail that matters, in the first two sentences.
- **Be specific:** numbers, names, dates, places. Replace every vague claim with a concrete one or cut it.
- **Short paragraphs** (1–4 sentences) and varied sentence length. Plain words.
- **Attribute** as you go ("according to CNBC") and link 2–4 sources inline.
- **Add something:** context, a comparison, why it matters, what to watch. Don't just restate the press release; don't pad either.
- **Analysis is labeled as analysis.** Don't present predictions as facts.
- **No filler or clichés.** The banned list lives in `lib/blog/style.ts` and the tests enforce it. Also avoid: rhetorical openers, "Let's dive in", "Here's everything you need to know", stacked adjectives, and closing summaries that repeat the article.
- **Don't fake a human.** Posts are bylined to TrafficLens and the page notes that they're written with AI assistance. Never invent an author, a personal anecdote, a "we tested it" claim or a quote.
- **Originality:** write in your own words. Don't copy sentences from sources; quote sparingly and attribute.

## 5. Structure

```
---
front matter (section 6)
---
Lede: 2–3 short paragraphs with the news and the key number or quote.

## What happened / How it works      (the details)
## Why it matters / Context          (background, comparisons)
## What it means for <readers>       (practical implications, bullets are fine)
## What to watch                     (2–4 bullets with concrete next milestones)
```

Section headings should be specific to the story ("Two deals in one", "Planning five years out"), not generic labels, except "What to watch". Length: **600–1,100 words** (the tests allow 400–1,600).

## 6. Front matter and Google Discover

File: `content/blog/YYYY-MM-DD-short-slug.md` (UTC date; slug of 3–7 lowercase words with hyphens, describing the story; never `page`, `how-we-write` or `rss`).

```yaml
---
title: "…"            # the headline, ≤ 110 characters (aim for 60–100)
description: "…"      # 50–170 characters: the news in one sentence, with a key detail
date: "2026-10-07T15:25:00Z"   # publish time in UTC, never in the future
tags: [Primary topic, Company, Theme]   # 1–5; the first tag is the cover's kicker
cover:
  motif: chip         # energy | chip | ads | ai | search | security | chart | phone | cloud
  stat: "2027"        # optional, ≤ 9 characters: one key number from keyFacts
  statLabel: "…"      # optional, ≤ 48 characters
  alt: "Illustration of …"   # 20–200 characters, describes the image
keyFacts:             # 3–6 facts, each citing ≥ 2 sources from different websites
  - text: "…"
    sources: [1, 2]
sources:              # numbered from 1, https only, publisher + exact article title
  - publisher: "CNBC"
    title: "…"
    url: "https://…"
---
```

**Headlines for Google Discover and search:**

- Lead with the company or product people recognize, and say what changed: *"Google just locked in 3.6 GW of power from Constellation, including 890 MW of new nuclear capacity"*.
- Include a concrete number or detail when there is one. Use an active verb.
- A conversational tone is fine ("is testing", "just locked in", "but … says it could use even more").
- The headline must match the article. No clickbait, no withheld key facts ("You won't believe…", "This changes everything"), no ALL CAPS, no outrage or fear framing, and no question headlines unless the article answers them right away.

**Cover image:** generated automatically from `cover` at 1200×675, 1200×900 and 1200×1200 (Discover needs large images; `max-image-preview:large` is set site-wide). Pick the motif that best matches the subject. Use `stat` only for a verified number that's central to the story. Never use other outlets' photos.

## 7. Updates and corrections

- New development on a story covered in the last 7 days: update the existing post instead of writing a new one. Add or adjust facts and sources, and set `updated:` to the current UTC time. Keep `date` unchanged.
- Errors: fix them, set `updated:`, and say what changed in one sentence at the end of the post ("*Correction: an earlier version said … .*").
- Never delete a published post to hide a mistake.

## 8. Final checklist

- [ ] The story has already happened and is covered by ≥ 2 independent outlets.
- [ ] Every number, date, name and quote matches the sources; weekdays are computed.
- [ ] Every key fact cites sources from ≥ 2 different websites; every source URL is the specific article.
- [ ] The headline is specific, accurate and not clickbait; the description says what happened.
- [ ] The lede delivers the news in two sentences; there's real context and a "what to watch".
- [ ] No banned phrases, no invented quotes, authors or experiences.
- [ ] `cover` is set, and `stat` (if any) is a verified number.
- [ ] Tests, typecheck, lint and build pass.
