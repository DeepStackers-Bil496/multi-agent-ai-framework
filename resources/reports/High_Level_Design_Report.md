# High-Level Design Report

## 1. Introduction

### 1.1 Purpose of the System

The Multi-Agent AI Orchestration Framework is a production-ready system designed to unify multiple specialized artificial intelligence capabilities under a single, intuitive chat-based interface. The primary purpose is to enable users to accomplish complex tasks spanning multiple domains—such as code generation, repository analysis, web research, GitHub operations, Google Workspace automation, data analysis, and vision processing—through natural language interaction with a central orchestrating agent.

The system addresses the growing complexity of AI-powered workflows by abstracting the intricacies of model selection, provider management, and multi-step task execution behind a unified conversational interface. Rather than requiring users to understand which AI model or tool is best suited for a particular task, the MainAgent intelligently analyzes user intent and delegates work to the most appropriate specialized agent.

Key purposes include:
- **Task Unification**: Consolidate diverse AI capabilities (coding, search, GitHub, vision, data analysis) into a single access point
- **Provider Agnosticism**: Enable seamless switching between cloud providers (OpenAI, Google, Anthropic, Mistral, Groq) and self-hosted solutions (Ollama, LM Studio, LocalAI, llama.cpp)
- **Transparency**: Provide full visibility into agent decision-making through execution traces
- **Extensibility**: Support addition of new specialized agents without core system modifications
- **Personalization**: Allow per-user configuration of providers, models, and API credentials

### 1.2 Design Goals

The architectural design of this framework is driven by the following goals:

**DG-1: Modularity and Extensibility**
- New agents can be added by following a standardized 4-file pattern without modifying core orchestration logic
- Self-registration pattern allows agents to declare their capabilities at module load time
- Plugin-based architecture supports runtime discovery of available agents

**DG-2: Provider Abstraction**
- Complete decoupling of agent logic from LLM provider implementations
- Factory-based abstraction supporting 11+ LLM backends
- Per-agent provider configuration enabling heterogeneous model deployment

**DG-3: Real-Time Observability**
- Streaming architecture providing immediate feedback during agent execution
- Structured execution traces capturing agent decisions, tool invocations, and timing
- Visual representation of the agent/tool execution hierarchy

**DG-4: Security and Privacy**
- Encrypted storage of user API credentials (AES-256-GCM)
- Session-based authentication with support for guest and regular users
- Rate limiting to prevent abuse and manage resource consumption

**DG-5: Scalability**
- Stateless agent execution enabling horizontal scaling
- Serverless-compatible database architecture (Neon PostgreSQL)
- Resumable streams for handling interrupted connections

**DG-6: User Experience**
- Responsive, modern interface with real-time streaming updates
- Intuitive agent selection with searchable combobox
- Configurable appearance (themes, animations, layouts)

**DG-7: Self-Hosted Capability**
- Full support for on-premise LLM deployment via Ollama and OpenAI-compatible servers
- Integration with Google Colab GPU backends via ngrok tunneling
- Minimal cloud dependencies for privacy-conscious deployments

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|------------|
| **Agent** | An autonomous AI module designed to handle specific types of tasks, with its own system prompt, tool set, and configuration |
| **MainAgent** | The central orchestrator responsible for intent analysis and task delegation to specialized agents |
| **BaseAgent** | Abstract base class providing shared runtime functionality for all expert agents |
| **Tool** | A structured callable capability with defined schema that agents can invoke to perform actions |
| **LangGraph** | A library for building stateful, multi-step agent workflows using graph-based state machines |
| **LangChain** | A framework for developing LLM-powered applications with abstractions for chains, agents, and tools |
| **MCP** | Model Context Protocol - a standardized protocol for AI model interaction with external tools and services |
| **RAG** | Retrieval-Augmented Generation - enhancing LLM responses by retrieving relevant context before generation |
| **LLM** | Large Language Model - neural networks capable of understanding and generating human-like text |
| **pgvector** | PostgreSQL extension for vector similarity search, used for RAG embeddings |
| **HNSW** | Hierarchical Navigable Small World - an algorithm for approximate nearest neighbor search |
| **JWT** | JSON Web Token - compact, URL-safe means of representing claims for authentication |
| **SSE** | Server-Sent Events - web technology for pushing real-time updates from server to client |
| **ORM** | Object-Relational Mapping - technique for converting data between type systems |
| **Drizzle** | TypeScript-first ORM used for database operations |
| **NextAuth** | Authentication library for Next.js applications |
| **Neon** | Serverless PostgreSQL database service |
| **Ollama** | Tool for running large language models locally with OpenAI-compatible API |
| **Groq** | Cloud provider offering high-speed, low-latency LLM inference |
| **E2B** | Sandboxed code execution environment for running untrusted code safely |
| **DIN-SQL** | Decomposed-in-context SQL generation strategy using schema grounding and step-by-step decomposition for accurate text-to-SQL conversion |
| **Text-to-SQL** | The process of converting natural language queries into structured SQL statements |
| **Schema Grounding** | Technique of anchoring LLM responses to actual database schema to prevent hallucination of non-existent tables or columns |

### 1.4 Overview

The Multi-Agent AI Orchestration Framework is a web-based platform that enables users to interact with multiple specialized AI agents through a unified chat interface. At its core, a central orchestrator (MainAgent) receives natural language requests, analyzes user intent, and delegates tasks to the most appropriate specialized agent.

