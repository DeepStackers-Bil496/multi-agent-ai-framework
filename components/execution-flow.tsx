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
    BotIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionStep } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { toast } from "./toast";
import { BrainIcon } from "lucide-react";

interface ExecutionFlowProps {
    steps: ExecutionStep[];
}

export function ThinkingFlow({ steps }: ExecutionFlowProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [duration, setDuration] = useState(0);
    const [startTime] = useState(Date.now());
    const isStreaming = useMemo(() => {
        const checkActive = (s: ExecutionStep): boolean => {
            if (s.status !== "running") return false;
            // A step is actively "thinking" if:
            // 1. It's a tool (tools are always considered active thinking)
            // 2. It's an agent that hasn't started any tools yet (initial reasoning phase)
            // 3. It's an agent that has a child currently active
            return s.type === "tool" || s.children.length === 0 || s.children.some(checkActive);
        };
        return steps.some(checkActive);
    }, [steps]);

    useEffect(() => {
        if (isStreaming) {
            const interval = setInterval(() => {
                setDuration(Math.round((Date.now() - startTime) / 1000));
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isStreaming, startTime]);

    const totalDuration = useMemo(() => {
        if (isStreaming) return duration;

        let minStart = Infinity;
        let maxEnd = 0;

        const traverse = (s: ExecutionStep) => {
            if (s.startTime < minStart) minStart = s.startTime;
            if (s.endTime && s.endTime > maxEnd) maxEnd = s.endTime;
            s.children.forEach(traverse);
        };

        steps.forEach(traverse);

        if (minStart === Infinity || maxEnd === 0) return 0;
        return Math.round((maxEnd - minStart) / 1000);
    }, [steps, isStreaming, duration]);

    if (!steps || steps.length === 0) return null;

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="not-prose my-2 border rounded-lg overflow-hidden bg-accent/5"
        >
            <CollapsibleTrigger className="flex items-center gap-1.5 px-3 py-2 text-muted-foreground text-xs transition-colors hover:text-foreground w-full bg-accent/10 relative overflow-hidden group">
                <motion.div
                    animate={isStreaming ? {
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.6, 1],
                        filter: ["drop-shadow(0 0 0px #60a5fa)", "drop-shadow(0 0 8px #60a5fa)", "drop-shadow(0 0 0px #60a5fa)"]
                    } : {}}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                    <BrainIcon className={cn("size-4", isStreaming && "text-blue-400")} />
                </motion.div>
                {isStreaming || totalDuration === 0 ? (
                    <motion.p
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        Thinking...
                    </motion.p>
                ) : (
                    <p>Thought for {totalDuration}s</p>
                )}
                <ChevronDownIcon
                    className={cn(
                        "size-3 text-muted-foreground transition-transform ml-auto group-hover:text-foreground",
                        isOpen ? "rotate-180" : "rotate-0"
                    )}
                />
                {isStreaming && (
                    <motion.div
                        className="absolute bottom-0 left-0 h-[1px] bg-blue-500/50"
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                )}
            </CollapsibleTrigger>
            <AnimatePresence>
                {isOpen && (
                    <CollapsibleContent forceMount asChild>
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden border-t border-dashed"
                        >
                            <div className="p-3">
                                <ExecutionFlow steps={steps} />
                            </div>
                        </motion.div>
                    </CollapsibleContent>
                )}
            </AnimatePresence>
        </Collapsible>
    );
}

export function ExecutionFlow({ steps }: ExecutionFlowProps) {
    if (!steps || steps.length === 0) return null;

    return (
        <div className="flex flex-col gap-1 w-full max-w-full overflow-hidden">
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
                return (
                    <div className="relative">
                        <motion.div
                            className="absolute inset-0 bg-blue-500 rounded-full"
                            animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <ClockIcon className="size-3.5 text-blue-500 relative z-10" />
                    </div>
                );
            case "completed":
                return <CheckCircle2Icon className="size-3.5 text-green-500" />;
            case "error":
                return (
                    <motion.div
                        animate={{ x: [0, -2, 2, -2, 2, 0] }}
                        transition={{ duration: 0.5 }}
                    >
                        <AlertCircleIcon className="size-3.5 text-red-500" />
                    </motion.div>
                );
            default:
                return <CircleIcon className="size-3.5 text-muted-foreground" />;
        }
    }, [step.status]);


    const hasChildren = step.children && step.children.length > 0;
    const isTool = step.type === "tool";

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("flex flex-col rounded-md border bg-card/10 shadow-sm relative", depth > 0 && "ml-4 mt-1")}
        >
            {depth > 0 && (
                <motion.div
                    className="absolute -left-3 top-0 bottom-0 w-[1px] bg-border origin-top"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                />
            )}
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                    <div className={cn(
                        "flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent/30 transition-all rounded-t-md group",
                        !isOpen && "rounded-md"
                    )}>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            {statusIcon}
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
                                    {isTool ? (
                                        <WrenchIcon size={10} className="text-muted-foreground shrink-0" />
                                    ) : (
                                        <BotIcon size={10} className="text-muted-foreground shrink-0" />
                                    )}
                                    <span className="text-[11px] font-semibold truncate uppercase tracking-tight text-foreground/80">
                                        {isTool ? "Tool call" : "Agent called"}
                                    </span>
                                </div>
                                <span className="text-xs font-medium truncate text-foreground">{step.name}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] text-muted-foreground font-mono opacity-70 group-hover:opacity-100 transition-opacity">{formattedDuration}</span>
                            {hasChildren && (
                                <motion.div
                                    animate={{ rotate: isOpen ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ChevronDownIcon size={12} className="text-muted-foreground" />
                                </motion.div>
                            )}
                        </div>
                    </div>
                </CollapsibleTrigger>

                <AnimatePresence>
                    {isOpen && (
                        <CollapsibleContent forceMount asChild>
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="px-2 pb-2 pt-0 flex flex-col gap-2 bg-accent/5">
                                    {hasChildren && (
                                        <div className="flex flex-col gap-1 pt-1 border-t border-dashed border-border/50">
                                            {step.children.map((child) => (
                                                <ExecutionStepItem key={child.id} step={child} depth={depth + 1} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </CollapsibleContent>
                    )}
                </AnimatePresence>
            </Collapsible>
        </motion.div>
    );
}
