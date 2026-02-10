# Pencil Design Review GitHub Action

## ⚠️ IMPORTANT: Live Test PR

**DO NOT MERGE PR #1**: https://github.com/RemoteState/pencil-actions/pull/1

This PR is our **permanent test bed** for testing the action. It should always remain open.
- Use it to test changes to the action
- Push to `test/design-update` branch to trigger new runs
- Check the PR comments to verify the action works correctly

## Project Overview

A GitHub Action that enables visual design review workflows for `.pen` files (Pencil design files) in pull requests. Think "code review, but for designs."

## Architecture

### Hybrid Renderer Approach

1. **Metadata Mode** (Default - No API key required)
   - Parses `.pen` files as JSON
   - Extracts frame hierarchy, names, dimensions
   - Posts structured PR comment with frame metadata

2. **Visual Mode** (Requires `ANTHROPIC_API_KEY`)
   - Uses Claude Code CLI to invoke Pencil MCP tools
   - Generates PNG/JPEG screenshots of each frame
   - Uploads as GitHub artifacts, embeds in PR comments

## Tech Stack

- **Language**: TypeScript (Node.js 20)
- **Build**: `@vercel/ncc` for single-file bundling
- **Packages**: `@actions/core`, `@actions/github`, `@actions/exec`, `@actions/artifact`
- **Testing**: Jest

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

## Key Files

- `action.yml` - Defines action inputs/outputs
- `src/main.ts` - Orchestrates the workflow
- `src/pen-parser.ts` - Core .pen file parsing logic
- `src/renderers/claude.ts` - Claude Code CLI integration

## .pen File Format

`.pen` files are JSON-based design files from Pencil.dev. Key structure:
- Root contains `children` array of nodes
- Each node has: `id`, `type`, `name`, `width`, `height`, `x`, `y`
- Frames have `type: "frame"`
- Components marked with `reusable: true`

## Claude Code CLI Integration

When `ANTHROPIC_API_KEY` is provided, the action uses Claude Code CLI to:
1. Read .pen file structure via `batch_get` MCP tool
2. Generate screenshots via `get_screenshot` MCP tool

Required setup in GitHub Actions runner:
```yaml
- name: Install Claude Code
  run: npm install -g @anthropic-ai/claude-code

- name: Authenticate Claude
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: claude auth login --api-key
```

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run package      # Bundle with ncc
npm run all          # Build + package
npm test            # Run tests
npm run lint        # Run ESLint
```

## Implementation Status

- [x] Project setup (package.json, tsconfig, action.yml)
- [x] Type definitions (src/types.ts)
- [x] Config handling (src/config.ts)
- [x] .pen file parser (src/pen-parser.ts)
- [x] GitHub file detection (src/github/files.ts)
- [x] Metadata renderer (src/renderers/metadata.ts)
- [x] Comment builder (src/comment-builder.ts)
- [x] PR comment integration (src/github/comments.ts)
- [x] Claude CLI renderer (src/renderers/claude.ts)
- [x] Artifact upload (src/github/artifacts.ts)
- [x] Main entry point (src/main.ts)
- [x] Build & package working (dist/index.js)
- [x] Documentation (README.md)
- [x] Example workflows (.github/workflows/)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Real-world testing with actual .pen files

## Future Enhancements (v2)

- Visual diff support (before/after comparison)
- Frame-level change detection
- Slack/Discord notifications
- Custom comment templates

## Usage Example

```yaml
name: Design Review
on:
  pull_request:
    paths: ['**/*.pen']

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
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}  # Optional
```

## Important Notes

- `.pen` files are JSON-based and can be parsed directly for metadata
- For visual rendering (actual screenshots), Claude Code CLI + Pencil MCP is required
- Metadata mode parses the JSON structure directly without rendering images
- The action auto-installs Claude Code CLI if not present when using visual mode

## Known Limitations / TODO

1. **Claude CLI Integration**: The Claude CLI renderer needs real-world testing. The prompt-based approach for screenshot generation may need refinement.

2. **Large Files**: For .pen files with many frames, consider the `max-frames-per-file` limit to avoid timeouts.

3. **Error Handling**: While basic error handling exists, edge cases with malformed .pen files need more testing.

## Testing Workflow

**Live Test PR**: https://github.com/RemoteState/pencil-actions/pull/1 (DO NOT MERGE)

To test changes:
```bash
# 1. Make changes on main
git checkout main
# ... edit files ...
npm run build && npm run package
git add . && git commit -m "Your changes"
git push origin main

# 2. Update v1 tag
git tag -f v1 && git push origin v1 --force

# 3. Trigger test run by updating test branch
git checkout test/design-update
git rebase main
git push --force

# 4. Check results
gh pr checks 1
gh pr view 1 --comments
```

## Testing Checklist

To fully test this action:
1. ~~Create a test repository with sample .pen files~~ (use PR #1)
2. ~~Open a PR with .pen file changes~~ (PR #1 is always open)
3. Verify metadata mode works (no API key)
4. Test visual mode with ANTHROPIC_API_KEY secret
5. Verify PR comments are posted/updated correctly
6. Check artifact uploads
