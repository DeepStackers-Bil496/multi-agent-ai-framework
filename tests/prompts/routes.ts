import { generateUUID } from "@/lib/utils";

export const TEST_PROMPTS = {
  SKY: {
    MESSAGE: {
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      role: "user",
      content: "Why is the sky blue?",
      parts: [{ type: "text", text: "Why is the sky blue?" }],
    },
    OUTPUT_STREAM: [
      '{"type":"agent_started","payload":{"id":"main-agent","name":"Main Agent","content":"[]"}}',
      '{"type":"agent_stream","payload":{"id":"main-agent-stream","name":"Main Agent","content":"It\'s just "}}',
      '{"type":"agent_stream","payload":{"id":"main-agent-stream","name":"Main Agent","content":"blue duh!"}}',
      '{"type":"agent_ended","payload":{"id":"main-agent","name":"Main Agent","content":""}}',
    ],
  },
  GRASS: {
    MESSAGE: {
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      role: "user",
      content: "Why is grass green?",
      parts: [{ type: "text", text: "Why is grass green?" }],
    },
    OUTPUT_STREAM: [
      '{"type":"agent_started","payload":{"id":"main-agent","name":"Main Agent","content":"[]"}}',
      '{"type":"agent_stream","payload":{"id":"main-agent-stream","name":"Main Agent","content":"It\'s just "}}',
      '{"type":"agent_stream","payload":{"id":"main-agent-stream","name":"Main Agent","content":"green duh!"}}',
      '{"type":"agent_ended","payload":{"id":"main-agent","name":"Main Agent","content":""}}',
    ],
  },
};
