import { AgentConfig } from "../agentConfig";
import { FiVolume2 } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import type { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { ttsAgentSystemPrompt } from "./prompt";

const ttsAgentUserMetadata: AgentUserMetadata = {
  id: "tts-agent",
  name: "TTS Agent",
  short_description: "Text-to-speech responses in Turkish",
  long_description:
    "Generates Turkish responses that are optimized for text-to-speech playback.",
  icon: FiVolume2,
  suggestedActions: [
    "Kisaca kendini tanit.",
    "Istanbul hakkinda kisa bir bilgi ver.",
    "Bana kisa bir motivasyon cumlesi soyle.",
  ],
};

const ttsAgentImplementationMetadata: LLMImplMetadata = {
  type: API_MODEL_TYPE,
  provider: "google",
  modelID: "gemini-2.5-flash",
  systemInstruction: ttsAgentSystemPrompt,
  apiKey: process.env.GEMINI_API_KEY || "",
};

export const TtsAgentConfig: AgentConfig<LLMImplMetadata> = {
  user_metadata: ttsAgentUserMetadata,
  implementation_metadata: ttsAgentImplementationMetadata,
};
