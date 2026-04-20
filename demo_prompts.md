# Demo Prompts — Multi-Agent AI Framework

A curated set of prompts for the graduation demo. Copy them straight into the chat.

The prompts are ordered by **narrative flow**: single-agent warm-ups → 2-agent chains → complex multi-agent orchestrations → grand finale. All of them are aimed at **Main Agent** and rely on its sequential delegation loop.

**Before the demo, make sure:**
- `GITHUB_PAT` is set (GitHubAgent auto-detects the authenticated user — no need to type the username).
- Google Workspace OAuth is completed (Gmail + Drive + Calendar + Docs scopes).
- `GEMINI_API_KEY` is set.
- One CSV file is ready to drag into the chat for the data-analysis demos (any sales / churn / iris CSV works).
- One screenshot is ready (for the vision + frontend demo).

---

## Part 1 — Single-Agent Warm-ups

Use these to prove each specialized agent works in isolation, before the orchestration demos.

### 1.1 Search Agent
> Find the three most-cited arXiv papers on retrieval-augmented generation published this year. For each paper, give me title, authors, venue, URL, and a two-sentence takeaway.

### 1.2 Hugging Face Agent
> Show me the top 5 trending text-to-image models on Hugging Face right now, with their download counts and links.

### 1.3 GitHub Agent
> List the ten most recent commits on the `demo` branch of the `multi-agent-ai-framework` repo under my account. For each, give the short SHA, author, date, and one-line subject.

### 1.4 Codebase Agent
> Explain how the MainAgent's sequential delegation loop works in this project. Point me to the exact files and line numbers where the loop is wired up.

### 1.5 Data Analyst Agent *(attach a CSV)*
> For the attached CSV, give me summary statistics, flag the three strongest correlations between numeric columns, and plot a histogram of the most interesting variable.

### 1.6 Vision Agent *(attach a screenshot)*
> Analyze the attached screenshot. Describe what's on the page, extract any visible text, and list the dominant color palette as HSL values.

### 1.7 Frontend Agent
> Apply the cyberpunk preset, enable strong glassmorphism, and use bouncy animations. Then briefly describe the look you just applied.

