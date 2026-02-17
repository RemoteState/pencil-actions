# Viral Launch Plan: Pen Design Review

## Pre-Launch Checklist

### Screenshots Needed (from PR #4)

Capture these from https://github.com/RemoteState/pencil-actions/pull/4:

1. **`docs/images/demo-diff-review.png`** — The diff mode PR comment showing before/after tables. This is the hero image for the README and social posts. Capture the section starting from "Design Review" header through the collapsed unchanged frames.

2. **`docs/images/social-preview.webp`** (1280x640px) — Social preview image for the GitHub repo. Upload via GitHub Settings > Social Preview. Could be a composite of the YAML config + the PR comment result.

3. **`docs/images/yaml-config.webp`** — Screenshot of just the 5-line workflow YAML from the Quick Start section.

4. **`docs/images/split-screen.webp`** — Split-screen graphic: YAML config on left, PR comment result on right. This is the strongest visual for social posts ("You write THIS, you get THAT").

### GitHub Repo (Already Done)

- [x] Description: "Visual design diffs in GitHub PRs. Before/after screenshots for every .pen design change. Free, open-source GitHub Action."
- [x] Homepage: https://www.remotestate.com/
- [x] Topics: pencil, design-review, github-actions, visual-diff, design-ops, code-review, pen-files, before-after
- [ ] Social preview image uploaded (1280x640px)
- [ ] Pin repo on RemoteState org profile
- [ ] README demo screenshot added (replace placeholder)

---

## Posting Schedule

