# Contributing to Harness Pulse

## Adding a New Tool

Edit `src/config.js` and add an entry to the `tools` array:

```javascript
{
  name: 'Tool Name',           // Display name
  slug: 'tool-name',           // URL-safe identifier (unique)
  category: 'terminal-agent',  // terminal-agent | ide-extension | ai-ide | personal-agent
  vendor: 'Company Name',
  github: { owner: 'org', repo: 'repo' },  // or null if closed-source
  npm: 'package-name',         // npm package name, or null
  pypi: 'package-name',        // PyPI package name, or null
  vscode: 'publisher.extension-id',  // VS Code marketplace ID, or null
  website: 'https://...',
  openrouter_app_slug: null,   // OpenRouter app slug, or null
  color: '#RRGGBB'             // Brand color for charts
}
```

**Verification required**: Before submitting, verify every identifier exists:
- GitHub: `curl https://api.github.com/repos/owner/repo`
- npm: `curl https://registry.npmjs.org/package-name`
- PyPI: `curl https://pypi.org/pypi/package-name/json`
- VS Code: search at https://marketplace.visualstudio.com

Set identifiers to `null` if they don't exist — do not guess.

## Running Locally

```bash
cp .env.example .env
# Fill in GITHUB_TOKEN at minimum
npm install
node src/run-once.js
open site/index.html
```

## Pull Requests

- One tool per PR for registry additions
- Include verification evidence in the PR description
- Pipeline changes need a test run before merging
