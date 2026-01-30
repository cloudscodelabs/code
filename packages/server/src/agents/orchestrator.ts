import { query } from '@anthropic-ai/claude-code';
import type { Query, SDKMessage, Options } from '@anthropic-ai/claude-code';
import Anthropic from '@anthropic-ai/sdk';
import { createProjectSettingsMcpServer } from './project-settings-mcp.js';
import type { WebSocket } from 'ws';
import type { Project, AgentType, AgentContextSection, ProjectMetadata, StoredMessage } from '@cloudscode/shared';
import type { Config } from '../config.js';
import { getAgentManager } from './agent-manager.js';
import { createHooksConfig } from './hooks.js';
import { getContextManager } from '../context/context-manager.js';
import { getSummaryCache } from '../context/summary-cache.js';
import { getKnowledgeExtractor, type ExtractionComplexity } from '../context/knowledge-extractor.js';
import { getProjectManager } from '../projects/project-manager.js';
import { getAuthInfo, hasValidAuth } from '../auth/api-key-provider.js';
import { getProjectsRootDir } from '../projects/directory-manager.js';
import { broadcast, sendTo } from '../ws.js';
import { logger } from '../logger.js';
import { runSubAgent, type SubAgentPlan, type SubAgentResult } from './sub-agent-runner.js';
import { agentDefinitions } from './agent-definitions.js';
import { MAX_ROUTING_HISTORY_MESSAGES, MAX_ROUTING_MESSAGE_LENGTH } from '@cloudscode/shared';

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SETTINGS_TOOLS_PROMPT = `

## Project Settings Tools

You have access to project settings tools via the project-settings MCP server. Use them proactively to persist project decisions as the user discusses them.

### Available Tools
- **get_project_settings**: Read current settings. Provide a category name or omit to get all.
- **update_project_settings**: Update a metadata category with merge/replace/remove modes.
- **set_project_info**: Update top-level fields (title, description, purpose, primaryLanguage, architecturePattern).

### Category Mapping Guide
- Framework/library choices → techStack (role: "framework", "library", "runtime", "build tool", etc.)
- Package manager (npm/pnpm/yarn/bun) → packageManager
- Monorepo tool → monorepoTool
- Commit conventions → git (commitConvention: "conventional" | "angular" | "gitmoji" | "freeform")
- Branch naming → git (branchNamingPattern)
- Linters/formatters → linting
- Test frameworks → testing
- Database choices → databases
- API style decisions → apiEndpoints
- Deployment/infra → environments, ciCd, infraAsCode
- Coding rules → codingStandards
- File naming → namingConventions
- Error handling patterns → errorHandling
- Logging framework → logging
- Auth decisions → security
- Architecture style → set_project_info (architecturePattern) or designPatterns
- Project language → set_project_info (primaryLanguage)
- Build tools → build
- Key libraries → keyDependencies

### Behavior
- When the user mentions a technology decision, proactively update settings without being asked.
- Read settings first (get_project_settings) when you need context about what's already configured.
- Use merge mode by default to add new items alongside existing ones.
- Use remove mode when the user says to stop using or remove something.
- Use replace mode only when the user wants to completely overwrite a category.
- Keep confirmations brief: "Updated tech stack" not a paragraph.
- Do NOT ask for confirmation before updating settings — just do it as part of the natural conversation.`;

