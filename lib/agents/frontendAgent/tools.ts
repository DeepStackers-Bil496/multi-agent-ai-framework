/**
 * FrontendAgent Tools
 * Provides UI customization tools for theme, colors, fonts, and styling
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Tool output format sent to frontend for processing
 */
export interface UIAction {
    action: "set_theme" | "update_colors" | "set_font_size" | "set_border_radius" | "reset_styles";
    params: Record<string, unknown>;
}

/**
 * Tool for setting the application theme
 */
export const setThemeTool = new DynamicStructuredTool({
    name: "set_theme",
    description: `Set the application theme to light, dark, or system (follows OS preference).
Use this when the user wants to switch themes or toggle dark/light mode.`,
    schema: z.object({
        theme: z.enum(["light", "dark", "system"]).describe("The theme to apply"),
    }),
    func: async ({ theme }) => {
        const action: UIAction = {
            action: "set_theme",
            params: { theme }
        };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Theme set to ${theme} mode.`;
    },
});

/**
 * Tool for updating colors
 */
export const updateColorsTool = new DynamicStructuredTool({
    name: "update_colors",
    description: `Update application colors. Accepts HSL color values.
Examples:
- primary: Main brand color for buttons and links (e.g., "hsl(220 80% 55%)" for blue)
- accent: Secondary highlighting color
- background: Page background color

Use this when the user wants to change colors like "make it purple" or "change primary color".`,
    schema: z.object({
        primary: z.string().optional().describe("Primary color in HSL format, e.g., 'hsl(280 65% 60%)'"),
        accent: z.string().optional().describe("Accent color in HSL format"),
        background: z.string().optional().describe("Background color in HSL format"),
    }),
    func: async ({ primary, accent, background }) => {
        const params: Record<string, string> = {};
        if (primary) params.primary = primary;
        if (accent) params.accent = accent;
        if (background) params.background = background;

        if (Object.keys(params).length === 0) {
            return "No colors were specified. Please provide at least one color to update.";
        }

        const action: UIAction = {
            action: "update_colors",
            params
        };

        const colorList = Object.entries(params)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");

        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Updated colors: ${colorList}`;
    },
});

/**
 * Tool for setting font size
 */
export const setFontSizeTool = new DynamicStructuredTool({
    name: "set_font_size",
    description: `Adjust the base font size of the application.
- small: Compact text for dense information
- medium: Default balanced size
- large: Bigger text for improved readability

Use this when the user asks to make text bigger/smaller or adjust font size.`,
    schema: z.object({
        size: z.enum(["small", "medium", "large"]).describe("The font size preset to apply"),
    }),
    func: async ({ size }) => {
        const action: UIAction = {
            action: "set_font_size",
            params: { size }
        };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Font size set to ${size}.`;
    },
});

/**
 * Tool for setting border radius
 */
export const setBorderRadiusTool = new DynamicStructuredTool({
    name: "set_border_radius",
    description: `Adjust the corner rounding of UI elements.
- none: Sharp corners (0rem)
- small: Subtle rounding (0.25rem)
- medium: Moderate rounding (0.5rem) - default
- large: Very rounded corners (1rem)

Use this when the user asks for rounder or sharper corners.`,
    schema: z.object({
        radius: z.enum(["none", "small", "medium", "large"]).describe("The border radius preset to apply"),
    }),
    func: async ({ radius }) => {
        const action: UIAction = {
            action: "set_border_radius",
            params: { radius }
        };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Border radius set to ${radius}.`;
    },
});

/**
 * Tool for resetting all styles to defaults
 */
export const resetStylesTool = new DynamicStructuredTool({
    name: "reset_styles",
    description: `Reset all UI customizations back to the default application styling.
Use this when the user wants to undo all changes or start fresh.`,
    schema: z.object({}),
    func: async () => {
        const action: UIAction = {
            action: "reset_styles",
            params: {}
        };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>All styles have been reset to defaults.`;
    },
});

/**
 * Export all tools for the FrontendAgent
 */
export function createFrontendAgentTools(): DynamicStructuredTool[] {
    return [
        setThemeTool,
        updateColorsTool,
        setFontSizeTool,
        setBorderRadiusTool,
        resetStylesTool,
    ];
}
