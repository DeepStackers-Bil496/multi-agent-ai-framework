# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A production-ready multi-agent AI framework built with Next.js 15, LangGraph, and LangChain. The framework enables orchestration of specialized AI agents through a central MainAgent that routes requests based on intent. Current agents include GitHub operations, email management, web scraping, codebase analysis (RAG), and frontend customization.

## Development Commands

```bash
# Setup and run
pnpm install
pnpm db:migrate              # Setup database or apply latest migrations
pnpm dev                     # Start Next.js dev server (Turbo mode)

# Build and deploy
pnpm build                   # Runs db:migrate then builds for production
pnpm start                   # Start production server

# Code quality
pnpm lint                    # Check code quality with ultracite
pnpm format                  # Auto-fix formatting issues

# Database
pnpm db:studio              # Open Drizzle Studio for database visualization
pnpm db:generate            # Generate database migrations
pnpm db:push                # Push schema changes to database
pnpm db:pull                # Pull schema from database
pnpm db:check               # Check schema inconsistencies

# Testing
pnpm test                   # Run Playwright E2E tests (sets PLAYWRIGHT=True)
pnpm test:google-workspace  # Test Google Workspace agent with Node test runner
pnpm test:search            # Test search agent unit coverage
pnpm test:vision            # Test vision agent unit coverage
pnpm test:codebase          # Test codebase agent

# Specialized
pnpm index:codebase         # Index codebase for RAG (CodebaseAgent)
npx tsx scripts/fetch_issues.ts  # Fetch GitHub issues
```

## Architecture Essentials

### Agent Architecture Pattern

All agents follow a consistent 4-file structure in `lib/agents/<agentName>/`:

```
lib/agents/myAgent/
├── config.ts       # AgentConfig with user & implementation metadata
├── prompt.ts       # System instruction for the LLM
├── tools.ts        # DynamicStructuredTool definitions (LangChain)
└── myAgent.ts      # Agent class extending BaseAgent + registry registration
```

**BaseAgent Pattern** (`lib/agents/baseAgent.ts`):
- Abstract class that all agents extend
- Handles LLM creation (supports 6 providers: Google, OpenAI, Groq, Ollama, Anthropic, Mistral)
- Builds LangGraph StateGraph with tool execution
- Returns streaming Response with JSON-encoded events

**Agent Config Structure**:
```typescript
AgentConfig {
  user_metadata: {
    id, name, short_description, long_description,
    icon (React component), suggestedActions[]
  },
  implementation_metadata: {
    type: "api",
    provider: "google" | "openai" | "groq" | "ollama" | "anthropic" | "mistral",
    modelID: string,
    systemInstruction: string,
    apiKey?: string,
    baseURL?: string  // For vLLM/custom endpoints like Ollama+ngrok
  }
}
```

### MainAgent Orchestration

**Self-Registration Pattern** (`lib/agents/agentRegistry.ts`):
- Each agent self-registers at module load time
- Registry tracks: id, name, toolName, toolDescription, taskPrefix, instance, getCompiledGraph()
- MainAgent imports all specialized agents to trigger registration

**Dynamic Routing**:
1. MainAgent uses delegation tools (e.g., `delegate_to_github`) created from registry
2. LLM decides to answer directly or delegate to specialized agent
3. `orchestratorRoute()` inspects tool calls and routes to appropriate agent
4. Task preparation nodes extract task and prepend prefix (e.g., "[GitHub Task]")
5. Specialized agent subgraph executes (can use multiple tools)
6. Result returns to MainAgent for summarization

**Execution Flow**:
```
User Input → MainAgent → Delegation Tool Call →
Prepare Task Node → Specialized Agent Subgraph →
MainAgent (summarizes) → User
```

### Current Agents

| Agent | Purpose | Key Integration |
|-------|---------|-----------------|
| **MainAgent** | Orchestrator that routes to specialized agents | Agent Registry |
| **GitHubAgent** | GitHub operations (commits, PRs, issues, code search) | MCP Server (GitHub Copilot) |
| **EmailAgent** | Email drafting and sending with confirmation | Gemini + SMTP (Nodemailer) |
| **WebAgent** | Web scraping and content extraction | Cheerio |
| **CodebaseAgent** | Code analysis via semantic search | RAG with pgvector |
| **FrontendAgent** | UI customization (themes, colors, animations) | localStorage + React hooks |

### Streaming Architecture