const SETUP_SYSTEM_PROMPT = `You are a friendly project setup assistant. Your job is to guide the user through setting up a new project by asking a few quick questions. Keep it conversational and brief.

## Setup Flow

Ask these questions **one at a time**, waiting for the user's response before moving to the next:

1. **Project basics**: Ask for a project name (required), brief description, and purpose. Use the \`set_project_info\` tool to save the answers.

2. **Project directory**: Ask how they want to set up the project directory:
   - **Create new**: Create a fresh directory (use \`setup_project_directory\` with mode "create")
   - **Clone a repo**: Clone from a Git URL (use \`setup_project_directory\` with mode "clone")
   - **Use existing**: Point to an existing directory on disk (use \`setup_project_directory\` with mode "existing")
   {{ROOT_DIR_INFO}}

3. **Tech stack**: Ask about the project's technology choices in one broad question: language, frameworks, databases, testing, package manager, build tools, and linting/formatting. Parse all mentions from the user's response and save EVERY technology immediately:
   - Primary language & architecture → \`set_project_info\` (primaryLanguage, architecturePattern)
   - Frameworks & libraries → \`update_project_settings(category: "techStack")\` with role "framework", "library", "runtime", etc.
   - Databases (e.g. PostgreSQL, MongoDB, Redis) → \`update_project_settings(category: "databases")\`
   - Package manager (npm/pnpm/yarn/bun) → \`update_project_settings(category: "packageManager")\`
   - Build tools (Vite, Webpack, esbuild, etc.) → \`update_project_settings(category: "build")\`
   - Testing frameworks (Jest, Vitest, Playwright, etc.) → \`update_project_settings(category: "testing")\`
   - Linters/formatters (ESLint, Prettier, Biome, etc.) → \`update_project_settings(category: "linting")\`
   Save EVERY technology mentioned using the appropriate tool and category immediately. Don't ask for confirmation — just save them.

4. **Conventions & standards**: Suggest sensible defaults based on the tech stack from step 3, and ask the user to accept, modify, or skip. Cover:
   - Naming conventions (e.g. camelCase for variables, PascalCase for components, kebab-case for files) → \`update_project_settings(category: "namingConventions")\`
   - Coding standards (e.g. "prefer const over let", "use async/await over raw promises") → \`update_project_settings(category: "codingStandards")\`
   - Git conventions (commit style: conventional/angular/gitmoji/freeform, branch naming pattern, default branch) → \`update_project_settings(category: "git")\`
   - Error handling patterns → \`update_project_settings(category: "errorHandling")\`
   Present 3-5 suggested defaults as a short list the user can accept with "looks good" or modify. Save immediately after the user responds.

5. **AI preferences** (optional): Ask if they have any preferences for how the AI assistant should work with their code (coding style, things to avoid, focus areas). Save with \`update_project_settings\` using the "ai" category.

6. **Complete**: When done (or if the user says "skip" at any point), call \`complete_project_setup\`.

## Rules
- Ask **one question at a time** — don't overwhelm the user.
- Keep responses short (2-3 sentences max per question).
- If the user says "skip" or wants to skip remaining questions, immediately call \`complete_project_setup\`.
- Save answers immediately using the appropriate tools — don't wait until the end.
- Start with a brief welcome message and the first question.`;

// ---------------------------------------------------------------------------
// Setup progress — builds context-aware progress for setup resumption
// ---------------------------------------------------------------------------

function buildSetupProgress(project: Project, metadata: ProjectMetadata, messages: StoredMessage[]): string {
  const progressLines: string[] = [];

  const step1Done = !!(project.title || project.description || project.purpose);
  const step2Done = !!project.directoryPath;
  const step3Done = !!(project.primaryLanguage || (metadata.techStack && metadata.techStack.length > 0));
  const step4Done = !!((metadata.namingConventions && metadata.namingConventions.length > 0) || (metadata.codingStandards && metadata.codingStandards.length > 0) || metadata.git);
  const step5Done = !!metadata.ai;

  if (step1Done) {
    progressLines.push(`- Step 1 (Project basics): DONE — name: "${project.title ?? ''}", description: "${project.description ?? ''}", purpose: "${project.purpose ?? ''}"`);
  }
  if (step2Done) {
    progressLines.push(`- Step 2 (Project directory): DONE — ${project.directoryPath}`);
  }
  if (step3Done) {
    progressLines.push(`- Step 3 (Tech stack): DONE — language: "${project.primaryLanguage ?? ''}", techStack: ${JSON.stringify(metadata.techStack ?? [])}, databases: ${JSON.stringify(metadata.databases ?? [])}`);
  }
  if (step4Done) {
    progressLines.push(`- Step 4 (Conventions): DONE — namingConventions: ${JSON.stringify(metadata.namingConventions ?? [])}, codingStandards: ${JSON.stringify(metadata.codingStandards ?? [])}, git: ${JSON.stringify(metadata.git ?? null)}`);
  }
  if (step5Done) {
    progressLines.push(`- Step 5 (AI preferences): DONE — ${JSON.stringify(metadata.ai)}`);
  }

  let progressSection = '';

  if (progressLines.length > 0) {
    const nextStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : !step4Done ? 4 : !step5Done ? 5 : 6;
    progressSection += `\n\n## Progress So Far\n${progressLines.join('\n')}\n\n`;
    if (nextStep <= 5) {
      progressSection += `Resume from step ${nextStep}. Do NOT re-ask completed questions. Do NOT repeat the welcome message.\n`;
    } else {
      progressSection += `All questions answered. Call \`complete_project_setup\` to finish.\n`;
    }
  }

  // Include conversation history so the AI can continue naturally even without session resume
  if (messages.length > 0) {
    const historyLines = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    progressSection += `\n\n## Previous Conversation\n${historyLines}\n\nContinue naturally from where the conversation left off.\n`;
  }

  return progressSection;
}

