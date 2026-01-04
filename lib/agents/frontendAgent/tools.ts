/**
 * FrontendAgent Tools
 * Provides UI customization tools for theme, colors, fonts, effects, and styling
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Tool output format sent to frontend for processing
 */
export type UIActionType =
    | "set_theme"
    | "update_colors"
    | "set_font_size"
    | "set_border_radius"
    | "reset_styles"
    | "set_gradient_background"
    | "enable_glassmorphism"
    | "set_shadow_intensity"
    | "set_animation_style"
    | "set_font_family"
    | "apply_preset_theme"
    | "set_message_bubble_style";

export interface UIAction {
    action: UIActionType;
    params: Record<string, unknown>;
}

// ============== EXISTING TOOLS ==============

export const setThemeTool = new DynamicStructuredTool({
    name: "set_theme",
    description: `Set the application theme to light, dark, or system (follows OS preference).
Use this when the user wants to switch themes or toggle dark/light mode.`,
    schema: z.object({
        theme: z.enum(["light", "dark", "system"]).describe("The theme to apply"),
    }),
    func: async ({ theme }) => {
        const action: UIAction = { action: "set_theme", params: { theme } };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Theme set to ${theme} mode.`;
    },
});

export const updateColorsTool = new DynamicStructuredTool({
    name: "update_colors",
    description: `Update application colors. Accepts HSL color values.
Examples:
- primary: Main brand color for buttons and links (e.g., "hsl(220 80% 55%)" for blue)
- accent: Secondary highlighting color
- background: Page background color

Common colors: Purple hsl(280 65% 60%), Blue hsl(220 80% 55%), Green hsl(142 70% 45%), Orange hsl(25 95% 55%), Pink hsl(330 80% 60%)`,
    schema: z.object({
        primary: z.string().optional().describe("Primary color in HSL format"),
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

        const action: UIAction = { action: "update_colors", params };
        const colorList = Object.entries(params).map(([key, value]) => `${key}: ${value}`).join(", ");
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Updated colors: ${colorList}`;
    },
});

export const setFontSizeTool = new DynamicStructuredTool({
    name: "set_font_size",
    description: `Adjust the base font size: small (compact), medium (default), large (readable).`,
    schema: z.object({
        size: z.enum(["small", "medium", "large"]).describe("The font size preset"),
    }),
    func: async ({ size }) => {
        const action: UIAction = { action: "set_font_size", params: { size } };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Font size set to ${size}.`;
    },
});

export const setBorderRadiusTool = new DynamicStructuredTool({
    name: "set_border_radius",
    description: `Adjust corner rounding: none (sharp), small, medium (default), large (very rounded).`,
    schema: z.object({
        radius: z.enum(["none", "small", "medium", "large"]).describe("The border radius preset"),
    }),
    func: async ({ radius }) => {
        const action: UIAction = { action: "set_border_radius", params: { radius } };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Border radius set to ${radius}.`;
    },
});

export const resetStylesTool = new DynamicStructuredTool({
    name: "reset_styles",
    description: `Reset all UI customizations back to defaults. Use when user wants to start fresh.`,
    schema: z.object({}),
    func: async () => {
        const action: UIAction = { action: "reset_styles", params: {} };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>All styles have been reset to defaults.`;
    },
});

// ============== NEW TOOLS ==============

export const setGradientBackgroundTool = new DynamicStructuredTool({
    name: "set_gradient_background",
    description: `Apply a gradient background to the application.
Examples:
- "purple to blue", "sunset" (orange to pink), "ocean" (blue to teal), "forest" (green shades)
- Or specify start and end colors in HSL format`,
    schema: z.object({
        preset: z.enum(["purple_blue", "sunset", "ocean", "forest", "midnight", "aurora", "none"]).optional()
            .describe("Preset gradient name, or 'none' to remove"),
        startColor: z.string().optional().describe("Start color in HSL (if not using preset)"),
        endColor: z.string().optional().describe("End color in HSL (if not using preset)"),
        direction: z.enum(["to-right", "to-bottom", "to-bottom-right", "radial"]).optional()
            .describe("Gradient direction, defaults to 'to-bottom-right'"),
    }),
    func: async ({ preset, startColor, endColor, direction }) => {
        const params: Record<string, string> = {};
        if (preset) params.preset = preset;
        if (startColor) params.startColor = startColor;
        if (endColor) params.endColor = endColor;
        if (direction) params.direction = direction;

        const action: UIAction = { action: "set_gradient_background", params };
        const desc = preset ? `${preset} gradient` : `custom gradient`;
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Applied ${desc} background.`;
    },
});