The system follows a layered architecture with clear separation between user interface, API handling, agent orchestration, and data persistence. Each specialized agent operates as an autonomous module with its own reasoning capabilities and tools, while the orchestration layer manages coordination and response aggregation.

The framework is designed to be provider-agnostic, allowing each agent to use different LLM backends ranging from cloud services to self-hosted models. This flexibility enables organizations to balance cost, performance, and privacy according to their specific requirements.

Key characteristics of the system include real-time streaming responses, transparent execution tracing, extensible agent architecture, and secure credential management for external service integrations.

---

## 2. Current Software Architecture

The system is currently implemented as a fully functional web application integrating a multi-agent orchestration core with a comprehensive set of specialized sub-agents. The architecture follows a modern full-stack pattern using Next.js 15 with the App Router paradigm.

**Core Architectural Components:**

1. **Frontend Layer**
   - Built with Next.js 15 and React 19 RC
   - Custom streaming handler for real-time agent response display
   - Tailwind CSS v4 for styling with Radix UI primitives
   - Framer Motion for animations and execution flow visualization

2. **API Layer**
   - Next.js API Routes handling chat, documents, authentication, and configuration
   - RESTful endpoints for CRUD operations
   - Streaming responses using ReadableStream for agent output

3. **Agent Orchestration Layer**
   - MainAgent as central coordinator with delegation capabilities
   - 12 specialized agents (GitHub, Codebase, Coding, Data Analyst, Vision, Frontend, Google Workspace, HuggingFace, Search, TTS, Voice, Database)
   - LangGraph-based state machine execution with tool binding
   - Self-registering agent registry for dynamic capability discovery

4. **Provider Abstraction Layer**
   - Factory pattern supporting 11+ LLM providers
   - Runtime configuration resolution with user-specific overrides
   - Encrypted credential storage for API keys

5. **Data Persistence Layer**
   - Neon serverless PostgreSQL via Drizzle ORM
   - pgvector for RAG embedding storage and similarity search
   - Redis (optional) for resumable stream state

6. **Authentication Layer**
   - NextAuth v5 with credential providers (regular and guest users)
   - JWT-based session management
   - Per-user rate limiting

**Current Operational Agents:**

| Agent | Purpose | Key Integration |
|-------|---------|-----------------|
| MainAgent | Orchestration and task delegation | Agent Registry |
| GitHubAgent | Repository operations | GitHub MCP Server |
| CodebaseAgent | Code analysis via RAG | pgvector embeddings |
| CodingAgent | Python-first code execution | E2B Interpreter |
| DataAnalystAgent | Data science and visualization | Pandas, Recharts |
| VisionAgent | Image analysis and understanding | Vision-capable LLM |
| FrontendAgent | UI customization | localStorage + React |
| GoogleWorkspaceAgent | Docs, Sheets, Drive integration | Google APIs |
| HuggingFaceAgent | Model search and inference | HuggingFace Hub |
| SearchAgent | Web search and retrieval | DuckDuckGo, Exa |
| TtsAgent | Text-to-speech synthesis | Local TTS Server |
| DatabaseAgent | Natural language to SQL query generation and execution | PostgreSQL, DIN-SQL Strategy |

---

## 3. Proposed Software Architecture

### 3.1 Overview

The proposed architecture maintains the current multi-agent orchestration paradigm while introducing enhancements for scalability, observability, and extensibility. The system is structured as a layered architecture with clear separation of concerns between presentation, business logic, data access, and external integrations.

**Architectural Style:** Layered Architecture with Event-Driven Streaming

**Key Architectural Principles:**
- **Single Responsibility**: Each agent handles a specific domain
- **Open/Closed**: New agents can be added without modifying core logic
- **Dependency Inversion**: Agents depend on abstractions (BaseAgent, LLMFactory), not concrete implementations
- **Interface Segregation**: Tools expose focused, well-defined interfaces

**High-Level Architecture Diagram:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Next.js Frontend (React 19, Tailwind CSS, Framer Motion)          │   │
│  │   ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────────────┐   │   │
│  │   │ Chat UI  │ │ Settings │ │ Agent Panel │ │ Execution Flow   │   │   │
│  │   └──────────┘ └──────────┘ └─────────────┘ └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ HTTP/Streaming
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Next.js API Routes (App Router)                                    │   │
│  │   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐  │   │
│  │   │ /api/chat  │ │ /api/auth  │ │ /api/doc   │ │ /api/settings  │  │   │
│  │   └────────────┘ └────────────┘ └────────────┘ └────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATION LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         MainAgent (Orchestrator)                     │   │
│  │   ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────┐    │   │
│  │   │ Intent      │  │ Delegation Tool │  │ Response            │    │   │
│  │   │ Analysis    │──│ Selection       │──│ Aggregation         │    │   │
│  │   └─────────────┘  └─────────────────┘  └─────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼ Delegation                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Agent Registry (Self-Registration)              │   │
│  │  ┌──────────┬──────────┬──────────┬──────────┬──────────┬────────┐ │   │
│  │  │ GitHub   │ Codebase │ Coding   │ Data     │ Vision   │  ...   │ │   │
│  │  │ Agent    │ Agent    │ Agent    │ Analyst  │ Agent    │        │ │   │
│  │  └──────────┴──────────┴──────────┴──────────┴──────────┴────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT EXECUTION LAYER                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   BaseAgent (Abstract Foundation)                                    │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │   │
│  │   │ LangGraph    │  │ Tool         │  │ Streaming Event          │ │   │
│  │   │ State Graph  │──│ Execution    │──│ Generation               │ │   │
│  │   └──────────────┘  └──────────────┘  └──────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PROVIDER ABSTRACTION LAYER                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   LLM Factory (11+ Providers)                                        │   │
│  │  ┌────────┬────────┬────────┬────────┬────────┬────────┬──────────┐│   │
│  │  │ Google │ OpenAI │ Groq   │Anthropic│Mistral │ Ollama │ Custom   ││   │
│  │  │ Gemini │ GPT    │        │ Claude │        │        │ (vLLM)   ││   │
│  │  └────────┴────────┴────────┴────────┴────────┴────────┴──────────┘│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Drizzle ORM + Neon PostgreSQL                                      │   │
│  │  ┌──────────┬──────────┬──────────┬──────────┬────────────────────┐│   │
│  │  │ User     │ Chat     │ Message  │ Document │ CodebaseEmbedding  ││   │
│  │  │          │          │          │          │ (pgvector)         ││   │
│  │  └──────────┴──────────┴──────────┴──────────┴────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL INTEGRATIONS                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ GitHub   │ │ Google   │ │ Hugging  │ │ E2B Code │ │ Web Search     │   │
│  │ MCP      │ │ Workspace│ │ Face Hub │ │ Interp.  │ │ (DDG, Exa)     │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Subsystem Decomposition

