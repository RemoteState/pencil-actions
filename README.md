# Pen Design Review

Automatically preview `.pen` design files in pull requests. When design files change, this action detects what changed and posts screenshots directly in your PR — with before/after comparisons for modified frames.

**Code review, but for designs.**

## Quick Start

Add `.github/workflows/design-review.yml` to your repository:

```yaml
name: Design Review
on:
  pull_request:
    paths:
      - '**/*.pen'

permissions:
  contents: read
  pull-requests: write
  id-token: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: remotestate/pencil-actions@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

That's it. Every PR that touches a `.pen` file will get a comment showing exactly what changed — modified frames get side-by-side before/after screenshots, new frames get full previews, and unchanged frames are listed in a collapsed section.

## How It Works

1. PR is opened or updated with `.pen` file changes
2. The action detects changed design files and fetches the base branch version
3. Frames are compared — only changed frames are rendered (added, modified, removed)
4. A PR comment is posted with before/after screenshots for modified frames
5. On subsequent pushes, the comment is updated in place

### Review Modes

| Mode | Description | Default |
|------|-------------|---------|
| **`diff`** | Shows only changed frames with before/after comparison. Unchanged frames collapsed. | Yes |
| **`full`** | Renders every frame in every changed file. No comparison. | — |

### Example PR Comment (Diff Mode)

> ### Design Review
>
> **1** design file (**1** modified)
> Frames: **3** modified, **6** unchanged
>
> #### Modified Frames
>
> **Dashboard**
> | Before | After |
> |--------|-------|
> | ![before](screenshot) | ![after](screenshot) |
>
> <details><summary>6 unchanged frames</summary>
>
> - Interviews, Candidates, Questions Bank...
> </details>

## Free to Use

| Tier | Screenshots/month per repo | How to get it |
|------|---------------------------|---------------|
| **Free** | 1,000 | Just add the action — no API key needed |
| **Free with API key** | 5,000 | [Contact us](https://www.remotestate.com/contactus) to get a key |
| **Free with demo** | 10,000 | [Show us](https://www.remotestate.com/contactus) a quick demo of your product, or just chat about what else we can build to make this tool even better |

Every tier is **free, forever**. We want every team using Pencil to have design review on every PR.

The base tier works automatically via GitHub's OIDC tokens — just add `id-token: write` to your workflow permissions and you're set. For higher limits, pass your API key via `service-api-key`.

## Configuration

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `github-token` | *required* | GitHub token for API access |
| `review-mode` | `diff` | `diff` (before/after comparison) or `full` (render all frames) |
| `comment-id` | — | Namespace for PR comments. Use when running multiple workflows to avoid overwriting |
| `comment-mode` | `update` | `create` (always new comment), `update` (in-place), or `none` |
| `image-format` | `webp` | Output format: `webp`, `png`, or `jpeg` |
| `image-scale` | `2` | Export scale: `1`, `2`, or `3` |
| `image-quality` | `90` | Quality for webp/jpeg (1-100) |
| `max-frames-per-file` | `20` | Max frames to render per file (0 = unlimited) |
| `upload-artifacts` | `true` | Upload screenshots as workflow artifacts |
| `service-api-key` | — | API key (optional, for higher limits) |

### Outputs

| Output | Description |
|--------|-------------|
| `screenshots-path` | Path to generated screenshots directory |
| `changed-files` | JSON array of changed `.pen` file paths |
| `frames-rendered` | Total number of frames rendered |
| `comment-id` | ID of the created/updated PR comment |

### Permissions

```yaml
permissions:
  contents: read        # Read .pen files from the repo
  pull-requests: write  # Post PR comments
  id-token: write       # OIDC authentication (free tier)
```

## Examples

### Diff mode (default) — show only what changed

```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Full mode — render every frame

```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    review-mode: full
```

### Multiple workflows on the same PR

Use `comment-id` to prevent workflows from overwriting each other:

```yaml
# Workflow 1: Diff review
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    review-mode: diff
    comment-id: diff

# Workflow 2: Full screenshots
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    review-mode: full
    comment-id: full
```

### High-res PNG output

```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    image-format: png
    image-scale: 3
```

## What are .pen files?

`.pen` files are design files created with [Pencil](https://pencil.dev) — a design tool for creating web and mobile interfaces. They're JSON-based, version-control friendly, and contain frames (screens/artboards) that this action renders as images.

## Talk to Us

We built this at [RemoteState](https://www.remotestate.com/) because we think design review should be as easy as code review.

Using Pen Design Review for your project? We'd love to hear about it. [Tell us what you're building](https://www.remotestate.com/contactus) and get up to **10,000 screenshots/month** — on us.

- Have feedback or feature requests? [Open an issue](https://github.com/RemoteState/pencil-actions/issues)
- Want to chat? [Contact us](https://www.remotestate.com/contactus)

## Links

- [Pencil](https://pencil.dev) — The design tool
- [RemoteState](https://www.remotestate.com/) — Built by RemoteState

## License

MIT
