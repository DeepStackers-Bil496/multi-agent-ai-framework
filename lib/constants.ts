import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
  process.env.PLAYWRIGHT ||
  process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

/**
 * Add peredefined roles for the agents not to hard code them.
 */
export const AgentUserRole = "user";
export const AgentAssistantRole = "assistant";

/**
 * Add peredefined model types for the agents not to hard code them.
*/
export const API_MODEL_TYPE = "api";
export const LOCAL_MODEL_TYPE = "local";
export const LOCAL_VISION_MODEL_TYPE = "local-vision";
export const API_VISION_MODEL_TYPE = "api-vision";

/**
 * Add predefined agent internal working signals suitable with the langgraph events.
 * Arkadaşlar bu sinyaller çok önemli direk langgraph taki eventleri yakalamamızı sağlıyor.
 */
export const AGENT_START_EVENT = "on_chain_start";
export const AGENT_END_EVENT = "on_chain_end";
export const ON_CHAT_MODEL_STREAM_EVENT = "on_chat_model_stream";

/**
 * Add custom predefined signals to be able to send signal to frontend.
 * Arkadaşlar bunlar da önemli kjbvdkjvfd, çünkü frontend taki eventleri yakalamamızı sağlıyor.
 */
export const AGENT_STARTED = "agent_started";
export const AGENT_ENDED = "agent_ended";
export const AGENT_STREAM = "agent_stream";
export const AGENT_ERROR = "agent_error";