The system is decomposed into the following major subsystems:

#### 3.2.1 Presentation Subsystem

**Purpose:** Provide the user interface for interaction with the AI agents

**Components:**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Chat Interface | `/components/chat.tsx` | Main conversation UI with message input, streaming display |
| Message Renderer | `/components/messages.tsx` | Display agent responses with formatting, code highlighting |
| Execution Flow | `/components/execution-flow.tsx` | Visualize agent/tool execution hierarchy with timing |
| Agent Panel | `/components/agent-panel/` | Agent selection combobox with search |
| Settings Panel | `/components/settings/` | User preferences, agent configuration, privacy settings |
| Artifact Viewer | `/artifacts/` | Display generated code, documents, images, spreadsheets |
| Sidebar | `/components/sidebar.tsx` | Chat history navigation, user profile |

**Technology Stack:**
- React 19 RC with TypeScript strict mode
- Tailwind CSS v4 with custom design tokens
- Radix UI for accessible primitives
- Framer Motion for animations
- CodeMirror/ProseMirror for code/text editing

**Interfaces:**
- Consumes: API Layer (REST/Streaming)
- Produces: User events, configuration updates

#### 3.2.2 API Subsystem

**Purpose:** Handle HTTP requests, authentication, and route to appropriate services

**Components:**

| Route | Method | Responsibility |
|-------|--------|----------------|
| `/api/chat` | POST | Main chat endpoint - agent orchestration with streaming response |
| `/api/chat/[id]/stream` | GET | Resume interrupted streams |
| `/api/auth/[...nextauth]` | * | Authentication endpoints |
| `/api/document` | POST | Create/update artifacts |
| `/api/vote` | POST | Message upvote/downvote |
| `/api/history` | GET | Fetch chat history |
| `/api/models/list` | GET | List available agents |
| `/api/user_dashboard/*` | * | User configuration and analytics |
| `/api/settings/*` | * | Notification and profile settings |
| `/api/speech/tts` | POST | Text-to-speech synthesis |
| `/api/files/upload` | POST | File upload handling |

**Key Responsibilities:**
- Request validation using Zod schemas
- Session management and authentication checks
- Rate limiting enforcement
- Message persistence before/after agent execution
- Execution tree building from stream events

**Interfaces:**
- Consumes: Orchestration Subsystem, Data Access Subsystem
- Produces: HTTP responses, streaming events

#### 3.2.3 Orchestration Subsystem

**Purpose:** Coordinate agent selection and task delegation

**Components:**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| MainAgent | `/lib/agents/mainAgent/` | Intent analysis, delegation decisions, response aggregation |
| Agent Registry | `/lib/agents/agentRegistry.ts` | Maintain catalog of registered agents |
| Delegation Tool Factory | `/lib/agents/mainAgent/delegationToolFactory.ts` | Generate delegation tools from registry |
| Config Resolver | `/lib/agents/configResolver.ts` | Resolve user-specific agent configuration |

**Delegation Flow:**
1. MainAgent receives user message
2. LLM analyzes intent and decides: answer directly OR delegate
3. If delegating, MainAgent calls appropriate delegation tool (e.g., `delegate_to_github`)
4. Task preparation node extracts task and adds prefix (e.g., "[GitHub Task]")
5. Specialized agent subgraph executes (may use multiple tools)
6. Result returns to MainAgent for summarization
7. Final response streamed to user

**Interfaces:**
- Consumes: Agent Execution Subsystem
- Produces: Delegation decisions, aggregated responses

#### 3.2.4 Agent Execution Subsystem

**Purpose:** Execute individual agent logic with tools and streaming

**Components:**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| BaseAgent | `/lib/agents/baseAgent.ts` | Abstract foundation with LLM creation, graph building, streaming |
| LLM Factory | `/lib/agents/llmFactory.ts` | Create LLM instances by provider configuration |
| Tool Definitions | `/lib/agents/<agent>/tools.ts` | Agent-specific tool implementations |
| LangGraph State Machine | Built in BaseAgent | Manage agent→tool→agent execution loop |

