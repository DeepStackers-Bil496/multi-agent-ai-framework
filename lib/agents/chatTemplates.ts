/**
 * Chat Template Formatting Utility
 *
 * Provides predefined chat templates and message formatting for custom model integration.
 * These templates define how system, user, and assistant messages are structured
 * for different model architectures.
 */

import type { ChatTemplateType, CustomChatTemplateConfig, AgentChatMessage } from "@/lib/types";
import { AgentUserRole, AgentAssistantRole } from "@/lib/constants";

/**
 * Predefined chat template configurations
 */
export const CHAT_TEMPLATES: Record<Exclude<ChatTemplateType, "auto" | "custom">, CustomChatTemplateConfig> = {
  // ChatML format (OpenAI, Qwen-style)
  chatml: {
    bosToken: "",
    eosToken: "<|im_end|>",
    systemPrefix: "<|im_start|>system\n",
    systemSuffix: "<|im_end|>\n",
    userPrefix: "<|im_start|>user\n",
    userSuffix: "<|im_end|>\n",
    assistantPrefix: "<|im_start|>assistant\n",
    assistantSuffix: "<|im_end|>\n",
  },

  // Llama 2 format
  llama2: {
    bosToken: "<s>",
    eosToken: "</s>",
    systemPrefix: "[INST] <<SYS>>\n",
    systemSuffix: "\n<</SYS>>\n\n",
    userPrefix: "",
    userSuffix: " [/INST] ",
    assistantPrefix: "",
    assistantSuffix: " </s><s>[INST] ",
  },

  // Llama 3 format
  llama3: {
    bosToken: "<|begin_of_text|>",
    eosToken: "<|eot_id|>",
    systemPrefix: "<|start_header_id|>system<|end_header_id|>\n\n",
    systemSuffix: "<|eot_id|>",
    userPrefix: "<|start_header_id|>user<|end_header_id|>\n\n",
    userSuffix: "<|eot_id|>",
    assistantPrefix: "<|start_header_id|>assistant<|end_header_id|>\n\n",
    assistantSuffix: "<|eot_id|>",
  },

  // Alpaca format
  alpaca: {
    systemPrefix: "### System:\n",
    systemSuffix: "\n\n",
    userPrefix: "### Instruction:\n",
    userSuffix: "\n\n",
    assistantPrefix: "### Response:\n",
    assistantSuffix: "\n\n",
  },

  // Vicuna format
  vicuna: {
    systemPrefix: "",
    systemSuffix: "\n\n",
    userPrefix: "USER: ",
    userSuffix: "\n",
    assistantPrefix: "ASSISTANT: ",
    assistantSuffix: "</s>\n",
  },

  // Mistral instruct format
  mistral: {
    bosToken: "<s>",
    eosToken: "</s>",
    systemPrefix: "[INST] ",
    systemSuffix: "\n\n",
    userPrefix: "",
    userSuffix: " [/INST]",
    assistantPrefix: "",
    assistantSuffix: "</s> [INST] ",
  },

  // Zephyr format
  zephyr: {
    systemPrefix: "<|system|>\n",
    systemSuffix: "</s>\n",
    userPrefix: "<|user|>\n",
    userSuffix: "</s>\n",
    assistantPrefix: "<|assistant|>\n",
    assistantSuffix: "</s>\n",
  },

  // Microsoft Phi format
  phi: {
    systemPrefix: "<|system|>\n",
    systemSuffix: "<|end|>\n",
    userPrefix: "<|user|>\n",
    userSuffix: "<|end|>\n",
    assistantPrefix: "<|assistant|>\n",
    assistantSuffix: "<|end|>\n",
  },

  // Google Gemma format
  gemma: {
    bosToken: "<bos>",
    eosToken: "<eos>",
    systemPrefix: "",
    systemSuffix: "\n",
    userPrefix: "<start_of_turn>user\n",
    userSuffix: "<end_of_turn>\n",
    assistantPrefix: "<start_of_turn>model\n",
    assistantSuffix: "<end_of_turn>\n",
  },

  // Qwen format (similar to ChatML but with slight differences)
  qwen: {
    bosToken: "",
    eosToken: "<|im_end|>",
    systemPrefix: "<|im_start|>system\n",
    systemSuffix: "<|im_end|>\n",
    userPrefix: "<|im_start|>user\n",
    userSuffix: "<|im_end|>\n",
    assistantPrefix: "<|im_start|>assistant\n",
    assistantSuffix: "<|im_end|>\n",
  },

  // DeepSeek format
  deepseek: {
    bosToken: "<|begin▁of▁sentence|>",
    eosToken: "<|end▁of▁sentence|>",
    systemPrefix: "",
    systemSuffix: "\n\n",
    userPrefix: "User: ",
    userSuffix: "\n\n",
    assistantPrefix: "Assistant: ",
    assistantSuffix: "<|end▁of▁sentence|>",
  },

  // Cohere Command-R format
  "command-r": {
    bosToken: "<BOS_TOKEN>",
    eosToken: "<EOP_TOKEN>",
    systemPrefix: "<|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|>",
    systemSuffix: "<|END_OF_TURN_TOKEN|>",
    userPrefix: "<|START_OF_TURN_TOKEN|><|USER_TOKEN|>",
    userSuffix: "<|END_OF_TURN_TOKEN|>",
    assistantPrefix: "<|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|>",
    assistantSuffix: "<|END_OF_TURN_TOKEN|>",
  },
};

