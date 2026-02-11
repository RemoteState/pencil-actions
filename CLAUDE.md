# Pencil Design Review GitHub Action

## Live Test PR

**DO NOT MERGE PR #1**: https://github.com/RemoteState/pencil-actions/pull/1

This PR is our **permanent test bed** for testing the action. It should always remain open.

## Project Overview

A GitHub Action that enables visual design review workflows for `.pen` files (Pencil design files) in pull requests. Think "code review, but for designs."

## Architecture

### Renderer Modes

| Mode | Use Case | Requirements |
|------|----------|--------------|
| **service** (recommended) | Production with pencil-screenshot-service | `service-url`, `service-api-key` |
| **claude** | Claude CLI + Pencil MCP | `anthropic-api-key` |
| **metadata** (default) | No visual rendering | None |

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Action (pencil-actions)                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  renderer: service                                           │
│       │                                                      │
│       └──► pencil-screenshot-service API                     │
│                   │                                          │
│                   └──► Pencil WebSocket (export-node-advanced)│
│                                                              │
│  renderer: claude                                            │
│       │                                                      │
│       └──► Claude CLI ──► Pencil MCP                         │
│                                                              │
│  renderer: metadata                                          │
│       │                                                      │
│       └──► Parse .pen JSON (no images)                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Language**: TypeScript (Node.js 20)
- **Build**: `@vercel/ncc` for single-file bundling
- **Packages**: `@actions/core`, `@actions/github`, `@actions/exec`, `@actions/artifact`

## Project Structure

```
pencil-actions/
├── action.yml                 # GitHub Action metadata & inputs
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts               # Entry point
│   ├── types.ts              # Type definitions
│   ├── config.ts             # Input validation
│   ├── pen-parser.ts         # .pen file JSON parsing
│   ├── github/
│   │   ├── files.ts          # Detect changed .pen files
│   │   ├── comments.ts       # PR comment management
│   │   └── artifacts.ts      # Upload screenshots
│   ├── renderers/
│   │   ├── base.ts           # Renderer interface
│   │   ├── metadata.ts       # Metadata-only renderer
│   │   └── claude.ts         # Claude Code CLI renderer
│   └── comment-builder.ts    # Markdown comment generation
├── dist/                     # Bundled action (committed to repo)
└── __tests__/               # Unit tests
```

## Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | GitHub token for API access | Required |
| `renderer` | Renderer mode: `service`, `claude`, `metadata` | `metadata` |
| `service-url` | pencil-screenshot-service URL | - |
| `service-api-key` | Screenshot service API key | - |
| `anthropic-api-key` | Anthropic API key (for claude mode) | - |
| `image-format` | Output format: `webp`, `png`, `jpeg` | `webp` |
| `image-scale` | Export scale: `1`, `2`, `3` | `2` |
| `image-quality` | Quality 1-100 (webp/jpeg) | `90` |
| `max-frames-per-file` | Frame limit per file | `20` |

## Usage Examples

### Service Mode (Recommended)
```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    renderer: service
    service-url: https://your-screenshot-service.example.com
    service-api-key: ${{ secrets.SCREENSHOT_API_KEY }}
    image-format: webp   # smallest file size
    image-scale: 2
```

### Claude Mode
```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    renderer: claude
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Metadata Mode (No Images)
```yaml
- uses: remotestate/pencil-actions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    # renderer defaults to metadata
```

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run package      # Bundle with ncc
npm run all          # Build + package
npm test            # Run tests
```

## .pen File Format

`.pen` files are JSON-based design files from Pencil.dev:
- Root contains `children` array of nodes
- Each node has: `id`, `type`, `name`, `width`, `height`, `x`, `y`
- Frames have `type: "frame"`
- Components marked with `reusable: true`

## Implementation Status

- [x] Type definitions with scale/format/quality support
- [x] Config handling for all renderer modes
- [x] .pen file parser
- [x] GitHub file detection
- [x] Metadata renderer
- [x] Claude CLI renderer
- [x] PR comment builder
- [x] Artifact upload
- [x] WebP default format
- [ ] Service renderer (TODO)
- [ ] Unit tests

## Testing

**Live Test PR**: https://github.com/RemoteState/pencil-actions/pull/1 (DO NOT MERGE)

```bash
# 1. Build and package
npm run build && npm run package

# 2. Commit and push
git add . && git commit -m "Your changes"
git push origin main

# 3. Update v1 tag
git tag -f v1 && git push origin v1 --force

# 4. Trigger test by updating test branch
git checkout test/design-update
git rebase main
git push --force

# 5. Check results
gh pr checks 1
gh pr view 1 --comments
```