// ---------------------------------------------------------------------------
// Routing prompt — minimal context for Phase 1
// ---------------------------------------------------------------------------

function buildRoutingPrompt(project: Project, chatHistory?: StoredMessage[]): string {
  const agentDescriptions = Object.values(agentDefinitions)
    .map((d) => `- **${d.type}**: ${d.description}`)
    .join('\n');

  let historySection = '';
  if (chatHistory && chatHistory.length > 0) {
    const truncated = chatHistory.map((m) => {
      const content = m.content.length > MAX_ROUTING_MESSAGE_LENGTH
        ? m.content.slice(0, MAX_ROUTING_MESSAGE_LENGTH) + '...'
        : m.content;
      return `${m.role}: ${content}`;
    }).join('\n');
    historySection = `\n\n## Recent Conversation\n${truncated}\n\nWhen the user refers to previous discussion, use the conversation above to understand what they mean.`;
  }

  return `You are a routing agent for the project "${project.title ?? 'Untitled'}".
Project purpose: ${project.purpose ?? 'General development'}

Your job is to analyze the user's message and decide how to handle it.

## Available Sub-Agents
${agentDescriptions}
${historySection}

## Routing Rules
- For simple greetings, conversational messages, or questions you can answer from the project context alone, respond directly.
- For tasks requiring code reading, analysis, search, or exploration: delegate to code-analyst.
- For tasks requiring code writing, editing, file creation, or modifications: delegate to implementer.
- For tasks requiring running tests or analyzing test output: delegate to test-runner.
- For tasks requiring web research, documentation lookup, or external information: delegate to researcher.
- For complex tasks needing multiple steps, delegate to multiple agents in sequence.
- When delegating, provide a clear, specific task description for each agent. Include any relevant context from the user's message.
- CRITICAL: If the user's message is a short reference (e.g. "do it", "go ahead", "execute"), expand the task description to include the FULL context from the recent conversation. The sub-agent will NOT see the conversation history — it only sees the task description you write.

## Response Format
You MUST respond with valid JSON in one of these formats:

**Direct response** (no agents needed):
\`\`\`json
{"directResponse": "Your response text here"}
\`\`\`

**Delegate to agents** (tools needed):
\`\`\`json
{
  "agents": [
    {"agentType": "code-analyst", "taskDescription": "Detailed task for the agent..."},
    {"agentType": "implementer", "taskDescription": "Detailed task for the agent..."}
  ],
  "synthesisHint": "Brief note on how to combine results for the user"
}
\`\`\`

Respond ONLY with JSON. No other text.`;
}

// ---------------------------------------------------------------------------
// Synthesis prompt — combines sub-agent results
// ---------------------------------------------------------------------------

function buildSynthesisPrompt(
  project: Project,
  userMessage: string,
  results: SubAgentResult[],
  synthesisHint: string,
): string {
  const resultSections = results
    .map((r, i) => `### ${r.agentType} (${r.status})\n${r.responseText || '(no output)'}`)
    .join('\n\n');

  return `You are synthesizing results from sub-agents for the project "${project.title ?? 'Untitled'}".

The user asked: "${userMessage}"

## Sub-Agent Results
${resultSections}

## Synthesis Instructions
${synthesisHint || 'Combine the results into a clear, coherent response for the user.'}

Provide a concise, helpful response that addresses the user's original request. Reference specific findings from the agents. Do not mention the agents themselves — just present the information naturally.`;
}

