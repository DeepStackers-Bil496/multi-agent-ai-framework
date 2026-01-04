"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useTheme } from "next-themes";

/**
 * UI Preferences state interface
 */
export interface UIPreferences {
    theme: "light" | "dark" | "system";
    primaryColor: string | null;
    accentColor: string | null;
    backgroundColor: string | null;
    fontSize: "small" | "medium" | "large";
    borderRadius: "none" | "small" | "medium" | "large";
}

/**
 * UI Action from agent tool output
 */
export interface UIAction {
    action: "set_theme" | "update_colors" | "set_font_size" | "set_border_radius" | "reset_styles";
    params: Record<string, unknown>;
}

const DEFAULT_PREFERENCES: UIPreferences = {
    theme: "system",
    primaryColor: null,
    accentColor: null,
    backgroundColor: null,
    fontSize: "medium",
    borderRadius: "medium",
};

const STORAGE_KEY = "ui-preferences";

const FONT_SIZE_MAP = {
    small: "14px",
    medium: "16px",
    large: "18px",
};

const BORDER_RADIUS_MAP = {
    none: "0rem",
    small: "0.25rem",
    medium: "0.5rem",
    large: "1rem",
};

interface UIPreferencesContextType {
    preferences: UIPreferences;
    applyUIAction: (action: UIAction) => void;
    setThemePreference: (theme: UIPreferences["theme"]) => void;
    updateColors: (colors: Partial<Pick<UIPreferences, "primaryColor" | "accentColor" | "backgroundColor">>) => void;
    setFontSize: (size: UIPreferences["fontSize"]) => void;
    setBorderRadius: (radius: UIPreferences["borderRadius"]) => void;
    resetStyles: () => void;
}

const UIPreferencesContext = createContext<UIPreferencesContextType | undefined>(undefined);

/**
 * Apply CSS custom properties to the document root
 */
function applyCSSVariables(preferences: UIPreferences) {
    const root = document.documentElement;

    // Apply font size
    root.style.setProperty("--font-size-base", FONT_SIZE_MAP[preferences.fontSize]);

    // Apply border radius
    root.style.setProperty("--radius", BORDER_RADIUS_MAP[preferences.borderRadius]);

    // Apply custom colors if set
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
}

/**
 * Reset all custom CSS variables
 */
function resetCSSVariables() {
    const root = document.documentElement;
    root.style.removeProperty("--font-size-base");
    root.style.removeProperty("--radius");
    root.style.removeProperty("--primary");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--background");
}

export function UIPreferencesProvider({ children }: { children: ReactNode }) {
    const { setTheme } = useTheme();
    const [preferences, setPreferences] = useState<UIPreferences>(DEFAULT_PREFERENCES);
    const [isHydrated, setIsHydrated] = useState(false);

    // Load preferences from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as UIPreferences;
                setPreferences(parsed);
            }
        } catch (error) {
            console.warn("[UIPreferences] Failed to load stored preferences:", error);
        }
        setIsHydrated(true);
    }, []);

    // Apply CSS variables whenever preferences change
    useEffect(() => {
        if (isHydrated) {
            applyCSSVariables(preferences);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        }
    }, [preferences, isHydrated]);

    // Sync theme with next-themes
    useEffect(() => {
        if (isHydrated) {
            setTheme(preferences.theme);
        }
    }, [preferences.theme, setTheme, isHydrated]);

    const setThemePreference = useCallback((theme: UIPreferences["theme"]) => {
        setPreferences((prev) => ({ ...prev, theme }));
    }, []);

    const updateColors = useCallback(
        (colors: Partial<Pick<UIPreferences, "primaryColor" | "accentColor" | "backgroundColor">>) => {
            setPreferences((prev) => ({ ...prev, ...colors }));
        },
        []
    );

    const setFontSize = useCallback((fontSize: UIPreferences["fontSize"]) => {
        setPreferences((prev) => ({ ...prev, fontSize }));
    }, []);

    const setBorderRadius = useCallback((borderRadius: UIPreferences["borderRadius"]) => {
        setPreferences((prev) => ({ ...prev, borderRadius }));
    }, []);

    const resetStyles = useCallback(() => {
        resetCSSVariables();
        setPreferences(DEFAULT_PREFERENCES);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    /**
     * Process a UI action from the agent
     */
    const applyUIAction = useCallback(
        (action: UIAction) => {
            console.log("[UIPreferences] Applying UI action:", action);

            switch (action.action) {
                case "set_theme": {
                    const theme = action.params.theme as UIPreferences["theme"];
                    if (theme) setThemePreference(theme);
                    break;
                }
                case "update_colors": {
                    const colors: Partial<Pick<UIPreferences, "primaryColor" | "accentColor" | "backgroundColor">> = {};
                    if (action.params.primary) colors.primaryColor = action.params.primary as string;
                    if (action.params.accent) colors.accentColor = action.params.accent as string;
                    if (action.params.background) colors.backgroundColor = action.params.background as string;
                    updateColors(colors);
                    break;
                }
                case "set_font_size": {
                    const size = action.params.size as UIPreferences["fontSize"];
                    if (size) setFontSize(size);
                    break;
                }
                case "set_border_radius": {
                    const radius = action.params.radius as UIPreferences["borderRadius"];
                    if (radius) setBorderRadius(radius);
                    break;
                }
                case "reset_styles": {
                    resetStyles();
                    break;
                }
                default:
                    console.warn("[UIPreferences] Unknown action:", action);
            }
        },
        [setThemePreference, updateColors, setFontSize, setBorderRadius, resetStyles]
    );

    return (
        <UIPreferencesContext.Provider
            value={{
                preferences,
                applyUIAction,
                setThemePreference,
                updateColors,
                setFontSize,
                setBorderRadius,
                resetStyles,
            }}
        >
            {children}
        </UIPreferencesContext.Provider>
    );
}

/**
 * Hook to access UI preferences context
 */
export function useUIPreferences(): UIPreferencesContextType {
    const context = useContext(UIPreferencesContext);
    if (!context) {
        throw new Error("useUIPreferences must be used within a UIPreferencesProvider");
    }
    return context;
}

/**
 * Parse UI_ACTION tags from agent response text and return actions
 */
export function parseUIActions(text: string): UIAction[] {
    const actions: UIAction[] = [];
    const regex = /<UI_ACTION>(.*?)<\/UI_ACTION>/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        try {
            let jsonStr = match[1];
            // Handle escaped JSON (when string comes from JSON.stringify)
            // Replace escaped quotes with actual quotes
            if (jsonStr.includes('\\"')) {
                jsonStr = jsonStr.replace(/\\"/g, '"');
            }
            const action = JSON.parse(jsonStr) as UIAction;
            actions.push(action);
        } catch (error) {
            console.warn("[UIPreferences] Failed to parse UI action:", match[1], error);
        }
    }

    return actions;
}

/**
 * Remove UI_ACTION tags from text for display
 */
export function stripUIActionTags(text: string): string {
    return text.replace(/<UI_ACTION>.*?<\/UI_ACTION>/g, "").trim();
}
