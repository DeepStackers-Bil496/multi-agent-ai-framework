import {
  AGENT_ENDED,
  AGENT_STARTED,
  AGENT_STREAM,
} from "@/lib/constants";
import type { AgentChatMessage } from "@/lib/types";

const STREAM_CHUNK_SIZE = 12;
const STREAM_DELAY_MS = 20;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += STREAM_CHUNK_SIZE) {
    chunks.push(text.slice(index, index + STREAM_CHUNK_SIZE));
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

export function createMockAgentResponse({
  agentId,
  agentName,
  inputMessages,
}: {
  agentId: string;
  agentName: string;
  inputMessages: AgentChatMessage[];
}): Response {
  const responseText = getMockResponseText(getLastUserMessage(inputMessages));
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