// ---------------------------------------------------------------------------
// Model name → full model ID map
// ---------------------------------------------------------------------------

const MODEL_MAP: Record<string, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-20250514',
  haiku: 'claude-haiku-4-20250514',
};

function resolveModelId(shortName?: string): string {
  return MODEL_MAP[shortName ?? 'sonnet'] ?? MODEL_MAP.sonnet;
}

// ---------------------------------------------------------------------------
// Routing response types
// ---------------------------------------------------------------------------

interface DirectRouteResponse {
  directResponse: string;
}

interface DelegateRouteResponse {
  agents: Array<{
    agentType: Exclude<AgentType, 'orchestrator'>;
    taskDescription: string;
  }>;
  synthesisHint?: string;
}

type RouteResponse = DirectRouteResponse | DelegateRouteResponse;

function isDirectResponse(r: RouteResponse): r is DirectRouteResponse {
  return 'directResponse' in r;
}

// ---------------------------------------------------------------------------
// Orchestrator class
// ---------------------------------------------------------------------------

class Orchestrator {
  private config: Config;
  private currentProject: Project | null = null;
  private currentQuery: Query | null = null;
  private abortController: AbortController | null = null;
  private currentAgentNodeId: string | null = null;
  private anthropic: Anthropic | null = null;
  private subAgentAbortControllers = new Map<string, AbortController>();

  constructor(config: Config) {
    this.config = config;
  }

  getCurrentAgentNodeId(): string | null {
    return this.currentAgentNodeId;
  }

  setProject(project: Project): void {
    this.currentProject = project;
    logger.info({ projectId: project.id }, 'Orchestrator project set');
  }

  getProject(): Project | null {
    return this.currentProject;
  }

  private getAnthropicClient(): Anthropic {
    if (!this.anthropic) {
      const auth = getAuthInfo();
      this.anthropic = new Anthropic({
        apiKey: auth.token ?? undefined,
      });
    }
    return this.anthropic;
  }

  async handleMessage(content: string, ws: WebSocket, messageOpts?: { persist?: boolean; model?: string }): Promise<void> {
    const persist = messageOpts?.persist !== false;
    const model = messageOpts?.model ?? 'sonnet';

    if (!hasValidAuth()) {
      sendTo(ws, {
        type: 'chat:error',
        payload: { message: 'Not authenticated. Please sign in with your Anthropic account.' },
      });
      return;
    }

    if (!this.currentProject) {
      sendTo(ws, {
        type: 'chat:error',
        payload: { message: 'No active project. Create or resume a project first.' },
      });
      return;
    }

    const project = this.currentProject;
    const isSetupMode = !project.setupCompleted;

    // Persist the user message (unless suppressed for auto-trigger)
    const projectManager = getProjectManager();
    if (persist) {
      projectManager.addMessage(project.id, 'user', content);
    }

    if (isSetupMode) {
      return this.handleSetupMode(content, ws, project, model);
    }

    return this.handleNormalMode(content, ws, project, model);
  }

  // =========================================================================
  // SETUP MODE — unchanged, uses query() with settings MCP
  // =========================================================================

