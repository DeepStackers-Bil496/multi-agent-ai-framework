"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";
import { Command, Settings, BotIcon } from "lucide-react";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { AgentPanelDrawer } from "./agent-panel";


function PureChatHeader({
  chatId,
  selectedVisibilityType,
  selectedModelId,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  isReadonly: boolean;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { toggle } = useCommandPalette();
  const [isAgentPanelOpen, setIsAgentPanelOpen] = useState(false);

  const { width: windowWidth } = useWindowSize();
  return (
    <>
      <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
        <SidebarToggle />
      </header>

      <AgentPanelDrawer
        open={isAgentPanelOpen}
        onOpenChange={setIsAgentPanelOpen}
        selectedModelId={selectedModelId}
      />
    </>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
