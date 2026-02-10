# Pencil Design Review Action

A GitHub Action that enables visual design review workflows for `.pen` files (Pencil design files) in pull requests. Think "code review, but for designs."

## Features

- 🔍 **Automatic Detection**: Detects all changed `.pen` files in PRs
- 📝 **Metadata Mode**: Shows frame names, IDs, and structure (no API key required)
- 🖼️ **Visual Mode**: Generates actual screenshots with Anthropic API key
- 💬 **PR Comments**: Posts beautiful, structured comments with design summaries
- 📦 **Artifact Upload**: Saves screenshots as workflow artifacts
- 🔄 **Smart Updates**: Updates existing comments instead of creating duplicates

## Quick Start

### Basic Usage (Metadata Mode - Free)

```yaml
name: Design Review
on:
  pull_request:
    paths:
      - '**/*.pen'

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      - name: Design Review
        uses: remotestate/pencil-actions@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Visual Mode (With Screenshots)

```yaml
name: Design Review
on:
  pull_request:
    paths:
      - '**/*.pen'

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      - name: Design Review
        uses: remotestate/pencil-actions@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          renderer: claude
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | Yes | - | GitHub token for API access |
| `anthropic-api-key` | No | - | Anthropic API key (enables visual mode) |
| `renderer` | No | `metadata` | Renderer: `metadata` or `claude` |
| `pen-files` | No | `**/*.pen` | Glob pattern for .pen files |
| `comment-mode` | No | `update` | Comment behavior: `create`, `update`, or `none` |
| `upload-artifacts` | No | `true` | Upload screenshots as artifacts |
| `max-frames-per-file` | No | `20` | Max frames to render per file (0 = unlimited) |
| `image-format` | No | `png` | Output format: `png` or `jpeg` |
| `output-dir` | No | `.pencil-screenshots` | Directory for screenshots |
| `include-deleted` | No | `true` | Show deleted files in comment |

## Outputs

| Output | Description |
|--------|-------------|
| `screenshots-path` | Path to screenshots directory |
| `changed-files` | JSON array of changed .pen files |
| `frames-rendered` | Total frames rendered |
| `comment-id` | ID of the PR comment |

## Modes

### Metadata Mode (Default)

When no `anthropic-api-key` is provided, the action runs in metadata mode:
- Parses `.pen` files as JSON
- Extracts frame names, IDs, and structure
- Posts a structured comment with frame information

**Example comment:**
```
## 🎨 Design Review

📁 **2** design files (1 added, 1 modified)
🖼️ **5** frames detected
✅ **5** processed successfully

### 🆕 `src/designs/dashboard.pen` (added)
| Frame | ID | Status |
|-------|-----|--------|
| Header | `abc123` | ✅ OK |
| Sidebar | `def456` | ✅ OK |
```

### Visual Mode

When `anthropic-api-key` is provided and `renderer: claude`:
- Uses Claude Code CLI with Pencil MCP
- Generates actual PNG/JPEG screenshots
- Uploads screenshots as artifacts
- Embeds images in PR comments

**Requirements:**
- Anthropic API key with sufficient credits
- Claude Code CLI (auto-installed if missing)

## How It Works

1. **Trigger**: PR opened/updated with `.pen` file changes
2. **Detection**: Identifies all changed `.pen` files
3. **Parsing**: Extracts frame information from each file
4. **Rendering**: Generates screenshots (visual mode) or metadata
5. **Upload**: Saves screenshots as workflow artifacts
6. **Comment**: Posts/updates PR comment with results

## Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Package for distribution
npm run package

# Run tests
npm test
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Links

- [Pencil.dev](https://pencil.dev) - The design tool
- [.pen File Format](https://docs.pencil.dev/core-concepts/pen-files) - File format docs