  private async handleSetupMode(content: string, ws: WebSocket, project: Project, model: string): Promise<void> {
    const agentManager = getAgentManager();
    const projectManager = getProjectManager();

    // Create orchestrator agent node for tracking
    const orchestratorNode = agentManager.createAgent(project.id, 'orchestrator', null, null, model);
    this.currentAgentNodeId = orchestratorNode.id;

    const rootDir = getProjectsRootDir();
    const rootDirInfo = rootDir
      ? `The projects root directory is configured as: ${rootDir}`
      : 'No projects root directory is configured yet. The user can set one in Settings, or the directory can be set to any absolute path.';

    // Build context-aware system prompt with progress tracking
    const refreshedProject = projectManager.getProject(project.id);
    const meta = (projectManager.getProjectMetadata(project.id) ?? {}) as ProjectMetadata;
    const messages = projectManager.getMessages(project.id);
    const progressSection = buildSetupProgress(refreshedProject ?? project, meta, messages);

    const systemPrompt = SETUP_SYSTEM_PROMPT.replace('{{ROOT_DIR_INFO}}', rootDirInfo) + progressSection + SETTINGS_TOOLS_PROMPT;

    this.abortController = new AbortController();

    const sdkSessionId = projectManager.getSdkSessionId(project.id);
    const settingsMcp = createProjectSettingsMcpServer(project.id);

    const buildOptions = (resumeId?: string): Options => ({
      abortController: this.abortController!,
      customSystemPrompt: systemPrompt,
      cwd: project.directoryPath ?? this.config.PROJECT_ROOT,
      permissionMode: 'bypassPermissions',
      model: model as any,
      maxTurns: 30,
      hooks: createHooksConfig(),
      includePartialMessages: true,
      env: this.buildEnv(),
      mcpServers: {
        'project-settings': settingsMcp,
      },
      ...(resumeId ? { resume: resumeId } : {}),
      stderr: (data: string) => {
        logger.warn({ stderr: data.trim() }, 'Claude Code subprocess stderr');
      },
    });

    try {
      // Try with session resumption first; if it fails (stale session), retry without
      const err1 = await this.runSetupQuery(
        content,
        buildOptions(sdkSessionId ?? undefined),
        orchestratorNode.id,
        project,
        ws,
      );

      if (err1 && sdkSessionId) {
        const errMsg = err1 instanceof Error ? err1.message : String(err1);
        logger.warn({ sdkSessionId, err: errMsg }, 'SDK session resume failed, retrying without resume');
        projectManager.setSdkSessionId(project.id, '');

        // Reset abort controller for fresh attempt
        this.abortController = new AbortController();

        const err2 = await this.runSetupQuery(
          content,
          buildOptions(),
          orchestratorNode.id,
          project,
          ws,
        );

        if (err2) {
          throw err2;
        }
      } else if (err1) {
        throw err1;
      }
    } catch (err) {
      logger.error({ err }, 'Setup query error');
      agentManager.updateAgentStatus(orchestratorNode.id, 'failed');
      sendTo(ws, {
        type: 'chat:error',
        payload: { message: err instanceof Error ? err.message : 'Query failed', channel: 'setup' },
      });
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Runs the setup query and processes messages. Returns null on success
   * or the error if the query fails.
   */
  private async runSetupQuery(
    content: string,
    options: Options,
    orchestratorNodeId: string,
    project: Project,
    ws: WebSocket,
  ): Promise<Error | null> {
    const agentManager = getAgentManager();
    const projectManager = getProjectManager();

    try {
      this.currentQuery = query({ prompt: content, options });
      let fullResponse = '';
      let capturedSdkSessionId = false;

      for await (const message of this.currentQuery) {
        this.processMessage(message, orchestratorNodeId, ws, 'setup');

        if (!capturedSdkSessionId && (message as any).session_id) {
          const newSdkId = (message as any).session_id;
          if (newSdkId) {
            projectManager.setSdkSessionId(project.id, newSdkId);
            logger.info({ projectId: project.id, sdkSessionId: newSdkId }, 'SDK session ID captured');
          }
          capturedSdkSessionId = true;
        }

        if (message.type === 'assistant' && message.message.content) {
          for (const block of message.message.content) {
            if (block.type === 'text') {
              fullResponse += block.text;
            }
          }
        }

        if (message.type === 'result') {
          const result = message as any;

          if (!capturedSdkSessionId && result.session_id) {
            projectManager.setSdkSessionId(project.id, result.session_id);
            capturedSdkSessionId = true;
          }

          if (result.subtype === 'success') {
            agentManager.setAgentResponse(orchestratorNodeId, fullResponse);
            agentManager.updateAgentStatus(orchestratorNodeId, 'completed', result.result);
            agentManager.updateAgentCost(
              orchestratorNodeId,
              result.total_cost_usd ?? 0,
              result.usage?.input_tokens ?? 0,
            );

            if (fullResponse) {
              projectManager.addMessage(project.id, 'assistant', fullResponse, orchestratorNodeId);
            }

            const refreshed = projectManager.getProject(project.id);
            if (refreshed) this.currentProject = refreshed;
          } else {
            agentManager.updateAgentStatus(orchestratorNodeId, 'failed');
            if (fullResponse) {
              projectManager.addMessage(project.id, 'assistant', fullResponse, orchestratorNodeId);
            }
          }
        }
      }

      return null;
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  }

  // =========================================================================
  // NORMAL MODE — 3-phase boss-style delegation
  // =========================================================================

  private async handleNormalMode(content: string, ws: WebSocket, project: Project, model: string): Promise<void> {
    const agentManager = getAgentManager();
    const contextManager = getContextManager();
    const summaryCache = getSummaryCache();
    const projectManager = getProjectManager();

    // Create orchestrator agent node for tracking
    const orchestratorNode = agentManager.createAgent(project.id, 'orchestrator', null, null, model);
    this.currentAgentNodeId = orchestratorNode.id;

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // =====================================================================
      // Phase 1: Route — Direct API call with minimal context
      // =====================================================================
      logger.info({ projectId: project.id }, 'Phase 1: Routing');

      // Fetch recent chat history for routing context
      const recentMessages = projectManager.getRecentMessages(project.id, MAX_ROUTING_HISTORY_MESSAGES);

      // Broadcast orchestrator context sections to the UI
      const routingPrompt = buildRoutingPrompt(project, recentMessages);
      const chatHistoryContent = recentMessages.length > 0
        ? recentMessages.map((m) => `${m.role}: ${m.content.slice(0, MAX_ROUTING_MESSAGE_LENGTH)}`).join('\n')
        : null;
      const orchestratorSections: AgentContextSection[] = [
        { name: 'System Prompt', included: true, content: routingPrompt },
        { name: 'Task', included: true, content: content },
        { name: 'Chat History', included: recentMessages.length > 0, content: chatHistoryContent },
      ];
      broadcast({
        type: 'agent:context',
        payload: {
          agentId: orchestratorNode.id,
          sections: orchestratorSections,
        },
      });

      const routeResponse = await this.routeMessage(content, project, recentMessages, signal, model);

      if (signal.aborted) {
        agentManager.updateAgentStatus(orchestratorNode.id, 'interrupted');
        return;
      }

      // =====================================================================
      // Direct response — no agents needed
      // =====================================================================
      if (isDirectResponse(routeResponse)) {
        const responseText = routeResponse.directResponse;

        // Stream the response
        broadcast({
          type: 'chat:message',
          payload: {
            role: 'assistant',
            content: responseText,
            agentId: orchestratorNode.id,
            timestamp: Date.now(),
          },
        });

        agentManager.setAgentResponse(orchestratorNode.id, responseText);
        agentManager.updateAgentStatus(orchestratorNode.id, 'completed', responseText.slice(0, 500));

        // Persist the response
        projectManager.addMessage(project.id, 'assistant', responseText, orchestratorNode.id);

        // Update summary
        summaryCache.updateFromResponse(project.id, content, responseText);

        return;
      }

      // =====================================================================
      // Phase 2: Execute — Run sub-agents sequentially
      // =====================================================================
      logger.info({ projectId: project.id, agentCount: routeResponse.agents.length }, 'Phase 2: Executing sub-agents');

      const cwd = project.directoryPath ?? this.config.PROJECT_ROOT;
      const results: SubAgentResult[] = [];

      for (const agentPlan of routeResponse.agents) {
        if (signal.aborted) {
          break;
        }

        const plan: SubAgentPlan = {
          agentType: agentPlan.agentType,
          taskDescription: agentPlan.taskDescription,
          model,
        };

        // Pre-create agent node and per-agent abort controller
        const preCreatedAgentNode = agentManager.createAgent(
          project.id,
          plan.agentType,
          orchestratorNode.id,
          plan.taskDescription,
          plan.model ?? null,
        );
        const agentAbortController = new AbortController();
        this.subAgentAbortControllers.set(preCreatedAgentNode.id, agentAbortController);

        const result = await runSubAgent(plan, project, orchestratorNode.id, signal, cwd, {
          preCreatedAgentNode,
          agentAbortController,
        });

        this.subAgentAbortControllers.delete(preCreatedAgentNode.id);
        results.push(result);

        // If the global signal was aborted, stop processing all agents
        if (signal.aborted) {
          break;
        }

        // If just this agent was interrupted, continue to the next one
        if (result.status === 'interrupted') {
          continue;
        }
      }

      if (signal.aborted) {
        agentManager.updateAgentStatus(orchestratorNode.id, 'interrupted');
        // Still persist partial results
        const partialResponse = results
          .filter((r) => r.responseText)
          .map((r) => r.responseText)
          .join('\n\n');
        if (partialResponse) {
          projectManager.addMessage(project.id, 'assistant', partialResponse, orchestratorNode.id);
        }
        return;
      }

      // =====================================================================
      // Phase 3: Synthesize — Combine results (skip if single agent)
      // =====================================================================
      let finalResponse: string;

      const successfulResults = results.filter((r) => r.responseText);

      if (successfulResults.length === 0) {
        finalResponse = 'I was unable to complete the requested task. The sub-agents did not produce output.';
      } else if (successfulResults.length === 1) {
        // Single agent — use its output directly, no synthesis needed
        finalResponse = successfulResults[0].responseText;
      } else {
        // Multiple agents — synthesize results
        logger.info({ projectId: project.id }, 'Phase 3: Synthesizing results');

        finalResponse = await this.synthesizeResults(
          content,
          project,
          successfulResults,
          routeResponse.synthesisHint ?? '',
          signal,
          model,
        );

        if (signal.aborted) {
          agentManager.updateAgentStatus(orchestratorNode.id, 'interrupted');
          return;
        }

        // Broadcast synthesized response
        broadcast({
          type: 'chat:message',
          payload: {
            role: 'assistant',
            content: finalResponse,
            agentId: orchestratorNode.id,
            timestamp: Date.now(),
          },
        });
      }

      // =====================================================================
      // Post-processing
      // =====================================================================

      // Aggregate costs from sub-agents
      const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
      const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);

      agentManager.updateAgentCost(orchestratorNode.id, totalCost, totalTokens);
      agentManager.setAgentResponse(orchestratorNode.id, finalResponse);
      agentManager.updateAgentStatus(orchestratorNode.id, 'completed', finalResponse.slice(0, 500));

      // Update context budget
      contextManager.updateBudget(project.id, {
        inputTokens: totalTokens,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUsd: totalCost,
      });

      // Update summary
      summaryCache.updateFromResponse(project.id, content, finalResponse);

      // Persist the final response
      projectManager.addMessage(project.id, 'assistant', finalResponse, orchestratorNode.id);

      // Refresh project state in case settings tools updated it
      const refreshed = projectManager.getProject(project.id);
      if (refreshed) this.currentProject = refreshed;

      // Extract knowledge in background
      if (finalResponse.length > 100) {
        const complexity: ExtractionComplexity =
          finalResponse.length > 3000 ? 'medium' : 'low';
        getKnowledgeExtractor().extract(project.workspaceId, project.id, finalResponse, complexity).catch((err) => {
          logger.error({ err }, 'Knowledge extraction failed');
        });
      }
    } catch (err) {
      logger.error({ err }, 'Orchestrator error');
      agentManager.updateAgentStatus(orchestratorNode.id, 'failed');
      sendTo(ws, {
        type: 'chat:error',
        payload: { message: err instanceof Error ? err.message : 'Query failed' },
      });
    } finally {
      this.abortController = null;
      this.subAgentAbortControllers.clear();
    }
  }

  // =========================================================================
  // Phase 1: Route — Direct Anthropic API call
  // =========================================================================

  private async routeMessage(content: string, project: Project, chatHistory: StoredMessage[], signal: AbortSignal, model: string = 'sonnet'): Promise<RouteResponse> {
    const client = this.getAnthropicClient();
    const routingPrompt = buildRoutingPrompt(project, chatHistory);

    try {
      const response = await client.messages.create({
        model: resolveModelId(model),
        max_tokens: 1024,
        system: routingPrompt,
        messages: [{ role: 'user', content }],
      });

      if (signal.aborted) {
        return { directResponse: '' };
      }

      // Extract text from response
      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      // Parse JSON from response (may be wrapped in markdown code block)
      const jsonStr = responseText.replace(/```json\s*\n?/g, '').replace(/```\s*$/g, '').trim();
      const parsed = JSON.parse(jsonStr) as RouteResponse;

      // Validate the response
      if (isDirectResponse(parsed)) {
        return parsed;
      }

      // Validate agent types
      const validTypes = new Set<string>(['code-analyst', 'implementer', 'test-runner', 'researcher']);
      const validatedAgents = parsed.agents.filter((a) => validTypes.has(a.agentType));

      if (validatedAgents.length === 0) {
        // Fallback to direct response if no valid agents
        return { directResponse: responseText };
      }

      return {
        agents: validatedAgents,
        synthesisHint: parsed.synthesisHint,
      };
    } catch (err) {
      logger.error({ err }, 'Routing API call failed');

      // Fallback: treat as a direct response
      // If routing fails, delegate to a code-analyst as a safe default
      return {
        agents: [{
          agentType: 'code-analyst',
          taskDescription: content,
        }],
      };
    }
  }

  // =========================================================================
  // Phase 3: Synthesize — Direct Anthropic API call
  // =========================================================================

  private async synthesizeResults(
    userMessage: string,
    project: Project,
    results: SubAgentResult[],
    synthesisHint: string,
    signal: AbortSignal,
    model: string = 'sonnet',
  ): Promise<string> {
    const client = this.getAnthropicClient();
    const prompt = buildSynthesisPrompt(project, userMessage, results, synthesisHint);

    try {
      const response = await client.messages.create({
        model: resolveModelId(model),
        max_tokens: 4096,
        system: 'You synthesize results from development agents into clear, helpful responses.',
        messages: [{ role: 'user', content: prompt }],
      });

      if (signal.aborted) {
        return results.map((r) => r.responseText).join('\n\n');
      }

      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      return responseText || results.map((r) => r.responseText).join('\n\n');
    } catch (err) {
      logger.error({ err }, 'Synthesis API call failed');
      // Fallback: concatenate sub-agent results
      return results.map((r) => `## ${r.agentType}\n${r.responseText}`).join('\n\n');
    }
  }

  // =========================================================================
  // Shared helpers
  // =========================================================================

  private processMessage(message: SDKMessage, orchestratorId: string, ws: WebSocket, channel?: 'setup' | 'chat'): void {
    switch (message.type) {
      case 'stream_event': {
        const event = (message as any).event;
        if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
          broadcast({
            type: 'chat:token',
            payload: {
              token: event.delta.text,
              agentId: orchestratorId,
              ...(channel ? { channel } : {}),
            },
          });
        }
        break;
      }

      case 'assistant': {
        const assistantMsg = message as any;
        let textContent = '';
        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            if (block.type === 'text') {
              textContent += block.text;
            }
          }
        }
        if (textContent) {
          broadcast({
            type: 'chat:message',
            payload: {
              role: 'assistant',
              content: textContent,
              agentId: orchestratorId,
              timestamp: Date.now(),
              ...(channel ? { channel } : {}),
            },
          });
        }
        break;
      }

