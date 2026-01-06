"use client";

import { Monitor, Sun, Moon, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemeMode = "system" | "light" | "dark";

interface AppearanceModeCardProps {
  mode: ThemeMode;
  currentMode: ThemeMode;
  onSelect: (mode: ThemeMode) => void;
}

const modeConfig = {
  system: {
    icon: Monitor,
    label: "System",
    description: "Match system theme",
    preview: {
      bg: "bg-gradient-to-br from-zinc-100 to-zinc-900",
      elements: ["bg-zinc-200", "bg-zinc-700"],
    },
  },
  light: {
    icon: Sun,
    label: "Light",
    description: "Light background",
    preview: {
      bg: "bg-zinc-100",
      elements: ["bg-zinc-200", "bg-zinc-300"],
    },
  },
  dark: {
    icon: Moon,
    label: "Dark",
    description: "Dark background",
    preview: {
      bg: "bg-zinc-900",
      elements: ["bg-zinc-800", "bg-zinc-700"],
    },
  },
};

export function AppearanceModeCard({
  mode,
  currentMode,
  onSelect,
}: AppearanceModeCardProps) {
  const config = modeConfig[mode];
  const Icon = config.icon;
  const isSelected = currentMode === mode;

  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      className={cn(
        "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      {/* Check indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* Preview */}
      <div
        className={cn(
          "w-full aspect-video rounded-lg overflow-hidden",
          config.preview.bg
        )}
      >
        <div className="p-2 h-full flex flex-col gap-1">
          <div
            className={cn("h-2 w-8 rounded", config.preview.elements[0])}
          />
          <div
            className={cn("h-2 w-12 rounded", config.preview.elements[1])}
          />
          <div
            className={cn("h-2 w-6 rounded", config.preview.elements[0])}
          />
        </div>
      </div>

      {/* Label */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="font-medium">{config.label}</span>
      </div>
    </button>
  );
}