**Execution Pattern (per agent):**
```
┌─────────┐     ┌──────────┐     ┌─────────┐
│  START  │────▶│ agentNode│────▶│ toolNode│
└─────────┘     └──────────┘     └─────────┘
                     ▲                 │
                     │                 │
                     └─────────────────┘
                     (if tool_calls)
                            │
                            ▼
                     ┌─────────┐
                     │   END   │
                     └─────────┘
                   (no tool_calls)
```

**Streaming Events:**
- `AGENT_STARTED`: Agent begins execution
- `AGENT_STREAM`: LLM output chunk
- `TOOL_STARTED`: Tool invocation begins
- `TOOL_ENDED`: Tool invocation completes
- `AGENT_ENDED`: Agent finished successfully
- `AGENT_ERROR`: Error during execution

**Interfaces:**
- Consumes: Provider Abstraction Subsystem, External Integrations
- Produces: Streaming events, tool results

#### 3.2.5 Provider Abstraction Subsystem

**Purpose:** Decouple agent logic from specific LLM provider implementations

**Components:**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| LLM Factory | `/lib/agents/llmFactory.ts` | Provider-specific LLM instantiation |
| Provider Configuration | `/lib/ai/providers.ts` | Provider metadata and defaults |
| Model Catalog | `/lib/ai/models.ts` | Available models per provider |

**Supported Providers:**

| Provider | Package | Use Case |
|----------|---------|----------|
| Google Gemini | `@langchain/google-genai` | Default provider, multimodal |
| OpenAI | `@langchain/openai` | GPT models, vLLM compatible |
| Anthropic | `@langchain/anthropic` | Claude models |
| Groq | `@langchain/groq` | High-speed inference |
| Mistral | `@langchain/mistralai` | Open-weight models |
| Ollama | `@langchain/ollama` | Local inference |
| LM Studio | OpenAI-compatible | Desktop local inference |
| LocalAI | OpenAI-compatible | Self-hosted alternative |
| llama.cpp | OpenAI-compatible | C++ optimized inference |
| text-gen-webui | OpenAI-compatible | WebUI for local models |
| Custom (vLLM) | OpenAI-compatible | Custom model deployments |

**Runtime Configuration:**
```typescript
{
  provider: "google" | "openai" | "groq" | "ollama" | ...,
  modelID: "gemini-1.5-flash" | "gpt-4o" | ...,
  apiKey?: "encrypted-user-key",
  baseURL?: "https://custom.endpoint/v1"
}
```

**Interfaces:**
- Consumes: Configuration from Agent Execution Subsystem
- Produces: `BaseChatModel` instances (LangChain abstraction)

#### 3.2.6 Data Access Subsystem

**Purpose:** Manage persistent storage of all application data

**Components:**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Database Pool | `/lib/db/pool.ts` | Drizzle ORM + Neon connection |
| Schema Definitions | `/lib/db/schema.ts` | Table definitions with Drizzle |
| Query Functions | `/lib/db/queries.ts` | Typed database operations |
| Migrations | `/lib/db/migrations/` | SQL migration files |
| Encryption Utilities | `/lib/db/utils.ts` | AES-256-GCM for credentials |

**Database Tables:**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `User` | User accounts | id (UUID), email, password (bcrypt) |
| `Chat` | Conversation metadata | id, userId, title, visibility, lastContext |
| `Message_v2` | Message history | chatId, role, parts (JSON), attachments |
| `Vote_v2` | Message ratings | chatId, messageId, isUpvoted |
| `Document` | Artifacts | userId, kind, title, content |
| `Suggestion` | Edit suggestions | documentId, originalText, suggestedText |
| `Stream` | Resumable streams | streamId, state (Redis-backed) |
| `CodebaseEmbedding` | RAG vectors | filePath, content, embedding (vector 768) |
| `AgentConfiguration` | User secrets | userId, agentId, encryptedConfig |

**Interfaces:**
- Consumes: Requests from API Subsystem
- Produces: Database query results

#### 3.2.7 Authentication Subsystem

**Purpose:** Manage user identity, sessions, and access control

**Components:**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| NextAuth Config | `/app/(auth)/auth.ts` | Provider configuration, callbacks |
| Credential Providers | `/app/(auth)/auth.config.ts` | Email/password, guest authentication |
| Session Management | NextAuth JWT | Token-based session storage |
| Rate Limiter | `/app/(chat)/api/chat/route.ts` | Per-user request limiting |

**Authentication Flow:**
1. User submits credentials (email/password OR guest login)
2. NextAuth validates against database
3. JWT token issued with user.id and user.type
4. Session cookie set (HTTP-only)
5. API routes check session for protected operations

**User Types:**
- **Regular User**: Full account with email/password
- **Guest User**: Auto-generated temporary account

**Interfaces:**
- Consumes: User credentials, session tokens
- Produces: Authenticated sessions, user context

#### 3.2.8 External Integration Subsystem

**Purpose:** Connect to third-party services and APIs

**Integrations:**

| Integration | Protocol | Agent | Purpose |
|-------------|----------|-------|---------|
| GitHub MCP Server | HTTP/MCP | GitHubAgent | Repository operations |
| E2B Code Interpreter | HTTP | CodingAgent | Sandboxed Python execution |
| HuggingFace Hub | HTTP | HuggingFaceAgent | Model search, inference |
| DuckDuckGo | HTTP | SearchAgent | Web search |
| Exa | HTTP | SearchAgent | Semantic search |
| Google Workspace | OAuth/HTTP | GoogleWorkspaceAgent | Docs, Sheets, Drive |
| Local TTS Server | HTTP | TtsAgent | Speech synthesis |

