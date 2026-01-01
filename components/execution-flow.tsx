"use client";

import { useEffect, useState, useMemo } from "react";
import {
    ChevronDownIcon,
    ChevronRightIcon,
    CheckCircle2Icon,
    CircleIcon,
    ClockIcon,
    AlertCircleIcon,
    WrenchIcon,
    BotIcon,
    CopyIcon,
    CheckIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionStep } from "@/lib/types";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ToolInput, ToolOutput } from "./elements/tool";
import { toast } from "./toast";

interface ExecutionFlowProps {
    steps: ExecutionStep[];
}

export function ExecutionFlow({ steps }: ExecutionFlowProps) {
    if (!steps || steps.length === 0) return null;

    return (
        <div className="flex flex-col gap-2 my-4 w-full max-w-full overflow-hidden">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-1">
                <BotIcon size={14} />
                Execution Flow
            </div>
            <div className="flex flex-col gap-1">
                {steps.map((step) => (
                    <ExecutionStepItem key={step.id} step={step} depth={0} />
                ))}
            </div>
        </div>
    );
}

function ExecutionStepItem({ step, depth }: { step: ExecutionStep; depth: number }) {
    const [isOpen, setIsOpen] = useState(true);
    const [now, setNow] = useState(Date.now());
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (step.status === "running") {
            const interval = setInterval(() => setNow(Date.now()), 100);
            return () => clearInterval(interval);
        }
    }, [step.status]);

    const duration = step.endTime ? step.endTime - step.startTime : now - step.startTime;
    const formattedDuration = (duration / 1000).toFixed(1) + "s";

    const statusIcon = useMemo(() => {
        switch (step.status) {
            case "running":
                return <ClockIcon className="size-3.5 text-blue-500 animate-pulse" />;
            case "completed":
                return <CheckCircle2Icon className="size-3.5 text-green-500" />;
            case "error":
                return <AlertCircleIcon className="size-3.5 text-red-500" />;
            default:
                return <CircleIcon className="size-3.5 text-muted-foreground" />;
        }
    }, [step.status]);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const textToCopy = step.output ? (typeof step.output === "string" ? step.output : JSON.stringify(step.output, null, 2)) : "";
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({ type: "success", description: "Result copied to clipboard" });
        }
    };

    const hasChildren = step.children && step.children.length > 0;
    const isTool = step.type === "tool";

    return (
        <div className={cn("flex flex-col rounded-md border bg-card/50", depth > 0 && "ml-4 mt-1")}>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                    <div className={cn(
                        "flex items-center gap-2 p-2 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-md",
                        !isOpen && "rounded-md"
                    )}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            {statusIcon}
                            {isTool ? (
                                <WrenchIcon size={14} className="text-muted-foreground shrink-0" />
                            ) : (
                                <BotIcon size={14} className="text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate">{step.name}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground font-mono">{formattedDuration}</span>
                            {(hasChildren || isTool) && (
                                isOpen ? <ChevronDownIcon size={14} className="text-muted-foreground" /> : <ChevronRightIcon size={14} className="text-muted-foreground" />
                            )}
                        </div>
                    </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="p-2 pt-0 flex flex-col gap-1 border-t bg-accent/20">
                        {isTool && (
                            <div className="flex flex-col gap-2 p-2">
                                {step.input && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase">Input</span>
                                        <div className="rounded border bg-background/50 text-[11px] font-mono p-2 overflow-x-auto max-h-40">
                                            <pre>{JSON.stringify(step.input, null, 2)}</pre>
                                        </div>
                                    </div>
                                )}
                                {step.output && (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Result</span>
                                            <Button variant="ghost" size="icon" className="size-6" onClick={handleCopy}>
                                                {copied ? <CheckIcon size={12} className="text-green-500" /> : <CopyIcon size={12} />}
                                            </Button>
                                        </div>
                                        <div className="rounded border bg-background/50 text-[11px] font-mono p-2 overflow-x-auto max-h-60">
                                            <pre>{typeof step.output === "string" ? step.output : JSON.stringify(step.output, null, 2)}</pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {hasChildren && (
                            <div className="flex flex-col gap-1">
                                {step.children.map((child) => (
                                    <ExecutionStepItem key={child.id} step={child} depth={depth + 1} />
                                ))}
                            </div>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
