"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useTheme } from "next-themes";

/**
 * UI Preferences state interface - Extended with new features
 */
export interface UIPreferences {
    // Basic
    theme: "light" | "dark" | "system";
    primaryColor: string | null;
    accentColor: string | null;
    backgroundColor: string | null;
    fontSize: "small" | "medium" | "large";
    borderRadius: "none" | "small" | "medium" | "large";
    // New features
    gradient: {
        enabled: boolean;
        preset?: string;
        startColor?: string;
        endColor?: string;
        direction: string;
    };
    glassmorphism: {
        enabled: boolean;
        intensity: "subtle" | "medium" | "strong";
    };
    shadowIntensity: "none" | "subtle" | "medium" | "dramatic";
    animation: {
        style: "none" | "fade" | "slide" | "bounce" | "scale";
        speed: "fast" | "normal" | "slow";
    };
    fontFamily: "default" | "inter" | "roboto" | "mono" | "serif" | "playful";
    messageBubbleStyle: "default" | "minimal" | "rounded" | "sharp" | "outlined";
}

/**
 * UI Action from agent tool output
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

const DEFAULT_PREFERENCES: UIPreferences = {
    theme: "system",
    primaryColor: null,
    accentColor: null,
    backgroundColor: null,
    fontSize: "medium",
    borderRadius: "medium",
    gradient: { enabled: false, direction: "to-bottom-right" },
    glassmorphism: { enabled: false, intensity: "medium" },
    shadowIntensity: "medium",
    animation: { style: "fade", speed: "normal" },
    fontFamily: "default",
    messageBubbleStyle: "default",
};

const STORAGE_KEY = "ui-preferences";

const FONT_SIZE_MAP = { small: "14px", medium: "16px", large: "18px" };
const BORDER_RADIUS_MAP = { none: "0rem", small: "0.25rem", medium: "0.5rem", large: "1rem" };
const SHADOW_MAP = {
    none: "none",
    subtle: "0 1px 2px rgba(0,0,0,0.05)",
    medium: "0 4px 6px rgba(0,0,0,0.1)",
    dramatic: "0 10px 25px rgba(0,0,0,0.25)",
};
const GLASSMORPHISM_MAP = {
    subtle: { blur: "8px", opacity: 0.7 },
    medium: { blur: "16px", opacity: 0.6 },
    strong: { blur: "24px", opacity: 0.5 },
};
const ANIMATION_SPEED_MAP = { fast: "150ms", normal: "300ms", slow: "500ms" };
const FONT_FAMILY_MAP = {
    default: "var(--font-geist), system-ui, sans-serif",
    inter: "'Inter', sans-serif",
    roboto: "'Roboto', sans-serif",
    mono: "var(--font-geist-mono), monospace",
    serif: "Georgia, 'Times New Roman', serif",
    playful: "'Comic Neue', cursive, sans-serif",
};
const GRADIENT_PRESETS: Record<string, { start: string; end: string }> = {
    purple_blue: { start: "hsl(280 70% 50%)", end: "hsl(220 80% 55%)" },
    sunset: { start: "hsl(25 95% 55%)", end: "hsl(330 80% 60%)" },
    ocean: { start: "hsl(200 80% 50%)", end: "hsl(175 70% 40%)" },
    forest: { start: "hsl(120 40% 35%)", end: "hsl(80 50% 45%)" },
    midnight: { start: "hsl(260 50% 25%)", end: "hsl(220 60% 35%)" },
    aurora: { start: "hsl(280 70% 50%)", end: "hsl(175 70% 40%)" },
};
const PRESET_THEMES: Record<string, Partial<UIPreferences>> = {
    cyberpunk: {
        theme: "dark",
        primaryColor: "hsl(320 100% 60%)",
        accentColor: "hsl(180 100% 50%)",
        gradient: { enabled: true, preset: "purple_blue", direction: "to-bottom-right" },
        glassmorphism: { enabled: true, intensity: "medium" },
        shadowIntensity: "dramatic",
        fontFamily: "mono",
    },
    ocean: {
        theme: "light",
        primaryColor: "hsl(200 80% 50%)",
        accentColor: "hsl(175 70% 40%)",
        gradient: { enabled: true, preset: "ocean", direction: "to-bottom" },
        glassmorphism: { enabled: true, intensity: "subtle" },
        shadowIntensity: "subtle",
    },
    forest: {
        theme: "light",
        primaryColor: "hsl(142 70% 35%)",
        accentColor: "hsl(80 50% 45%)",
        gradient: { enabled: true, preset: "forest", direction: "to-bottom" },
        shadowIntensity: "subtle",
    },
    sunset: {
        theme: "light",
        primaryColor: "hsl(25 95% 55%)",
        accentColor: "hsl(330 80% 60%)",
        gradient: { enabled: true, preset: "sunset", direction: "to-bottom-right" },
        shadowIntensity: "medium",
    },
    midnight: {
        theme: "dark",
        primaryColor: "hsl(260 70% 60%)",
        accentColor: "hsl(280 80% 70%)",
        gradient: { enabled: true, preset: "midnight", direction: "to-bottom" },
        glassmorphism: { enabled: true, intensity: "strong" },
        shadowIntensity: "dramatic",
    },
    minimal: {
        theme: "light",
        primaryColor: null,
        accentColor: null,
        gradient: { enabled: false, direction: "to-bottom-right" },
        glassmorphism: { enabled: false, intensity: "medium" },
        shadowIntensity: "subtle",
        borderRadius: "small",
    },
    retro: {
        theme: "light",
        primaryColor: "hsl(35 90% 55%)",
        accentColor: "hsl(10 80% 50%)",
        fontFamily: "serif",
        borderRadius: "none",
        shadowIntensity: "none",
    },
};

interface UIPreferencesContextType {
    preferences: UIPreferences;
    applyUIAction: (action: UIAction) => void;
}

const UIPreferencesContext = createContext<UIPreferencesContextType | undefined>(undefined);

/**
 * Apply CSS custom properties to the document root
 */