**MCP Integration Pattern (GitHub):**
```typescript
// Singleton connection to GitHub Copilot MCP Server
const client = new Client({
  name: "github-agent",
  version: "1.0.0"
});

await client.connect(new StreamableHTTPClientTransport({
  url: "https://api.githubcopilot.com/mcp/",
  headers: { Authorization: `Bearer ${GITHUB_PAT}` }
}));

// Tool invocation
const result = await client.callTool({
  name: "create_issue",
  arguments: { repo, title, body }
});
```

**Interfaces:**
- Consumes: Tool invocation requests from agents
- Produces: External service responses

### 3.3 Hardware/Software Mapping

#### 3.3.1 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      USER DEVICES                                    │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │ Desktop      │  │ Mobile       │  │ Tablet       │             │
│   │ Browser      │  │ Browser      │  │ Browser      │             │
│   └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS
┌─────────────────────────────────────────────────────────────────────┐
│                      EDGE NETWORK (CDN)                              │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │ Static Assets, Edge Caching, SSL Termination                  │ │
│   └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION TIER                                │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │ Next.js Application (Vercel/Self-Hosted)                      │ │
│   │ - Server-Side Rendering                                       │ │
│   │ - API Routes (Serverless Functions)                           │ │
│   │ - Agent Execution Runtime                                     │ │
│   └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐
│ DATABASE TIER   │ │ CACHE TIER      │ │ LLM PROVIDER TIER            │
│ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌───────┐ ┌───────┐        │
│ │ Neon        │ │ │ │ Redis       │ │ │ │Google │ │OpenAI │        │
│ │ PostgreSQL  │ │ │ │ (Optional)  │ │ │ │Gemini │ │ GPT   │ ...    │
│ │ + pgvector  │ │ │ └─────────────┘ │ │ └───────┘ └───────┘        │
│ └─────────────┘ │ └─────────────────┘ │ ┌───────────────────────┐  │
└─────────────────┘                      │ │ Self-Hosted (Ollama)  │  │
                                         │ │ - Local GPU           │  │
                                         │ │ - Google Colab        │  │
                                         │ │ - On-Premise Server   │  │
                                         │ └───────────────────────┘  │
                                         └─────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                                  │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│   │ GitHub   │ │ Google   │ │ Hugging  │ │ E2B      │             │
│   │ API      │ │ Workspace│ │ Face     │ │ Sandbox  │             │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.3.2 Software-to-Hardware Mapping

| Software Component | Hardware/Infrastructure | Scaling Model |
|--------------------|------------------------|---------------|
| Next.js Frontend | Vercel Edge / Container | Horizontal (CDN) |
| API Routes | Vercel Serverless / Container | Horizontal (auto-scale) |
| Agent Execution | Same as API (stateless) | Horizontal |
| PostgreSQL | Neon Serverless | Automatic (managed) |
| Redis | Upstash / Redis Cloud | Horizontal |
| LLM Inference (Cloud) | Provider infrastructure | API-based |
| LLM Inference (Self-Hosted) | GPU server / Colab | Vertical (GPU) |

#### 3.3.3 Self-Hosted GPU Deployment (Google Colab)

For users preferring self-hosted inference:

1. **Colab Setup**: Upload `cloud-deploy/ollama/colab.py` to Google Colab
2. **Install Dependencies**:
   ```python
   !pip install pyngrok
   !curl -fsSL https://ollama.com/install.sh | sh
   %run colab.py
   ```
3. **Expose Endpoint**: ngrok tunnel provides public URL
4. **Configure Agent**: Set `baseURL` to ngrok URL in agent configuration

**Supported Backends:**
- `ollama/` - Full Ollama runtime on Colab GPU
- `llama-cpp/` - llama.cpp for optimized inference
- `llama-cpp-cpu/` - CPU fallback for testing

### 3.4 Persistent Data Management

#### 3.4.1 Data Storage Strategy

**Primary Storage: Neon PostgreSQL**
- Serverless architecture with auto-scaling
- Connection pooling for concurrent requests
- pgvector extension for embedding storage

**Cache Layer: Redis (Optional)**
- Resumable stream state
- Session caching (future enhancement)
- Rate limiting counters

#### 3.4.2 Data Models

**User Domain:**
```
User
├── id: UUID (primary key)
├── email: string (unique)
├── password: string (bcrypt hashed)
└── createdAt: timestamp

AgentConfiguration
├── id: UUID (primary key)
├── userId: UUID (foreign key → User)
├── agentId: string
├── encryptedConfig: string (AES-256-GCM)
└── updatedAt: timestamp
```

**Chat Domain:**
```
Chat
├── id: UUID (primary key)
├── userId: UUID (foreign key → User)
├── title: string
├── visibility: "private" | "public"
├── lastContext: JSON (token usage)
└── createdAt: timestamp

Message_v2
├── id: UUID (primary key)
├── chatId: UUID (foreign key → Chat)
├── role: "user" | "assistant"
├── parts: JSON[] ([{type: "text", text: "..."}])
├── attachments: JSON[]
└── createdAt: timestamp

Vote_v2
├── chatId: UUID (foreign key → Chat)
├── messageId: UUID (foreign key → Message_v2)
└── isUpvoted: boolean
```

