import {
  AGENT_ENDED,
  AGENT_STARTED,
  AGENT_STREAM,
  UI_STREAM_PART,
} from "@/lib/constants";
import type {
  AgentChatMessage,
  CustomUIDataTypes,
} from "@/lib/types";

const STREAM_CHUNK_SIZE = 12;
const ARTIFACT_STREAM_CHUNK_SIZE = 32;
const STREAM_DELAY_MS = 20;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(text: string, chunkSize = STREAM_CHUNK_SIZE): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks.length > 0 ? chunks : [text];
}

function getLastUserMessage(inputMessages: AgentChatMessage[]): string {
  const userMessages = inputMessages.filter((message) => message.role === "user");
  return userMessages.at(-1)?.content ?? "";
}

function getMockResponseText(userMessage: string): string {
  const normalized = userMessage.toLowerCase();

  if (normalized.includes("[image:") && normalized.includes("who painted this")) {
    return "This painting is by Monet!";
  }

  if (normalized.includes("why is grass green")) {
    return "It's just green duh!";
  }

  if (normalized.includes("why is the sky blue")) {
    return "It's just blue duh!";
  }

  if (normalized.includes("what's the weather in sf")) {
    return "The current temperature in San Francisco is 17°C.";
  }

  if (normalized.includes("what is model context protocol")) {
    return "Model Context Protocol is a standard for connecting AI models to external tools and systems.";
  }

  if (normalized.includes("search this link oruccakir.live")) {
    return "oruccakir.live appears to be a personal website.";
  }

  if (normalized.includes("help me write an essay about silicon valley")) {
    return "Silicon Valley is a major technology and startup hub in California.";
  }

  if (normalized.includes("thanks")) {
    return "You're welcome!";
  }

  return `Mock response for: ${userMessage.trim() || "empty prompt"}`;
}

export type MockArtifactDraft = {
  id: string;
  title: string;
  kind: CustomUIDataTypes["kind"];
  content: string;
};

function buildEssayDraft(): string {
  return [
    "# Silicon Valley",
    "",
    "Silicon Valley is a major technology ecosystem in California, known for startups, venture capital, engineering talent, and influential companies.",
    "",
    "The region grew through a combination of research institutions, semiconductor innovation, defense funding, and a culture that rewards experimentation.",
    "",
    "Today it represents more than a location: it is a model for how capital, product design, software engineering, and entrepreneurship can reinforce each other.",
    "",
    "Its strengths include rapid iteration, access to investors, strong hiring networks, and proximity to companies that define modern digital infrastructure.",
    "",
    "Its weaknesses include high costs, aggressive competition, and pressure that can make long-term sustainability harder for smaller teams.",
    "",
    "Even with those tradeoffs, Silicon Valley remains one of the most important global centers for product development and startup creation.",
  ].join("\n");
}

export function getMockArtifactDraft(userMessage: string): Omit<
  MockArtifactDraft,
  "id"
> | null {
  const normalized = userMessage.toLowerCase();

  if (normalized.includes("help me write an essay about silicon valley")) {
    return {
      title: "Essay about Silicon Valley",
      kind: "text",
      content: buildEssayDraft(),
    };
  }

  return null;
}

export function createMockAgentResponse({
  agentId,
  agentName,
  inputMessages,
  artifactDraft,
}: {
  agentId: string;
  agentName: string;
  inputMessages: AgentChatMessage[];
  artifactDraft?: MockArtifactDraft;
}): Response {
  const responseText = artifactDraft
    ? "A document was created and is now visible to the user."
    : getMockResponseText(getLastUserMessage(inputMessages));
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (payload: object) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      enqueue({
        type: AGENT_STARTED,
        payload: {
          name: agentName,
          content: JSON.stringify(inputMessages),
          id: agentId,
        },
      });

      if (artifactDraft) {
        const artifactParts = [
          {
            type: "data-kind",
            data: artifactDraft.kind,
            transient: true,
          },
          {
            type: "data-id",
            data: artifactDraft.id,
            transient: true,
          },
          {
            type: "data-title",
            data: artifactDraft.title,
            transient: true,
          },
          {
            type: "data-clear",
            data: null,
            transient: true,
          },
        ] as const;

        for (const part of artifactParts) {
          enqueue({
            type: UI_STREAM_PART,
            payload: part,
          });
        }

        for (const chunk of chunkText(
          artifactDraft.content,
          ARTIFACT_STREAM_CHUNK_SIZE
        )) {
          await sleep(STREAM_DELAY_MS);
          enqueue({
            type: UI_STREAM_PART,
            payload: {
              type: "data-textDelta",
              data: chunk,
              transient: true,
            },
          });
        }

        enqueue({
          type: UI_STREAM_PART,
          payload: {
            type: "data-finish",
            data: null,
            transient: true,
          },
        });
      }

      for (const chunk of chunkText(responseText)) {
        await sleep(STREAM_DELAY_MS);
        enqueue({
          type: AGENT_STREAM,
          payload: {
            name: agentName,
            content: chunk,
            id: `${agentId}-stream`,
          },
        });
      }

      enqueue({
        type: AGENT_ENDED,
        payload: {
          name: agentName,
          content: "",
          id: agentId,
        },
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      charset: "utf-8",
    },
  });
}
