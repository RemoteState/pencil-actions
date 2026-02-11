# Pen Design Review

Automatically preview `.pen` design files in pull requests. When design files change, this action renders every frame and posts inline screenshots directly in your PR.

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

That's it. Every PR that touches a `.pen` file will get a comment like this:

> ### Design Review
>
> **1** design file (**1** modified) | **8** frames detected | **8** rendered
>
> | Frame | Description |
> |-------|-------------|
> | **Dashboard** | Key metrics overview with interview trends chart and activity feed |
> | **Interviews** | Interview management table with status badges and filtering |
> | **Candidates** | Candidate profile cards with AI scores and evaluation status |
> | **Questions Bank** | AI-generated question templates organized by category |
> | **AI Settings** | Model configuration and evaluation criteria settings |
> | **Analytics** | Score distribution charts and top performing positions |
> | **Job Positions** | Open positions management with application counts |
> | **Settings** | System configuration, integrations, and preferences |
>
> ![Interview Express Dashboard](https://camo.githubusercontent.com/85cddabfaaec97ad05898511953cc95ec2e59eaf7a7b3c8649e811ffa909487a/68747470733a2f2f70656e63696c2e72656d6f746573746174652e636f6d2f696d616765732f65613366333563372d653265352d343436312d616662612d3564616466363361303966362e77656270)

## How It Works

1. PR is opened or updated with `.pen` file changes
2. The action detects changed design files
3. Each frame is rendered as a screenshot
4. A PR comment is posted with inline image previews
5. On subsequent pushes, the comment is updated in place

## Pricing

| Tier | Price | Screenshots / month | Auth |
|------|-------|---------------------|------|
| **Free** | $0 | 100 per repo | GitHub OIDC (automatic) |
| **Pro** | $10/month | 1,000 per repo | API key |
| **Enterprise** | Custom | Unlimited | API key |

The free tier works out of the box with no API key — authentication happens automatically via GitHub's OIDC tokens. Just add `id-token: write` to your workflow permissions.

For paid tiers, [contact us](https://www.remotestate.com/) for an API key, then add it to your workflow:

```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    service-api-key: ${{ secrets.PEN_API_KEY }}
```

## Configuration

### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `github-token` | *required* | GitHub token for API access |
| `service-api-key` | — | API key for paid tier. Omit for free tier (OIDC) |
| `pen-files` | `**/*.pen` | Glob pattern to match design files |
| `image-format` | `webp` | Output format: `webp`, `png`, or `jpeg` |
| `image-scale` | `2` | Export scale: `1`, `2`, or `3` |
| `image-quality` | `90` | Quality for webp/jpeg (1-100) |
| `max-frames-per-file` | `20` | Max frames to render per file (0 = unlimited) |
| `comment-mode` | `update` | `create` (always new), `update` (in-place), or `none` |
| `upload-artifacts` | `true` | Upload screenshots as workflow artifacts |
| `renderer` | `service` | `service` (screenshots) or `metadata` (frame info only) |

### Outputs

| Output | Description |
|--------|-------------|
| `screenshots-path` | Path to generated screenshots directory |
| `changed-files` | JSON array of changed `.pen` file paths |
| `frames-rendered` | Total number of frames rendered |
| `comment-id` | ID of the created/updated PR comment |

### Permissions

The workflow needs these permissions:

```yaml
permissions:
  contents: read        # Read .pen files from the repo
  pull-requests: write  # Post PR comments
  id-token: write       # Free tier OIDC authentication (not needed with API key)
```

## Examples

### Only review specific directories

```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    pen-files: 'designs/**/*.pen'
```

### PNG output at 3x scale

```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    image-format: png
    image-scale: 3
```

### Skip commenting, just generate artifacts

```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    comment-mode: none
    upload-artifacts: true
```

## What are .pen files?

`.pen` files are design files created with [Pencil](https://pencil.dev) — a design tool for creating web and mobile interfaces. They're JSON-based, version-control friendly, and contain frames (screens/artboards) that this action renders as images.

For example, a SaaS admin dashboard like **Interview Express** might contain 8 frames: Dashboard, Interviews, Candidates, Questions Bank, AI Settings, Analytics, Job Positions, and Settings — each rendered as a separate preview in your PR comment.

## Links

- [Pencil](https://pencil.dev) — The design tool
- [RemoteState](https://www.remotestate.com/) — Built by RemoteState

## License

MIT