**Artifact Domain:**
```
Document
├── id: UUID (primary key)
├── userId: UUID (foreign key → User)
├── kind: "code" | "text" | "image" | "sheet"
├── title: string
├── content: text
└── createdAt: timestamp

Suggestion
├── id: UUID (primary key)
├── documentId: UUID (foreign key → Document)
├── originalText: string
├── suggestedText: string
└── isResolved: boolean
```

**RAG Domain:**
```
CodebaseEmbedding
├── id: UUID (primary key)
├── filePath: string
├── chunkType: "function" | "class" | "method" | "import"
├── chunkName: string
├── parentClass: string (nullable)
├── content: text
├── startLine: integer
├── endLine: integer
├── embedding: vector(768)
└── createdAt, updatedAt: timestamp

Indexes:
- embedding_cosine_idx (HNSW) on embedding
- filePath_idx on filePath
```

#### 3.4.3 Data Access Patterns

| Operation | Pattern | Implementation |
|-----------|---------|----------------|
| Chat creation | Write-through | Direct insert |
| Message streaming | Append-only | Batch insert after stream |
| Embedding search | Vector similarity | HNSW index with cosine |
| Config resolution | Cache-aside | Load once per session |
| History retrieval | Pagination | Cursor-based with createdAt |

#### 3.4.4 Data Migration Strategy

- Migrations stored in `/lib/db/migrations/` as SQL files
- Applied via `pnpm db:migrate` (runs `tsx lib/db/migrate`)
- Version-controlled in Git
- Rollback supported via reverse migrations

### 3.5 Access Control and Security

#### 3.5.1 Authentication Architecture

**NextAuth v5 Configuration:**
- Two credential providers: Regular (email/password) and Guest
- JWT-based sessions (no database sessions)
- Session token stored in HTTP-only cookie
- Refresh handled automatically by NextAuth

**Password Security:**
- bcrypt-ts with cost factor 10
- Minimum password length enforced
- No password recovery (guest mode provides alternative)

#### 3.5.2 Authorization Model

| Resource | Access Control |
|----------|----------------|
| Chat (private) | Owner only |
| Chat (public) | Read: anyone, Write: owner |
| Messages | Inherited from Chat |
| Documents | Owner only |
| Agent Configuration | Owner only |
| Execution Traces | Owner only |

#### 3.5.3 Credential Management

**Encrypted Storage:**
- User API keys encrypted with AES-256-GCM
- Encryption key: `ENCRYPTION_SECRET` environment variable
- Per-user encryption (not shared key)
- Decryption only at runtime, never logged

**Credential Flow:**
```
User enters API key → Frontend encrypts → Stored in DB →
Runtime request → Decrypt → Pass to LLM provider → Discard
```

#### 3.5.4 Rate Limiting

- Per-user message quota (24-hour rolling window)
- Different quotas for guest vs. regular users
- Enforced in `/app/(chat)/api/chat/route.ts`
- Returns 429 (Too Many Requests) when exceeded

#### 3.5.5 Security Considerations

| Threat | Mitigation |
|--------|------------|
| SQL Injection | Drizzle ORM parameterized queries |
| XSS | React auto-escaping, sanitized artifact HTML |
| CSRF | SameSite cookies, origin validation |
| Credential Leakage | Encryption at rest, no logging |
| Unauthorized Access | Session validation on all API routes |
| Brute Force | Rate limiting, bcrypt cost factor |

### 3.6 Global Software Control

#### 3.6.1 Request Processing Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         REQUEST LIFECYCLE                             │
└──────────────────────────────────────────────────────────────────────┘

1. CLIENT INITIATES
   └─▶ POST /api/chat { id, message, selectedChatModel, visibility }

2. API ROUTE PROCESSING
   ├─▶ Zod schema validation
   ├─▶ NextAuth session check
   ├─▶ Rate limit verification
   └─▶ Chat/message persistence (if new)

3. AGENT RESOLUTION
   ├─▶ Lookup agent by selectedChatModel (agentId)
   ├─▶ Load user configuration overrides
   ├─▶ Decrypt runtime secrets
   └─▶ Create runtime graph with merged config

4. AGENT EXECUTION
   ├─▶ agent.run(messages) returns ReadableStream
   ├─▶ LangGraph streamEvents(version: "v2")
   └─▶ JSON-encoded event emission

5. STREAM PROCESSING
   ├─▶ Parse events, build execution tree
   ├─▶ Forward to client via Response stream
   └─▶ Handle errors, timeouts

6. COMPLETION
   ├─▶ Persist assistant message
   ├─▶ Store execution metadata
   └─▶ Close stream

7. CLIENT PROCESSING
   ├─▶ Parse JSON lines
   ├─▶ Update UI in real-time
   └─▶ Render execution flow
```

#### 3.6.2 Agent Execution State Machine

**LangGraph State Definition:**
```typescript
const MessagesAnnotation = {
  messages: {
    reducer: (state, update) => state.concat(update.messages),
    default: () => []
  }
};
```

**Graph Topology:**
```
START ──▶ agentNode ──▶ [Decision]
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
        tools          END (no           tools
    (tool_calls)      tool_calls)    (parallel)
           │                              │
           └──────────────────────────────┘
                         │
                         ▼
                    agentNode
                   (with results)
