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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="h-8 px-2 md:h-fit md:px-2"
              onClick={() => toggle()}
            >
              <Command className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent align="start" className="hidden md:block">
            Search or commands
          </TooltipContent>
        </Tooltip>

        {(!open || windowWidth < 768) && (
          <Button
            className="order-2 ml-auto h-8 px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            variant="outline"
          >
            <PlusIcon />
            <span className="md:sr-only">New Chat</span>
          </Button>
        )}

        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            className="order-1 md:order-2"
            selectedVisibilityType={selectedVisibilityType}
          />
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-3 h-8 px-2 md:h-fit md:px-2"
              onClick={() => setIsAgentPanelOpen(true)}
            >
              <BotIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent align="end" className="hidden md:block">
            Agent Settings
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-4 h-8 px-2 md:h-fit md:px-2"
              asChild
            >
              <Link href="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent align="end" className="hidden md:block">
            Settings
          </TooltipContent>
        </Tooltip>

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
