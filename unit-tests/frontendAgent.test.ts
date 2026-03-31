import { describe, it, expect } from "vitest";
import { FrontendAgentConfig } from "@/lib/agents/frontendAgent/config";
import { frontendAgentSystemPrompt } from "@/lib/agents/frontendAgent/prompt";
import {
  createFrontendAgentTools,
  enableGlassmorphismTool,
  setGradientBackgroundTool,
  setThemeTool,
  updateColorsTool,
} from "@/lib/agents/frontendAgent/tools";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import { chatModels } from "@/lib/ai/models";

const FRONTEND_AGENT_ID = "frontend-agent";

function extractUiAction(result: string) {
  const match = result.match(/<UI_ACTION>(.+)<\/UI_ACTION>/);

  if (!match) {
    throw new Error("Expected <UI_ACTION> payload in tool result");
  }

  return JSON.parse(match[1]) as {
    action: string;
    params: Record<string, unknown>;
  };
}

describe("FrontendAgent", () => {
  it("uses Google gemini-2.5-flash by default", () => {
    expect(FrontendAgentConfig.implementation_metadata.provider).toBe("google");
    expect(FrontendAgentConfig.implementation_metadata.modelID).toBe(
      "gemini-2.5-flash"
    );
  });

  it("prompt covers core UI customization capabilities", () => {
    expect(frontendAgentSystemPrompt).toMatch(/theme/i);
    expect(frontendAgentSystemPrompt).toMatch(/colors/i);
    expect(frontendAgentSystemPrompt).toMatch(/glassmorphism/i);
    expect(frontendAgentSystemPrompt).toMatch(/preset/i);
  });

  it("is registered in metadata and chat models", () => {
    expect(
      agentUserMetadataList.some((agent) => agent.id === FRONTEND_AGENT_ID)
    ).toBe(true);
    expect(chatModels.some((model) => model.id === FRONTEND_AGENT_ID)).toBe(
      true
    );
  });

  it("createFrontendAgentTools returns all 12 UI tools", () => {
    const tools = createFrontendAgentTools();
    expect(tools).toHaveLength(12);
  });

  it("every frontend tool has a name and description", () => {
    const tools = createFrontendAgentTools();

    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("tool set includes theme, preset, and bubble customization", () => {
    const toolNames = createFrontendAgentTools().map((tool) => tool.name);

    expect(toolNames).toContain("set_theme");
    expect(toolNames).toContain("apply_preset_theme");
    expect(toolNames).toContain("set_message_bubble_style");
  });

  it("set_theme emits a UI_ACTION payload", async () => {
    const result = await setThemeTool.invoke({ theme: "dark" });
    const action = extractUiAction(result);

    expect(action).toEqual({
      action: "set_theme",
      params: { theme: "dark" },
    });
    expect(result).toContain("Theme set to dark mode.");
  });

  it("update_colors returns a validation message when no colors are provided", async () => {
    const result = await updateColorsTool.invoke({});
    expect(result).toBe(
      "No colors were specified. Please provide at least one color to update."
    );
  });

  it("update_colors emits selected HSL values in the UI_ACTION payload", async () => {
    const result = await updateColorsTool.invoke({
      primary: "hsl(220 80% 55%)",
      accent: "hsl(280 65% 60%)",
    });
    const action = extractUiAction(result);

    expect(action).toEqual({
      action: "update_colors",
      params: {
        primary: "hsl(220 80% 55%)",
        accent: "hsl(280 65% 60%)",
      },
    });
  });

  it("set_gradient_background emits preset and direction", async () => {
    const result = await setGradientBackgroundTool.invoke({
      preset: "sunset",
      direction: "to-right",
    });
    const action = extractUiAction(result);

    expect(action).toEqual({
      action: "set_gradient_background",
      params: {
        preset: "sunset",
        direction: "to-right",
      },
    });
  });

  it("enable_glassmorphism defaults intensity to medium", async () => {
    const result = await enableGlassmorphismTool.invoke({
      enabled: true,
    });
    const action = extractUiAction(result);

    expect(action).toEqual({
      action: "enable_glassmorphism",
      params: {
        enabled: true,
        intensity: "medium",
      },
    });
    expect(result).toContain("Glassmorphism enabled");
  });
});
