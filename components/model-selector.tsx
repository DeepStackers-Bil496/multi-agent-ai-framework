"use client";

import type { Session } from "next-auth";
import { startTransition, useEffect, useMemo, useOptimistic, useState } from "react";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { chatModels } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { CheckCircleFillIcon, ChevronDownIcon } from "./icons";

interface AgentPreference {
  agentId: string;
  enabled: boolean;
}

export function ModelSelector({
  session,
  selectedModelId,
  className,
}: {
  session: Session;
  selectedModelId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);
  const [disabledAgents, setDisabledAgents] = useState<Set<string>>(new Set());

  const userType = session.user.type;
  const { availableChatModelIds } = entitlementsByUserType[userType];

  // Fetch user's agent preferences
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const response = await fetch("/api/user_dashboard/preferences");
        if (response.ok) {
          const data = await response.json();
          const disabled = new Set<string>();
          for (const pref of data.preferences as AgentPreference[]) {
            if (!pref.enabled) {
              disabled.add(pref.agentId);
            }
          }
          setDisabledAgents(disabled);
        }
      } catch {
        // Silently fail - show all agents if preferences can't be fetched
      }
    }
    fetchPreferences();
  }, []);

  // Filter chat models by entitlements and user preferences
  const availableChatModels = useMemo(() => {
    return chatModels.filter((chatModel) => {
      // Must be in entitlements
      if (!availableChatModelIds.includes(chatModel.id)) {
        return false;
      }
      // MainAgent is always available
      if (chatModel.id === "main-agent") {
        return true;
      }
      // Filter out disabled agents
      return !disabledAgents.has(chatModel.id);
    });
  }, [availableChatModelIds, disabledAgents]);

  const selectedChatModel = useMemo(
    () =>
      availableChatModels.find(
        (chatModel) => chatModel.id === optimisticModelId
      ),
    [optimisticModelId, availableChatModels]
  );

  // If selected model is now disabled, fall back to main-agent
  useEffect(() => {
    if (!selectedChatModel && availableChatModels.length > 0) {
      const mainAgent = availableChatModels.find((m) => m.id === "main-agent");
      if (mainAgent) {
        startTransition(() => {
          setOptimisticModelId(mainAgent.id);
          saveChatModelAsCookie(mainAgent.id);
        });
      }
    }
  }, [selectedChatModel, availableChatModels, setOptimisticModelId]);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          "w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
          className
        )}
      >
        <Button
          className="md:h-[34px] md:px-2"
          data-testid="model-selector"
          variant="outline"
        >
          {selectedChatModel?.name ?? "Select Agent"}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[280px] max-w-[90vw] sm:min-w-[300px]"
      >
        {availableChatModels.map((chatModel) => {
          const { id } = chatModel;

          return (
            <DropdownMenuItem
              asChild
              data-active={id === optimisticModelId}
              data-testid={`model-selector-item-${id}`}
              key={id}
              onSelect={() => {
                setOpen(false);

                startTransition(() => {
                  setOptimisticModelId(id);
                  saveChatModelAsCookie(id);
                });
              }}
            >
              <button
                className="group/item flex w-full flex-row items-center justify-between gap-2 sm:gap-4"
                type="button"
              >
                <div className="flex flex-col items-start gap-1">
                  <div className="text-sm sm:text-base">{chatModel.name}</div>
                  <div className="line-clamp-2 text-muted-foreground text-xs">
                    {chatModel.description}
                  </div>
                </div>

                <div className="shrink-0 text-foreground opacity-0 group-data-[active=true]/item:opacity-100 dark:text-foreground">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