**Custom JSON Event Streaming** (not using Vercel AI SDK):
- Agents return `Response` with `ReadableStream`
- Stream emits JSON-encoded events: `AGENT_STARTED`, `AGENT_STREAM`, `AGENT_ENDED`, `TOOL_STARTED`, `TOOL_ENDED`, `AGENT_ERROR`
- Events include: `{ type, payload: { name, content, id } }`
- LangGraph's `streamEvents(version: "v2")` powers streaming
- Frontend (`components/chat.tsx`) parses events and updates UI in real-time

**Execution Flow Tracking**:
- API route intercepts stream to build execution tree
- Tracks agent/tool hierarchy, timing, and status
- Persists to database after stream completes
- Visualized in `components/execution-flow.tsx` as collapsible tree

### Database Schema

**Core Tables** (`lib/db/schema.ts`):

**User & Auth**:
- `user`: id, email, password (bcrypt)

**Chat & Messages**:
- `chat`: id, createdAt, title, userId, visibility, lastContext (token usage)
- `message`: id, chatId, role, parts (JSON array), attachments, createdAt
  - Parts structure: `[{ type: "text", text: string }]` or `[{ type: "image", data: string }]`

**RAG for CodebaseAgent**:
- `codebaseEmbedding`: filePath, chunkType (function/class/method/import), chunkName, parentClass, content, startLine, endLine, embedding (vector 768), timestamps
  - HNSW index for cosine similarity search: `embedding_cosine_idx`
  - Embeddings generated via Google text-embedding-004

**Other**:
- `vote`: Message upvote/downvote
- `document`: Artifact storage (text/code/image/sheet)
- `suggestion`: Document edit suggestions
- `stream`: Resumable stream tracking (with Redis)

**Queries** (`lib/db/queries.ts`):
- Drizzle ORM with Neon serverless PostgreSQL
- Functions: saveChat, saveMessages, getChatById, getMessagesByChatId, voteMessage, etc.

### Frontend Integration

**Chat API Route** (`app/(chat)/api/chat/route.ts`):
1. POST request: `{ id, message, selectedChatModel, selectedVisibilityType }`
2. Auth check (NextAuth session)
3. Rate limiting (messages per day)
4. Chat/message persistence
5. Convert UI messages to AgentChatMessage format
6. Get agent by `selectedChatModel` (which is agentId)
7. Call `agent.instance.run(agentMessages)`
8. Stream response to client with execution flow tracking