/**
 * Template display names for UI
 */
export const CHAT_TEMPLATE_LABELS: Record<ChatTemplateType, string> = {
  auto: "Auto (Server Default)",
  chatml: "ChatML (OpenAI/GPT)",
  llama2: "Llama 2",
  llama3: "Llama 3",
  alpaca: "Alpaca",
  vicuna: "Vicuna",
  mistral: "Mistral Instruct",
  zephyr: "Zephyr",
  phi: "Microsoft Phi",
  gemma: "Google Gemma",
  qwen: "Qwen",
  deepseek: "DeepSeek",
  "command-r": "Command-R",
  custom: "Custom Template",
};

/**
 * Template descriptions for UI tooltips
 */
export const CHAT_TEMPLATE_DESCRIPTIONS: Record<ChatTemplateType, string> = {
  auto: "Let the inference server handle message formatting based on model configuration",
  chatml: "Standard ChatML format used by OpenAI and many fine-tuned models",
  llama2: "Meta's Llama 2 chat format with [INST] tags",
  llama3: "Meta's Llama 3 format with header tokens",
  alpaca: "Stanford Alpaca instruction format",
  vicuna: "LMSYS Vicuna conversation format",
  mistral: "Mistral AI instruction format",
  zephyr: "HuggingFace Zephyr format",
  phi: "Microsoft Phi-series format",
  gemma: "Google Gemma conversation format",
  qwen: "Alibaba Qwen format (ChatML variant)",
  deepseek: "DeepSeek conversation format",
  "command-r": "Cohere Command-R format",
  custom: "Define your own message formatting template",
};

/**
 * Format messages using a specific chat template
 *
 * @param messages - Array of chat messages to format
 * @param systemInstruction - System prompt/instruction
 * @param templateType - The chat template type to use
 * @param customTemplate - Custom template config (required if templateType is "custom")
 * @returns Formatted prompt string
 */
export function formatMessagesWithTemplate(
  messages: AgentChatMessage[],
  systemInstruction: string,
  templateType: ChatTemplateType,
  customTemplate?: CustomChatTemplateConfig
): string {
  // For "auto", return null to let the server handle formatting
  if (templateType === "auto") {
    return "";
  }

  // Get the template configuration
  const template = templateType === "custom"
    ? customTemplate
    : CHAT_TEMPLATES[templateType];

  if (!template) {
    console.warn(`[ChatTemplates] Unknown template type: ${templateType}, falling back to auto`);
    return "";
  }

  const parts: string[] = [];

  // Add BOS token if present
  if (template.bosToken) {
    parts.push(template.bosToken);
  }

  // Add system instruction
  if (systemInstruction) {
    parts.push(template.systemPrefix);
    parts.push(systemInstruction);
    parts.push(template.systemSuffix);
  }

  // Add messages
  for (const message of messages) {
    if (message.role === AgentUserRole) {
      parts.push(template.userPrefix);
      parts.push(message.content);
      parts.push(template.userSuffix);
    } else if (message.role === AgentAssistantRole) {
      parts.push(template.assistantPrefix);
      parts.push(message.content);
      parts.push(template.assistantSuffix);
    }
  }

  // Add assistant prefix for generation (without suffix - model will generate the response)
  parts.push(template.assistantPrefix);

  return parts.join(template.messageSeparator || "");
}

/**
 * Check if a template type requires custom configuration
 */
export function requiresCustomConfig(templateType: ChatTemplateType): boolean {
  return templateType === "custom";
}

/**
 * Validate a custom template configuration
 */
export function validateCustomTemplate(config: Partial<CustomChatTemplateConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const requiredFields: (keyof CustomChatTemplateConfig)[] = [
    "systemPrefix",
    "systemSuffix",
    "userPrefix",
    "userSuffix",
    "assistantPrefix",
    "assistantSuffix",
  ];

  for (const field of requiredFields) {
    if (typeof config[field] !== "string") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get a list of available template types for UI dropdown
 */
export function getAvailableTemplates(): Array<{ value: ChatTemplateType; label: string; description: string }> {
  return (Object.keys(CHAT_TEMPLATE_LABELS) as ChatTemplateType[]).map(value => ({
    value,
    label: CHAT_TEMPLATE_LABELS[value],
    description: CHAT_TEMPLATE_DESCRIPTIONS[value],
  }));
}