function applyCSSVariables(preferences: UIPreferences) {
    const root = document.documentElement;

    // Basic
    root.style.setProperty("--font-size-base", FONT_SIZE_MAP[preferences.fontSize]);
    root.style.setProperty("--radius", BORDER_RADIUS_MAP[preferences.borderRadius]);

    if (preferences.primaryColor) {
        root.style.setProperty("--primary", preferences.primaryColor);
    } else {
        root.style.removeProperty("--primary");
    }
    if (preferences.accentColor) {
        root.style.setProperty("--accent", preferences.accentColor);
    } else {
        root.style.removeProperty("--accent");
    }
    if (preferences.backgroundColor) {
        root.style.setProperty("--background", preferences.backgroundColor);
    } else {
        root.style.removeProperty("--background");
    }

    // Shadows
    root.style.setProperty("--shadow", SHADOW_MAP[preferences.shadowIntensity]);

    // Font family
    root.style.setProperty("--font-family", FONT_FAMILY_MAP[preferences.fontFamily]);

    // Animation
    root.style.setProperty("--animation-speed", ANIMATION_SPEED_MAP[preferences.animation.speed]);
    root.setAttribute("data-animation", preferences.animation.style);

    // Message bubble style
    root.setAttribute("data-bubble-style", preferences.messageBubbleStyle);

    // Glassmorphism
    if (preferences.glassmorphism.enabled) {
        const glass = GLASSMORPHISM_MAP[preferences.glassmorphism.intensity];
        root.style.setProperty("--glass-blur", glass.blur);
        root.style.setProperty("--glass-opacity", glass.opacity.toString());
        root.setAttribute("data-glassmorphism", "true");
    } else {
        root.removeAttribute("data-glassmorphism");
        root.style.removeProperty("--glass-blur");
        root.style.removeProperty("--glass-opacity");
    }

    // Gradient background
    if (preferences.gradient.enabled) {
        let startColor = preferences.gradient.startColor;
        let endColor = preferences.gradient.endColor;

        if (preferences.gradient.preset && GRADIENT_PRESETS[preferences.gradient.preset]) {
            const preset = GRADIENT_PRESETS[preferences.gradient.preset];
            startColor = preset.start;
            endColor = preset.end;
        }

        if (startColor && endColor) {
            const directionMap: Record<string, string> = {
                "to-right": "to right",
                "to-bottom": "to bottom",
                "to-bottom-right": "to bottom right",
                "radial": "circle at center",
            };
            const dir = directionMap[preferences.gradient.direction] || "to bottom right";
            const gradientType = preferences.gradient.direction === "radial" ? "radial-gradient" : "linear-gradient";
            root.style.setProperty("--gradient-bg", `${gradientType}(${dir}, ${startColor}, ${endColor})`);
            root.setAttribute("data-gradient", "true");
        }
    } else {
        root.removeAttribute("data-gradient");
        root.style.removeProperty("--gradient-bg");
    }
}