      case 'system': {
        logger.debug({ subtype: (message as any).subtype }, 'System message');
        break;
      }
    }
  }

  private buildEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }

    const auth = getAuthInfo();
    if (auth.type === 'api_key' && auth.token) {
      env.ANTHROPIC_API_KEY = auth.token;
    }

    return env;
  }

  interrupt(): void {
    if (this.abortController) {
      this.abortController.abort();
      logger.info('Query interrupted');
    }
  }

  interruptAgent(agentId: string): boolean {
    const controller = this.subAgentAbortControllers.get(agentId);
    if (controller) {
      controller.abort();
      this.subAgentAbortControllers.delete(agentId);
      logger.info({ agentId }, 'Individual agent interrupted');
      return true;
    }

    // No active controller — process already finished or was cleaned up.
    // Re-broadcast agent status to resync the UI.
    const agentManager = getAgentManager();
    const agent = agentManager.getAgent(agentId);
    if (agent) {
      if (agent.status === 'running') {
        agentManager.updateAgentStatus(agentId, 'interrupted');
      } else {
        // Agent already finished — re-broadcast current status to fix UI desync
        broadcast({ type: 'agent:stopped', payload: agent });
      }
      logger.info({ agentId, status: agent.status }, 'Agent interrupt handled (no active controller)');
      return true;
    }

    return false;
  }
}

let orchestrator: Orchestrator;

export function initOrchestrator(config: Config): Orchestrator {
  orchestrator = new Orchestrator(config);
  return orchestrator;
}

export function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    throw new Error('Orchestrator not initialized');
  }
  return orchestrator;
}