export const enableGlassmorphismTool = new DynamicStructuredTool({
    name: "enable_glassmorphism",
    description: `Enable or disable frosted glass effect on panels and cards.
Creates a modern, translucent look with blur effects.`,
    schema: z.object({
        enabled: z.boolean().describe("Whether to enable glassmorphism"),
        intensity: z.enum(["subtle", "medium", "strong"]).optional()
            .describe("Blur intensity level, defaults to 'medium'"),
    }),
    func: async ({ enabled, intensity }) => {
        const action: UIAction = {
            action: "enable_glassmorphism",
            params: { enabled, intensity: intensity || "medium" }
        };
        const status = enabled ? `enabled (${intensity || "medium"} intensity)` : "disabled";
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Glassmorphism ${status}.`;
    },
});

export const setShadowIntensityTool = new DynamicStructuredTool({
    name: "set_shadow_intensity",
    description: `Control the shadow depth of UI elements.
- none: Flat design, no shadows
- subtle: Light, barely visible shadows
- medium: Balanced depth (default)
- dramatic: Strong, pronounced shadows for depth`,
    schema: z.object({
        intensity: z.enum(["none", "subtle", "medium", "dramatic"]).describe("Shadow intensity level"),
    }),
    func: async ({ intensity }) => {
        const action: UIAction = { action: "set_shadow_intensity", params: { intensity } };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Shadow intensity set to ${intensity}.`;
    },
});

export const setAnimationStyleTool = new DynamicStructuredTool({
    name: "set_animation_style",
    description: `Configure entrance animations for messages and UI elements.
- none: No animations (instant)
- fade: Smooth fade in
- slide: Slide in from bottom
- bounce: Playful bounce effect
- scale: Scale up from small`,
    schema: z.object({
        style: z.enum(["none", "fade", "slide", "bounce", "scale"]).describe("Animation style"),
        speed: z.enum(["fast", "normal", "slow"]).optional().describe("Animation speed, defaults to 'normal'"),
    }),
    func: async ({ style, speed }) => {
        const action: UIAction = {
            action: "set_animation_style",
            params: { style, speed: speed || "normal" }
        };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Animation style set to ${style} (${speed || "normal"} speed).`;
    },
});

export const setFontFamilyTool = new DynamicStructuredTool({
    name: "set_font_family",
    description: `Change the application font family.
Options:
- default: System default (Geist)
- inter: Clean, modern sans-serif
- roboto: Google's popular font
- mono: Monospace for code-like feel
- serif: Classic, readable serif
- playful: Rounded, friendly font`,
    schema: z.object({
        family: z.enum(["default", "inter", "roboto", "mono", "serif", "playful"]).describe("Font family preset"),
    }),
    func: async ({ family }) => {
        const action: UIAction = { action: "set_font_family", params: { family } };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Font family set to ${family}.`;
    },
});

export const applyPresetThemeTool = new DynamicStructuredTool({
    name: "apply_preset_theme",
    description: `Apply a curated preset theme that combines multiple style settings.
Available themes:
- cyberpunk: Neon colors, dark background, futuristic feel
- ocean: Cool blues and teals, calming
- forest: Natural greens, earthy tones
- sunset: Warm oranges and pinks
- midnight: Deep purples and blues, elegant
- minimal: Clean whites and grays, simple
- retro: Vintage colors, nostalgic feel`,
    schema: z.object({
        theme: z.enum(["cyberpunk", "ocean", "forest", "sunset", "midnight", "minimal", "retro"])
            .describe("The preset theme to apply"),
    }),
    func: async ({ theme }) => {
        const action: UIAction = { action: "apply_preset_theme", params: { theme } };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Applied ${theme} theme preset.`;
    },
});

export const setMessageBubbleStyleTool = new DynamicStructuredTool({
    name: "set_message_bubble_style",
    description: `Customize chat message bubble appearance.
Styles:
- default: Standard rounded bubbles
- minimal: Clean, borderless messages
- rounded: Extra rounded, pill-shaped
- sharp: Square corners, modern look
- outlined: Transparent with colored border`,
    schema: z.object({
        style: z.enum(["default", "minimal", "rounded", "sharp", "outlined"]).describe("Bubble style"),
    }),
    func: async ({ style }) => {
        const action: UIAction = { action: "set_message_bubble_style", params: { style } };
        return `<UI_ACTION>${JSON.stringify(action)}</UI_ACTION>Message bubble style set to ${style}.`;
    },
});

/**
 * Export all tools for the FrontendAgent
 */
export function createFrontendAgentTools(): DynamicStructuredTool[] {
    return [
        // Existing tools
        setThemeTool,
        updateColorsTool,
        setFontSizeTool,
        setBorderRadiusTool,
        resetStylesTool,
        // New tools
        setGradientBackgroundTool,
        enableGlassmorphismTool,
        setShadowIntensityTool,
        setAnimationStyleTool,
        setFontFamilyTool,
        applyPresetThemeTool,
        setMessageBubbleStyleTool,
    ];
}