function resetCSSVariables() {
    const root = document.documentElement;
    const propsToRemove = [
        "--font-size-base", "--radius", "--primary", "--accent", "--background",
        "--shadow", "--font-family", "--animation-speed", "--glass-blur",
        "--glass-opacity", "--gradient-bg"
    ];
    propsToRemove.forEach(prop => root.style.removeProperty(prop));
    ["data-animation", "data-bubble-style", "data-glassmorphism", "data-gradient"].forEach(attr =>
        root.removeAttribute(attr)
    );
}

export function UIPreferencesProvider({ children }: { children: ReactNode }) {
    const { setTheme } = useTheme();
    const [preferences, setPreferences] = useState<UIPreferences>(DEFAULT_PREFERENCES);
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
            }
        } catch (error) {
            console.warn("[UIPreferences] Failed to load:", error);
        }
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (isHydrated) {
            applyCSSVariables(preferences);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        }
    }, [preferences, isHydrated]);

    useEffect(() => {
        if (isHydrated) {
            setTheme(preferences.theme);
        }
    }, [preferences.theme, setTheme, isHydrated]);

    const applyUIAction = useCallback((action: UIAction) => {
        console.log("[UIPreferences] Applying:", action);

        setPreferences(prev => {
            const next = { ...prev };

            switch (action.action) {
                case "set_theme":
                    next.theme = action.params.theme as UIPreferences["theme"];
                    break;

                case "update_colors":
                    if (action.params.primary) next.primaryColor = action.params.primary as string;
                    if (action.params.accent) next.accentColor = action.params.accent as string;
                    if (action.params.background) next.backgroundColor = action.params.background as string;
                    break;

                case "set_font_size":
                    next.fontSize = action.params.size as UIPreferences["fontSize"];
                    break;

                case "set_border_radius":
                    next.borderRadius = action.params.radius as UIPreferences["borderRadius"];
                    break;

                case "reset_styles":
                    resetCSSVariables();
                    localStorage.removeItem(STORAGE_KEY);
                    return DEFAULT_PREFERENCES;

                case "set_gradient_background":
                    if (action.params.preset === "none") {
                        next.gradient = { enabled: false, direction: "to-bottom-right" };
                    } else {
                        next.gradient = {
                            enabled: true,
                            preset: action.params.preset as string,
                            startColor: action.params.startColor as string,
                            endColor: action.params.endColor as string,
                            direction: (action.params.direction as string) || "to-bottom-right",
                        };
                    }
                    break;

                case "enable_glassmorphism":
                    next.glassmorphism = {
                        enabled: action.params.enabled as boolean,
                        intensity: (action.params.intensity as UIPreferences["glassmorphism"]["intensity"]) || "medium",
                    };
                    break;

                case "set_shadow_intensity":
                    next.shadowIntensity = action.params.intensity as UIPreferences["shadowIntensity"];
                    break;

                case "set_animation_style":
                    next.animation = {
                        style: action.params.style as UIPreferences["animation"]["style"],
                        speed: (action.params.speed as UIPreferences["animation"]["speed"]) || "normal",
                    };
                    break;

                case "set_font_family":
                    next.fontFamily = action.params.family as UIPreferences["fontFamily"];
                    break;

                case "apply_preset_theme":
                    const preset = PRESET_THEMES[action.params.theme as string];
                    if (preset) {
                        return { ...DEFAULT_PREFERENCES, ...preset } as UIPreferences;
                    }
                    break;

                case "set_message_bubble_style":
                    next.messageBubbleStyle = action.params.style as UIPreferences["messageBubbleStyle"];
                    break;

                default:
                    console.warn("[UIPreferences] Unknown action:", action);
            }

            return next;
        });
    }, []);

    return (
        <UIPreferencesContext.Provider value={{ preferences, applyUIAction }}>
            {children}
        </UIPreferencesContext.Provider>
    );
}

export function useUIPreferences(): UIPreferencesContextType {
    const context = useContext(UIPreferencesContext);
    if (!context) {
        throw new Error("useUIPreferences must be used within a UIPreferencesProvider");
    }
    return context;
}

export function parseUIActions(text: string): UIAction[] {
    const actions: UIAction[] = [];
    const regex = /<UI_ACTION>(.*?)<\/UI_ACTION>/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        try {
            let jsonStr = match[1];
            if (jsonStr.includes('\\"')) {
                jsonStr = jsonStr.replace(/\\"/g, '"');
            }
            const action = JSON.parse(jsonStr) as UIAction;
            actions.push(action);
        } catch (error) {
            console.warn("[UIPreferences] Failed to parse:", match[1], error);
        }
    }

    return actions;
}

export function stripUIActionTags(text: string): string {
    return text.replace(/<UI_ACTION>.*?<\/UI_ACTION>/g, "").trim();
}