**Chat Component** (`components/chat.tsx`):
- Custom streaming handler (not using Vercel AI SDK's useChat)
- Parses JSON events from agent stream
- Accumulates content, tracks active agents/tools
- Updates UI in real-time

**Execution Flow** (`components/execution-flow.tsx`):
- Visualizes agent/tool execution hierarchy
- Shows timing, status, nesting
- Collapsible tree view with Framer Motion animations

### Authentication

**NextAuth v5** (`app/(auth)/auth.ts`):
- Two credential providers:
  1. Regular User: Email + password (bcrypt)
  2. Guest User: Auto-generated guest account
- Session extension includes user.type ("guest" | "regular")
- JWT stores user.id and user.type for API route usage

## Adding a New Agent

Follow this checklist (detailed in `AGENT_RECOMMENDATIONS.md`):

1. **Create agent directory** with 4 files:
   ```typescript
   // lib/agents/myAgent/config.ts
   export const MyAgentConfig: AgentConfig<LLMImplMetadata> = {
     user_metadata: { id, name, short_description, long_description, icon, suggestedActions },
     implementation_metadata: { type: "api", provider, modelID, systemInstruction }
   };

   // lib/agents/myAgent/prompt.ts
   export const MY_AGENT_PROMPT = "You are a specialized agent...";

   // lib/agents/myAgent/tools.ts
   export function createMyAgentTools(): DynamicStructuredTool[] {
     return [
       new DynamicStructuredTool({
         name: "my_tool",
         description: "What this tool does",
         schema: z.object({ param: z.string() }),
         func: async ({ param }) => { /* implementation */ }
       })
     ];
   }

   // lib/agents/myAgent/myAgent.ts
   class MyAgent extends BaseAgent<LLMImplMetadata> {
     constructor(config: AgentConfig<LLMImplMetadata>, tools: DynamicStructuredTool[]) {
       super(config, tools);
     }
   }

   export const myAgent = new MyAgent(MyAgentConfig, createMyAgentTools());

   agentRegistry.register({
     id: myAgent.id,
     name: myAgent.name,
     toolName: "delegate_to_my_agent",
     toolDescription: "Use this when user wants to...",
     taskPrefix: "[MyAgent Task]",
     instance: myAgent,
     getCompiledGraph: () => myAgent.getCompiledGraph(),
   });
   ```

2. **Update MainAgent**:
   - Import in `lib/agents/mainAgent/mainAgent.ts` to trigger registration
   - Add delegation rule to MainAgent prompt (`lib/agents/mainAgent/prompt.ts`)

3. **Update UI**:
   - Add to `agentUserMetadataList` in `lib/agents/user_metadata.ts`

4. **Test**:
   - Standalone: Call agent.run() directly
   - End-to-end: Via MainAgent delegation

## Key Dependencies

- **LangGraph** (`@langchain/langgraph`): State graph orchestration
- **LangChain** (`@langchain/core`): Tools, messages, runnables
- **LLM Providers**: `@langchain/google-genai`, `@langchain/openai`, `@langchain/groq`, `@langchain/ollama`, `@langchain/anthropic`, `@langchain/mistralai`
- **Database**: `drizzle-orm` + `@neondatabase/serverless` + `postgres`
- **Auth**: `next-auth` v5
- **MCP**: `@modelcontextprotocol/sdk` (for GitHubAgent)
- **Frontend**: Next.js 15, React 19 RC, Tailwind v4, Framer Motion

## Environment Variables

**Required**:
- `POSTGRES_URL`: Neon PostgreSQL database
- `AUTH_SECRET`: NextAuth secret
- `GEMINI_API_KEY`: For MainAgent and EmailAgent (default provider)

**Optional (per agent/feature)**:
- `GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`: Alternative LLM providers
- `GITHUB_PAT`: For GitHubAgent MCP server
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `DEFAULT_FROM`: For EmailAgent
- `EMAIL_DRY_RUN`: Set to "true" to prevent real email sends (testing)
- `REDIS_URL`: For resumable streams (optional)

## Google Colab GPU Backend (Ollama + ngrok)

The framework supports using Google Colab's free GPUs as a backend for agents:

1. Get ngrok auth token from [ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken)
2. Upload `cloud-deploy/ollama/colab.py` to Google Colab
3. Run setup in Colab cell:
   ```python
   !pip install pyngrok
   !curl -fsSL https://ollama.com/install.sh | sh
   %run colab.py
   ```
4. Copy the ngrok URL (e.g., `https://xxxx.ngrok-free.app`)
5. Update agent config's `baseURL` field (e.g., in `lib/agents/githubAgent/config.ts`)

See [Quick Links](links.md) for ngrok dashboard and other resources.

## Testing

- **Playwright E2E Tests**: `tests/` directory
  - Tests for chat, artifacts, reasoning, session, routes
  - Run with `pnpm test` (sets `PLAYWRIGHT=True` env var)
- **Node Test Runner**: Email and codebase agent unit tests
  - `pnpm test:google-workspace`, `pnpm test:codebase`

## Critical Implementation Notes

### LangGraph Patterns

All agents use standard graph structure:
```typescript
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)  // Invokes LLM with tools bound
  .addNode("tools", toolNode)   // Executes tool calls
  .addEdge(START, "agent")
  .addConditionalEdges("agent", agentRoute)  // Decides tools or END
  .addEdge("tools", "agent");
```

### Tool Creation Pattern

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

new DynamicStructuredTool({
  name: "tool_name",
  description: "Detailed description for LLM to understand when to use this",
  schema: z.object({
    param1: z.string().describe("What this param does"),
    param2: z.number().optional().describe("Optional param")
  }),
  func: async ({ param1, param2 }) => {
    // Implementation
    return "Result as string";
  }
});
```

### Message Conversion

UI messages → AgentChatMessage:
```typescript
const agentMessages: AgentChatMessage[] = uiMessages.map(msg => ({
  role: msg.role === "user" ? AgentUserRole : AgentAssistantRole,
  content: extractTextFromParts(msg.parts)
}));
```

### CodebaseAgent RAG Workflow

1. **Indexing** (`pnpm index:codebase`):
   - Parses TypeScript/Python files
   - Chunks by function/class/method/import
   - Generates embeddings via Google text-embedding-004
   - Stores in `codebaseEmbedding` table with pgvector

2. **Search** (`lib/agents/codebaseAgent/vectorSearch.ts`):
   - Natural language query → embedding
   - Cosine similarity search with HNSW index
   - Returns top-k relevant code snippets
   - Tool: `search_codebase` with filters (file path, chunk type)

### MCP Integration (GitHubAgent)

- Connects to GitHub Copilot's remote MCP server
- Client singleton pattern with StreamableHTTPClientTransport
- 18 tools wrapping MCP `callTool()` operations
- Example tools: `list_commits`, `get_file_contents`, `create_branch`, `search_code`
- Requires `GITHUB_PAT` environment variable

## Package Manager

This project uses **pnpm**. Always use `pnpm` commands, not npm or yarn.

---

*Last updated: January 2026*