```

#### 3.6.3 Error Handling Strategy

| Layer | Error Type | Handling |
|-------|------------|----------|
| API | Validation | 400 Bad Request with details |
| Auth | Unauthorized | 401 Redirect to login |
| Rate Limit | Exceeded | 429 with retry-after |
| Agent | LLM failure | AGENT_ERROR event, retry logic |
| Tool | Execution error | ToolMessage with error content |
| Stream | Interruption | Resumable stream support |

#### 3.6.4 Concurrency Model

- **Serverless**: Each request gets isolated execution context
- **Agent Execution**: Sequential within single request
- **Tool Execution**: Sequential (ToolNode processes one at a time)
- **Database**: Connection pooling via Neon
- **LLM Calls**: Blocking (streaming doesn't block other requests)

### 3.7 Boundary Conditions

#### 3.7.1 System Startup

**Application Initialization:**
1. Next.js server starts
2. Environment variables loaded
3. Database connection pool created
4. Agent modules loaded (triggers self-registration)
5. NextAuth configured
6. API routes available

**Agent Registry Population:**
- Each agent module imports trigger registration
- MainAgent imports all agents to ensure registration
- Registry populated before first request

#### 3.7.2 System Shutdown

**Graceful Shutdown:**
1. Stop accepting new requests
2. Wait for in-flight streams to complete (timeout: 30s)
3. Close database connections
4. Close MCP client connections
5. Exit process

**Ungraceful Shutdown:**
- Streams interrupted (resumable if Redis configured)
- Database transactions rolled back
- No data corruption (ACID guarantees)

#### 3.7.3 Error Recovery

| Scenario | Recovery |
|----------|----------|
| LLM provider timeout | Retry with exponential backoff |
| Database connection lost | Automatic reconnection (Neon) |
| MCP server unavailable | Error message to user, retry option |
| Stream interrupted | Resume from Redis state (if enabled) |
| Out of memory | Serverless: new instance, Self-hosted: restart |

#### 3.7.4 Capacity Limits

| Resource | Limit | Handling |
|----------|-------|----------|
| Message length | ~32K tokens | Truncation with warning |
| Chat history | Unlimited | Pagination, context window management |
| File upload | 10MB | Client-side validation |
| Concurrent streams | Serverless: unlimited | Auto-scaling |
| Embedding storage | PostgreSQL limits | Archival strategy (future) |

---

## 4. Subsystem Services

### 4.1 Presentation Subsystem Services

| Service | Description | Interface |
|---------|-------------|-----------|
| `renderChat()` | Display chat interface with message history | React Component |
| `streamResponse()` | Process and display streaming agent output | Custom hook |
| `selectAgent()` | Agent selection combobox with search | React Component |
| `configureAgent()` | Agent configuration dialog (provider, model, keys) | React Component |
| `visualizeExecution()` | Render execution flow tree | React Component |
| `displayArtifact()` | Show generated code/text/image/sheet | React Component |

### 4.2 API Subsystem Services

| Service | Endpoint | Description |
|---------|----------|-------------|
| `processChat()` | POST /api/chat | Main chat processing with streaming |
| `resumeStream()` | GET /api/chat/[id]/stream | Resume interrupted stream |
| `saveDocument()` | POST /api/document | Create/update artifact |
| `voteMessage()` | POST /api/vote | Upvote/downvote message |
| `getHistory()` | GET /api/history | Fetch chat list |
| `listModels()` | GET /api/models/list | Available agents |
| `getConfig()` | GET /api/user_dashboard/agent-config | User agent config |
| `saveConfig()` | POST /api/user_dashboard/agent-config | Update agent config |
| `synthesizeSpeech()` | POST /api/speech/tts | Text-to-speech |

### 4.3 Orchestration Subsystem Services

| Service | Description | Input | Output |
|---------|-------------|-------|--------|
| `analyzeIntent()` | Determine task type from user message | Message text | Intent classification |
| `selectAgent()` | Choose appropriate agent for task | Intent, context | Agent ID |
| `delegateTask()` | Forward task to specialized agent | Task, agent | Agent response |
| `aggregateResponse()` | Combine multi-agent results | Agent outputs | Final response |
| `buildDelegationTools()` | Generate delegation tools from registry | Agent Registry | Tool array |

### 4.4 Agent Execution Subsystem Services

| Service | Description | Input | Output |
|---------|-------------|-------|--------|
| `run()` | Execute agent with messages | Messages, config | ReadableStream |
| `createTools()` | Build agent-specific tools | Runtime secrets | Tool array |
| `bindTools()` | Attach tools to LLM | LLM, tools | Bound LLM |
| `streamEvents()` | Generate execution events | Graph execution | Event stream |
| `executeToolNode()` | Run tool with arguments | Tool call | Tool result |

### 4.5 Provider Abstraction Subsystem Services

| Service | Description | Input | Output |
|---------|-------------|-------|--------|
| `createLLM()` | Instantiate LLM by provider | Config | BaseChatModel |
| `resolveConfig()` | Merge default + user config | AgentId, userId | Merged config |
| `decryptSecrets()` | Decrypt user API keys | Encrypted config | Plain secrets |
| `validateProvider()` | Check provider availability | Provider name | Boolean |

### 4.6 Data Access Subsystem Services

| Service | Description | Parameters |
|---------|-------------|------------|
| `saveChat()` | Create new chat | id, userId, title, visibility |
| `saveMessages()` | Persist messages | chatId, messages[] |
| `getMessagesByChatId()` | Fetch chat messages | chatId |
| `getChatById()` | Fetch chat metadata | chatId |
| `voteMessage()` | Record vote | chatId, messageId, isUpvoted |
| `createDocument()` | Save artifact | userId, kind, title, content |
| `getAgentConfiguration()` | Fetch user config | userId, agentId |
| `saveAgentConfiguration()` | Store user config | userId, agentId, encryptedConfig |
| `searchEmbeddings()` | Vector similarity search | query embedding, top_k |

### 4.7 Authentication Subsystem Services

| Service | Description | Input | Output |
|---------|-------------|-------|--------|
| `authenticate()` | Validate credentials | email, password | Session |
| `createGuestSession()` | Generate guest account | None | Guest session |
| `getSession()` | Retrieve current session | Request | Session object |
| `checkRateLimit()` | Verify message quota | userId | Boolean |
| `encryptConfig()` | Encrypt API keys | Plain config | Encrypted string |

### 4.8 External Integration Subsystem Services

| Service | Agent | Description |
|---------|-------|-------------|
| `callMCPTool()` | GitHubAgent | Invoke GitHub MCP operation |
| `executeCode()` | CodingAgent | Run Python in E2B sandbox |
| `searchWeb()` | SearchAgent | Query DuckDuckGo/Exa |
| `searchModels()` | HuggingFaceAgent | Query HuggingFace Hub |
| `synthesizeSpeech()` | TtsAgent | Generate audio from text |
| `queryGoogleWorkspace()` | GoogleWorkspaceAgent | Access Docs/Sheets/Drive |

---

## 5. Glossary

| Term | Definition |
|------|------------|
| **Agent** | An autonomous AI module with specific capabilities, system prompt, and tool set |
| **Agent Registry** | Dynamic catalog of available agents enabling runtime discovery |
| **API Key** | Secret credential for authenticating with external services |
| **Artifact** | Generated content (code, text, image, spreadsheet) stored as documents |
| **Base URL** | Endpoint URL for LLM provider API, configurable for self-hosted models |
| **BaseAgent** | Abstract class providing shared functionality for all agents |
| **bcrypt** | Password hashing algorithm used for credential storage |
| **BYOM** | Bring Your Own Model - user-configured model endpoints |
| **Delegation** | Process of MainAgent forwarding tasks to specialized agents |
| **DIN-SQL** | Decomposed-in-context SQL generation strategy |
| **Drizzle ORM** | TypeScript-first object-relational mapper for PostgreSQL |
| **E2B** | Sandboxed code execution environment |
| **Embedding** | Vector representation of text for semantic similarity |
| **Execution Trace** | Structured log of agent decisions and tool invocations |
| **HNSW** | Hierarchical Navigable Small World - vector search algorithm |
| **Intent Analysis** | Process of determining user request type |
| **JWT** | JSON Web Token for session management |
| **LangChain** | Framework for LLM application development |
| **LangGraph** | Library for stateful agent workflows |
| **LLM** | Large Language Model |
| **LLM Factory** | Factory pattern for provider-agnostic LLM instantiation |
| **MainAgent** | Central orchestrator for task delegation |
| **MCP** | Model Context Protocol for AI-tool interaction |
| **Neon** | Serverless PostgreSQL provider |
| **NextAuth** | Authentication library for Next.js |
| **Ollama** | Local LLM inference runtime |
| **pgvector** | PostgreSQL extension for vector operations |
| **Provider** | Service hosting LLM inference (cloud or self-hosted) |
| **RAG** | Retrieval-Augmented Generation |
| **Self-Hosted** | Running inference on user-controlled infrastructure |
| **SSE** | Server-Sent Events for streaming |
| **Streaming** | Incremental response delivery |
| **Tool** | Callable capability with defined schema |

---

## 6. References

### 6.1 Academic References

[1] Yao, S., et al. (2022). "ReAct: Synergizing Reasoning and Acting in Language Models." arXiv:2210.03629. https://arxiv.org/abs/2210.03629

[2] Schick, T., et al. (2023). "Toolformer: Language Models Can Teach Themselves to Use Tools." arXiv:2302.04761. https://arxiv.org/abs/2302.04761

[3] Shen, Y., et al. (2023). "HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in Hugging Face." arXiv:2303.17580. https://arxiv.org/abs/2303.17580

[4] Wu, Q., et al. (2023). "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation." arXiv:2308.08155. https://arxiv.org/abs/2308.08155

[5] Lewis, P., et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." arXiv:2005.11401. https://arxiv.org/abs/2005.11401

### 6.2 Technical Documentation

[6] LangChain Documentation. https://js.langchain.com/docs/

[7] LangGraph Documentation. https://langchain-ai.github.io/langgraphjs/

[8] Next.js 15 Documentation. https://nextjs.org/docs

[9] Drizzle ORM Documentation. https://orm.drizzle.team/docs/overview

[10] NextAuth.js v5 Documentation. https://authjs.dev/

[11] Model Context Protocol Specification. https://modelcontextprotocol.io/

[12] pgvector Documentation. https://github.com/pgvector/pgvector

[13] Neon Serverless PostgreSQL. https://neon.tech/docs

### 6.3 Provider Documentation

[14] Google Gemini API. https://ai.google.dev/docs

[15] OpenAI API Reference. https://platform.openai.com/docs

[16] Anthropic Claude API. https://docs.anthropic.com/

[17] Groq API. https://console.groq.com/docs

[18] Ollama. https://ollama.com/

[19] HuggingFace Hub. https://huggingface.co/docs

---

*Document prepared for: Multi-Agent AI Orchestration Framework*
*Version: 2.0*
*Date: January 2026*