### 1.8 Google Workspace Agent
> Find a 30-minute free slot on my calendar tomorrow afternoon, and draft (don't send) an email to `oruccakir2525@gmail.com` proposing that slot for a project sync.

### 1.9 Coding Agent
> Implement a thread-safe LRU cache with O(1) get and put in Python. Include a short test harness that demonstrates eviction order.

---

## Part 2 — Two-Agent Chains

The smallest orchestrations. Main Agent delegates twice without user intervention.

### 2.1 Research → Email
> Find one recent arXiv paper on mixture-of-experts models, summarize its contributions in three bullet points, and draft an email to me with the summary, title, authors, and URL.

**Expected chain:** `delegate_to_search` → `delegate_to_google_workspace`

### 2.2 Repo Activity → Self-Review
> Pull my last five commits across all my GitHub repos, then explain — using this project's codebase as the reference — which of those commits touched areas that now need new tests.

**Expected chain:** `delegate_to_github` → `delegate_to_codebase`

### 2.3 Hugging Face → Vision
> Search Hugging Face for the most popular text-to-image Space right now, invoke it to generate a hero image for a talk titled *"Multi-Agent Systems for Everyone"*, and show me the image.

**Expected chain:** `delegate_to_huggingface` → `delegate_to_vision`

### 2.4 Data → Drive
> Analyze the attached CSV — summary stats plus the top 3 correlations — then create a Google Doc titled *"CSV Analysis Report"* containing the findings and share it with `oruccakir2525@gmail.com`.

**Expected chain:** `delegate_to_data_analyst` → `delegate_to_google_workspace`

### 2.5 Vision → Frontend
> Look at the attached screenshot, extract its color palette and overall aesthetic, then apply a matching theme to this app (colors, font, radius, shadow).

**Expected chain:** `delegate_to_vision` → `delegate_to_frontend`

---

## Part 3 — Three-Agent Orchestrations

These show Main Agent reasoning about multi-step plans and carrying context between steps.

### 3.1 Research → Code → Email
> Research how token-bucket rate limiters work (cite at least two sources), implement one in Python with tests, and email me the full code with a short write-up.

**Expected chain:** `delegate_to_search` → `delegate_to_coding` → `delegate_to_google_workspace`

### 3.2 News → Image → Social Draft
> Find today's top AI news headline, generate a square hero image for a LinkedIn post about that story via Hugging Face, and draft me the LinkedIn post text with the image URL embedded.

**Expected chain:** `delegate_to_search` → `delegate_to_huggingface` → `delegate_to_google_workspace`

### 3.3 Repo → Codebase → Issue
> List the three most recent closed issues on my `multi-agent-ai-framework` repo, use the codebase agent to verify whether the fix referenced in each one actually exists in the code, and then draft a follow-up GitHub issue summarizing any gaps you found.

**Expected chain:** `delegate_to_github` → `delegate_to_codebase` → `delegate_to_github`

### 3.4 Data → Chart → Doc
> Analyze the attached CSV, run a correlation analysis, generate a heatmap chart, and save a one-page summary containing both the narrative and the chart as a Google Doc in my Drive.

**Expected chain:** `delegate_to_data_analyst` → `delegate_to_data_analyst` (chart step) → `delegate_to_google_workspace`

### 3.5 Screenshot → Palette → Theme → Brief
> Analyze the attached screenshot, extract the color palette, apply a matching theme to this app, and email me a one-paragraph brief describing the inspiration and the exact colors applied.

**Expected chain:** `delegate_to_vision` → `delegate_to_frontend` → `delegate_to_google_workspace`

---

## Part 4 — Complex Multi-Agent Orchestrations

Four or more delegations in a single user turn. This is where the system really earns its keep.

### 4.1 Full Research Briefing
> I'm preparing a talk on retrieval-augmented generation.
> 1. Search arXiv for the two most impactful RAG papers from the past 12 months and summarize each.
> 2. Find a matching Hugging Face model and give me its repo details.
> 3. Generate a title-slide image for the talk.
> 4. Package everything (summaries, model link, image URL) into a Google Doc titled *"RAG Talk Brief"* in my Drive, and email me the Doc link.

**Expected chain:** search → huggingface → vision (generate) → google_workspace (doc) → google_workspace (email)

### 4.2 Codebase Health Report
> Produce a health report for the `multi-agent-ai-framework` project:
> 1. Using the GitHub agent, list my ten most recent commits and the three most recent open PRs.
> 2. Using the codebase agent, identify any places in the code that those commits or PRs touched which now look inconsistent.
> 3. Draft a Google Doc titled *"Codebase Health — <today's date>"* containing the findings, and share it with me.

**Expected chain:** github → github → codebase → google_workspace

### 4.3 Data Story
> From the attached sales CSV:
> 1. Run descriptive statistics, correlations, and outlier detection.
> 2. Generate at least two charts (scatter + heatmap).
> 3. Train a simple random-forest model to predict the most obvious target column and report feature importance.
> 4. Write a Google Doc titled *"Sales Story"* summarizing the findings in plain English for a non-technical audience, embedding the chart URLs.
> 5. Email me the Doc link when done.

**Expected chain:** data_analyst (stats) → data_analyst (charts) → data_analyst (ML) → google_workspace (doc) → google_workspace (email)

### 4.4 Paper → Blog → Visuals → Publish
> Take the latest arXiv paper by Yann LeCun.
> 1. Summarize its contributions.
> 2. Generate a hero image that visually represents the paper's main idea.
> 3. Analyze the generated image to extract its dominant palette.
> 4. Apply that palette to this app's theme so the UI matches the post I'll write.
> 5. Create a blog-style Google Doc combining the summary, the hero image URL, and a "Further Reading" section with the paper link.
> 6. Email me the Doc link.

**Expected chain:** search → huggingface → vision → frontend → google_workspace (doc) → google_workspace (email)

### 4.5 Multi-Repo Maintenance Briefing
> I want a weekly maintenance digest for my GitHub activity:
> 1. List my open PRs across all my repos.
> 2. For each open PR, summarize the diff.
> 3. Cross-reference the touched files against this project's codebase to note any risky areas.
> 4. Produce a Google Doc titled *"Maintenance Digest — <today's date>"* with a per-PR checklist of what to verify before merging.
> 5. Email me the Doc link.

**Expected chain:** github (list) → github (diffs) → codebase → google_workspace (doc) → google_workspace (email)

---

## Part 5 — Grand Finale

Save this one for the closing of the presentation. It exercises **seven agents in a single user turn** with context flowing end-to-end.

### 5.1 The Ultimate Orchestration
> I'm giving a demo today about this very multi-agent framework. Do the following end-to-end without asking me anything:
> 1. Search the web for the three most-discussed "multi-agent AI framework" stories from the last month and summarize each.
> 2. Use the codebase agent to produce a one-paragraph description of how **this** project's MainAgent orchestrates specialized agents, citing the exact files.
> 3. Find a trending Hugging Face text-to-image Space and generate a hero image titled *"Multi-Agent AI for Everyone"* in a clean, modern style.
> 4. Analyze the generated image, pull its dominant color palette in HSL, and apply a matching theme to this app (colors + font + shadow + glassmorphism).
> 5. Ask the coding agent to implement a minimal example of sequential delegation — one "router" function that calls two sub-functions in order and returns a combined result. Include the code.
> 6. Assemble all of the above — the news summaries, the architecture paragraph, the hero image URL, the palette, and the code snippet — into a Google Doc titled *"Multi-Agent AI Demo Pack — <today's date>"* in my Drive.
> 7. Email me the Doc link with a one-sentence cover note.

**Expected chain:** search → codebase → huggingface → vision → frontend → coding → google_workspace (doc) → google_workspace (email)

This one prompt showcases **eight delegations across seven specialized agents** in a single turn, with prior outputs carried forward each step — exactly what the framework was built for.

---

## Part 6 — Resilience / Recovery Demo

If time allows, include this to show the system degrades gracefully.

### 6.1 Blocked-Ambiguity Recovery
> Open a GitHub issue about the bug I was telling you about.

**Expected behavior:** Main Agent recognizes it has no repo, no description, and no prior context, so it asks a single focused clarifying question rather than guessing. Demonstrates the "ask one focused question when blocked" constraint in the prompt.

### 6.2 Graceful Fallback
> Analyze the attached CSV with advanced Python, train a model, and show me a live chart. *(Run this with `E2B_API_KEY` unset.)*

**Expected behavior:** Data Analyst Agent falls back to Phase 1 (code emission instead of execution) and explicitly notes the E2B configuration is required for live charts.

---

## Demo Running Tips

- **Keep the execution-flow panel open.** The collapsible tree showing each delegation, tool call, and timing is the single most compelling visual in the demo.
- **For the complex prompts (Part 4 / Part 5)**, narrate the delegations as they happen: "Now Main Agent is handing off to Search Agent... now it's calling Hugging Face Agent with the search result quoted verbatim..."
- **Reset the theme between finale runs** with: *"Reset all styles to default."*
- **If a step fails mid-chain**, let it surface — it demonstrates that Main Agent synthesizes partial results rather than crashing.