| Day | Platform | Content | File |
|-----|----------|---------|------|
| Day -1 | LinkedIn | Philosophy post | [linkedin-philosophy.md](#phase-1-philosophy-post-day--1) |
| Day 0 AM | LinkedIn + Twitter | Launch post with screenshot | [linkedin-launch.md](#phase-2-launch-post-day-0) / [twitter-launch.md](#twitter-launch) |
| Day 0 PM | HN + Reddit | Show HN + subreddit posts | [hackernews.md](#hacker-news) / [reddit.md](#reddit) |
| Day +1 | Twitter | Reply thread with additional screenshots | |
| Day +2 | LinkedIn | "Behind the build" technical post | |
| Day +3 | Dev.to | Full blog post version | |
| Day +5 | Twitter | Engagement: "worst design review process?" | |
| Day +7 | LinkedIn | Traction update | |

---

## Phase 1: Philosophy Post (Day -1)

### LinkedIn

```
Hours of planning can save you weeks of coding.

We've all heard it. But in the AI era, it hits different.

When code is nearly free to generate, the bottleneck isn't
implementation — it's knowing what to implement. Direction > speed.

I've seen teams ship 3 versions of a feature because no one
stopped to design the flow first. AI made each version fast.
But fast x wrong direction = expensive.

The teams winning right now aren't the ones coding fastest.
They're the ones thinking hardest before the first line is written.

Design first. Brainstorm with AI. Flush out the UX. Get everyone
on the same page. THEN implement.

The irony? AI is the best brainstorming partner we've ever had.
But most teams skip that step and go straight to "build me a
login page."

What's your take — are we moving too fast to think?
```

**Why this works**: Engages people in a debate. Gets comments. Algorithms love engagement. Sets up the product announcement as the natural follow-up.

---

## Phase 2: Launch Post (Day 0)

### LinkedIn Launch

```
We open-sourced our internal design review tool.

5 lines of YAML → every design change in your PR gets
a visual diff. Before and after. Automatically.

Here's what it looks like:
[ATTACH: split-screen.webp or demo-diff-review.png]

Why we built this:

At RemoteState, we adopted design-first development.
Designs versioned in git, treated like code. AI for
brainstorming, Pencil for designing, code last.

But something was missing. When a designer updated 3 screens
out of 20, the PR just showed a blob of JSON changes.
No one could tell what actually changed visually.

So we built this. A GitHub Action that:

-> Detects which .pen design files changed
-> Compares the base branch version with the new one
-> Renders only the changed frames
-> Posts before/after screenshots right in the PR

It's been running on our projects for months.
Today we're making it free for everyone.

1,000 screenshots/month. No API key. No account.
Just add the workflow file and push.

github.com/RemoteState/pencil-actions

Using Pencil for your product? Tell us about it ->
remotestate.com/contactus
We'll bump you to 10,000 screenshots/month. For free.

We just want to hear what you're building.

#pencil #designops #github #opensource
```

### Twitter Launch

**Single tweet:**

```
We open-sourced our design review tool.

5 lines of YAML → visual diffs in your GitHub PRs.

Before/after screenshots for every design change. Automatic.

→ Free (1,000/month)
→ No API key needed
→ Works with @pencaboratory .pen files

[ATTACH: split-screen.webp]

github.com/RemoteState/pencil-actions
```

**Thread version:**

```
Tweet 1:
We've been running visual design diffs in our PRs for months.

Today we're open-sourcing the tool. Free for everyone.

Here's the story and why we built it →

Tweet 2:
The problem: Design files in git look like JSON blobs.

A designer changes 3 screens out of 20. The PR diff? Useless.

No one knows what actually changed without opening the design tool.

Tweet 3:
So we built a GitHub Action that:

1. Detects changed .pen design files
2. Fetches the old version from the base branch
3. Compares frame-by-frame
4. Posts before/after screenshots in the PR

[ATTACH: demo-diff-review.png]

Tweet 4:
The philosophy: design should be version-controlled
and reviewed like code.

Not "export a PNG and paste it in Slack."

Actual visual diffs. In the PR. Where your team already reviews work.

Tweet 5:
Setup is 5 lines of YAML:

[ATTACH: yaml-config.webp]

That's it. Free tier: 1,000 screenshots/month per repo.
No API key, no account — just GitHub OIDC.

Tweet 6:
Built by @RemoteState

Using Pencil? Tell us about your project →
remotestate.com/contactus

We'll 10x your credits. We just want to hear
what people are building.

github.com/RemoteState/pencil-actions
```

### Hacker News

**Title**: `Show HN: Visual design diffs in GitHub PRs – open-source GitHub Action for .pen files`

**Body**:

```
We built a GitHub Action that adds visual design review to pull requests.

When .pen design files change in a PR, it automatically:
- Detects which frames (screens) changed
- Renders before/after screenshots
- Posts a comment with side-by-side comparison
- Collapses unchanged frames

It's the same review flow developers use for code, but for designs.

Setup is a 5-line workflow YAML file. Free tier is 1,000 screenshots/month
per repo with no API key needed (uses GitHub OIDC).

We built this internally at RemoteState because we version our designs in git
and needed actual visual diffs in PRs instead of unreadable JSON changes.

GitHub: https://github.com/RemoteState/pencil-actions
Example PR with design diff: https://github.com/RemoteState/pencil-actions/pull/4

Works with Pencil (.pen) design files.
```

### Reddit

**Subreddits**: r/programming, r/webdev, r/github

**Title**: `We open-sourced a GitHub Action for visual design diffs in PRs — before/after screenshots for .pen files, free`

**Body**:

```
We've been running visual design review in our PRs internally for a while
and just open-sourced it.

It's a GitHub Action that detects changed .pen design files, compares
the base branch version with the new one frame-by-frame, and posts
before/after screenshots right in the PR comment.

- 5-line YAML setup
- Free: 1,000 screenshots/month per repo
- No API key needed (uses GitHub OIDC)
- Only renders changed frames (smart diffing)

Repo: https://github.com/RemoteState/pencil-actions
Example PR: https://github.com/RemoteState/pencil-actions/pull/4

Works with Pencil (.pen) design files — the design tool that's been
getting a lot of attention lately.

Would love feedback from anyone who versions design files in git.
```

---

## Phase 3: Follow-Up Content (Day +2 to +7)

### "Behind the Build" (Day +2, LinkedIn)

Technical post about:
- SHA-256 frame hashing for change detection
- Frame matching by stable IDs across versions
- The async job queue (why sync screenshots hit Cloudflare 504s)
- Docker master/worker architecture for scaling
- Why we chose GitHub OIDC over API keys for the free tier

### "5-Minute Setup" (Day +3, Dev.to / blog)

Step-by-step tutorial:
1. Create `.github/workflows/design-review.yml`
2. Push a `.pen` file change
3. See the comment appear
4. Show the before/after result

Include screenshots of each step.

### Engagement Post (Day +5, Twitter)

```
What's the worst design review process you've ever seen?

I'll start: "Export screens as PNGs, upload to Google Drive,
paste links in the PR description, hope someone looks at them."
```

### Traction Update (Day +7, LinkedIn)

```
One week ago we open-sourced Pen Design Review.

[X] repos have added it. [Y] design diffs generated.

Here's what we learned from the first week...
```

---

## Viral Mechanics — Why This Can Work

1. **Visual product = visual content**: The before/after screenshot IS the demo. No explanation needed.
2. **Trending wave**: Pencil is getting attention → people searching for Pencil tooling will find this.
3. **Zero friction**: "Add 5 lines, get design review" — tryable in 2 minutes.
4. **Free removes objections**: No pricing page, no sign-up, no "contact sales."
5. **CTA creates conversations**: "Tell us about your project, get 10x credits" — not selling, connecting.
6. **Dev tool Show HN formula**: Open source + real problem + good demo = front page potential.

---

## Engagement Playbook (First 48 Hours)

- [ ] Reply to **every** comment in the first 24 hours (algorithm signal)
- [ ] DM people who engage heavily — ask what they're building
- [ ] Repost/reshare with commentary after 48 hours
- [ ] Cross-post to Pencil community channels (Discord, forum)
- [ ] Thank early stargazers publicly
