'use strict';

module.exports = {
  tools: [
    // === TIER 1: FRONTIER AGENTS (terminal/CLI-native) ===
    {
      name: 'Claude Code',
      slug: 'claude-code',
      category: 'terminal-agent',
      vendor: 'Anthropic',
      github: { owner: 'anthropics', repo: 'claude-code' },
      npm: '@anthropic-ai/claude-code',
      pypi: null,
      vscode: null,
      website: 'https://docs.anthropic.com/en/docs/claude-code',
      openrouter_app_slug: 'claude-code',
      color: '#D97706'
    },
    {
      name: 'OpenClaw',
      slug: 'openclaw',
      category: 'personal-agent',
      vendor: 'OpenClaw',
      github: { owner: 'openclaw', repo: 'openclaw' },
      npm: 'openclaw',
      pypi: null,
      vscode: null,
      website: 'https://openclaw.com',
      openrouter_app_slug: 'openclaw',
      color: '#DC2626'
    },
    {
      name: 'Hermes Agent',
      slug: 'hermes-agent',
      category: 'personal-agent',
      vendor: 'Nous Research',
      github: { owner: 'NousResearch', repo: 'hermes-agent' },
      npm: null,
      pypi: null, // Not on PyPI
      vscode: null,
      website: 'https://hermes-agent.nousresearch.com',
      openrouter_app_slug: 'hermes-agent',
      color: '#7C3AED'
    },
    {
      name: 'Codex CLI',
      slug: 'codex-cli',
      category: 'terminal-agent',
      vendor: 'OpenAI',
      github: { owner: 'openai', repo: 'codex' },
      npm: '@openai/codex',
      pypi: null,
      vscode: null,
      website: 'https://openai.com/index/codex/',
      openrouter_app_slug: null,
      color: '#10A37F'
    },
    {
      name: 'Gemini CLI',
      slug: 'gemini-cli',
      category: 'terminal-agent',
      vendor: 'Google',
      github: { owner: 'google-gemini', repo: 'gemini-cli' },
      npm: '@google/gemini-cli',
      pypi: null,
      vscode: null,
      website: 'https://github.com/google-gemini/gemini-cli',
      openrouter_app_slug: null,
      color: '#4285F4'
    },

    // === TIER 2: IDE-INTEGRATED AGENTS ===
    {
      name: 'Cursor',
      slug: 'cursor',
      category: 'ai-ide',
      vendor: 'Anysphere',
      github: null, // Closed source
      npm: null,
      pypi: null,
      vscode: null, // Standalone IDE
      website: 'https://cursor.com',
      openrouter_app_slug: null,
      color: '#6366F1'
    },
    {
      name: 'Windsurf',
      slug: 'windsurf',
      category: 'ai-ide',
      vendor: 'Codeium',
      github: null,
      npm: null,
      pypi: null,
      vscode: null,
      website: 'https://windsurf.com',
      openrouter_app_slug: null,
      color: '#06B6D4'
    },
    {
      name: 'GitHub Copilot',
      slug: 'github-copilot',
      category: 'ide-extension',
      vendor: 'GitHub/Microsoft',
      github: null,
      npm: null,
      pypi: null,
      vscode: 'GitHub.copilot',
      website: 'https://github.com/features/copilot',
      openrouter_app_slug: null,
      color: '#1F2937'
    },

    // === TIER 3: OPEN-SOURCE CLI AGENTS ===
    {
      name: 'Cline',
      slug: 'cline',
      category: 'ide-extension',
      vendor: 'Cline',
      github: { owner: 'cline', repo: 'cline' },
      npm: null,
      pypi: null,
      vscode: 'saoudrizwan.claude-dev',
      website: 'https://cline.bot',
      openrouter_app_slug: null,
      color: '#F59E0B'
    },
    {
      name: 'Aider',
      slug: 'aider',
      category: 'terminal-agent',
      vendor: 'Aider',
      github: { owner: 'Aider-AI', repo: 'aider' },
      npm: null,
      pypi: 'aider-chat',
      vscode: null,
      website: 'https://aider.chat',
      openrouter_app_slug: null,
      color: '#EF4444'
    },
    {
      name: 'Kilo Code',
      slug: 'kilo-code',
      category: 'ide-extension',
      vendor: 'Kilo Code',
      github: { owner: 'Kilo-Org', repo: 'kilocode' },
      npm: null,
      pypi: null,
      vscode: 'kilocode.Kilo-Code',
      website: 'https://kilocode.ai',
      openrouter_app_slug: 'kilo-code',
      color: '#8B5CF6'
    },
    {
      name: 'Continue',
      slug: 'continue',
      category: 'ide-extension',
      vendor: 'Continue',
      github: { owner: 'continuedev', repo: 'continue' },
      npm: null,
      pypi: null,
      vscode: 'Continue.continue',
      website: 'https://continue.dev',
      openrouter_app_slug: null,
      color: '#2563EB'
    },
    {
      name: 'Claw Code',
      slug: 'claw-code',
      category: 'terminal-agent',
      vendor: 'Claw Code Foundation',
      github: null, // repo does not exist
      npm: null,
      pypi: null, // Not found on PyPI
      vscode: null,
      website: 'https://clawcode.dev',
      openrouter_app_slug: null,
      color: '#F97316'
    },
    {
      name: 'OpenHands',
      slug: 'openhands',
      category: 'terminal-agent',
      vendor: 'All Hands AI',
      github: { owner: 'All-Hands-AI', repo: 'OpenHands' },
      npm: null,
      pypi: 'openhands-ai',
      vscode: null,
      website: 'https://www.all-hands.dev',
      openrouter_app_slug: null,
      color: '#059669'
    },

    // === TIER 4: EMERGING / NICHE ===
    {
      name: 'Roo Code',
      slug: 'roo-code',
      category: 'ide-extension',
      vendor: 'Roo Code',
      github: { owner: 'RooVetGit', repo: 'Roo-Code' },
      npm: null,
      pypi: null,
      vscode: 'RooVeterinaryInc.roo-cline',
      website: 'https://roocode.com',
      openrouter_app_slug: null,
      color: '#84CC16'
    },
    {
      name: 'ISEKAI ZERO',
      slug: 'isekai-zero',
      category: 'personal-agent',
      vendor: 'ISEKAI',
      github: null,
      npm: null,
      pypi: null,
      vscode: null,
      website: null,
      openrouter_app_slug: 'isekai-zero',
      color: '#A855F7'
    }
  ]
};
