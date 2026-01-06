"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionStep } from "@/lib/types";

interface FlowNode {
  id: string;
  type: "agent" | "tool";
  name: string;
  status: "running" | "completed" | "error";
  duration: number;
  depth: number;
  parentId: string | null;
  children: string[];
}

interface ExecutionFlowGraphProps {
  steps: ExecutionStep[];
}

function buildFlowNodes(
  steps: ExecutionStep[],
  parentId: string | null = null,
  depth = 0,
  indexPath = ""
): FlowNode[] {
  const nodes: FlowNode[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const duration = step.endTime ? step.endTime - step.startTime : 0;
    const currentPath = indexPath ? `${indexPath}-${i}` : `${i}`;
    const uniqueId = `${step.id}-${currentPath}`;

    nodes.push({
      id: uniqueId,
      type: step.type,
      name: step.name,
      status: step.status,
      duration,
      depth,
      parentId,
      children: step.children?.map((_, ci) => `${step.children![ci].id}-${currentPath}-${ci}`) || [],
    });

    if (step.children && step.children.length > 0) {
      nodes.push(...buildFlowNodes(step.children, uniqueId, depth + 1, currentPath));
    }
  }

  return nodes;
}

function FlowNodeCard({ node, index }: { node: FlowNode; index: number }) {
  const statusConfig = {
    running: {
      border: "border-blue-500/50",
      bg: "bg-blue-500/10",
      icon: <Clock className="h-3 w-3 text-blue-500" />,
    },
    completed: {
      border: "border-green-500/50",
      bg: "bg-green-500/10",
      icon: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    },
    error: {
      border: "border-red-500/50",
      bg: "bg-red-500/10",
      icon: <AlertCircle className="h-3 w-3 text-red-500" />,
    },
  };

  const config = statusConfig[node.status];
  const isAgent = node.type === "agent";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 min-w-[120px] max-w-[160px]",
        config.border,
        config.bg
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full",
          isAgent ? "bg-primary/20" : "bg-muted"
        )}>
          {isAgent ? (
            <Bot className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        {config.icon}
      </div>
      <span className="text-xs font-medium text-center truncate max-w-full">
        {node.name}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {(node.duration / 1000).toFixed(1)}s
      </span>
    </motion.div>
  );
}

function Arrow({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center px-1"
    >
      <div className="h-[2px] w-4 bg-primary/40" />
      <ArrowRight className="h-4 w-4 text-primary/60 -ml-1" />
    </motion.div>
  );
}

function VerticalConnector({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ delay }}
      className="flex flex-col items-center"
    >
      <div className="w-[2px] h-4 bg-primary/40" />
      <ArrowRight className="h-4 w-4 text-primary/60 rotate-90 -mt-1" />
    </motion.div>
  );
}

interface FlowLevel {
  nodes: FlowNode[];
  depth: number;
}

export function ExecutionFlowGraph({ steps }: ExecutionFlowGraphProps) {
  const { levels, connections } = useMemo(() => {
    const allNodes = buildFlowNodes(steps);

    // Group nodes by depth for level-based rendering
    const levelMap = new Map<number, FlowNode[]>();
    for (const node of allNodes) {
      const existing = levelMap.get(node.depth) || [];
      existing.push(node);
      levelMap.set(node.depth, existing);
    }

    const levels: FlowLevel[] = Array.from(levelMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([depth, nodes]) => ({ depth, nodes }));

    // Build connections for arrows
    const connections: { from: string; to: string }[] = [];
    for (const node of allNodes) {
      for (const childId of node.children) {
        connections.push({ from: node.id, to: childId });
      }
    }

    return { levels, connections };
  }, [steps]);

  if (levels.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        No execution data
      </div>
    );
  }

  // Simple linear flow for sequential executions
  const isLinearFlow = levels.every(l => l.nodes.length === 1);

  if (isLinearFlow) {
    return (
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-0 min-w-max p-4">
          {levels.map((level, levelIndex) => (
            <div key={level.depth} className="flex items-center">
              {levelIndex > 0 && <Arrow delay={levelIndex * 0.1} />}
              <FlowNodeCard node={level.nodes[0]} index={levelIndex} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Tree-like flow for branching executions
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex flex-col gap-4 min-w-max p-4">
        {levels.map((level, levelIndex) => (
          <div key={level.depth} className="flex flex-col items-start gap-2">
            {levelIndex > 0 && (
              <div className="flex items-center gap-2 ml-[60px]">
                <VerticalConnector delay={levelIndex * 0.1} />
              </div>
            )}
            <div
              className="flex items-center gap-4 flex-wrap"
              style={{ marginLeft: level.depth * 40 }}
            >
              {level.nodes.map((node, nodeIndex) => (
                <div key={node.id} className="flex items-center">
                  {nodeIndex > 0 && level.nodes.length > 1 && (
                    <div className="mr-2 text-xs text-muted-foreground">+</div>
                  )}
                  <FlowNodeCard node={node} index={levelIndex + nodeIndex * 0.5} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact horizontal flow for inline display
export function ExecutionFlowGraphCompact({ steps }: ExecutionFlowGraphProps) {
  const flatNodes = useMemo(() => {
    const nodes: Array<FlowNode & { uniqueKey: string }> = [];
    let counter = 0;

    const traverse = (step: ExecutionStep, depth: number, path: string) => {
      const duration = step.endTime ? step.endTime - step.startTime : 0;
      const uniqueKey = `${step.id}-${path}-${counter++}`;

      nodes.push({
        id: step.id,
        uniqueKey,
        type: step.type,
        name: step.name,
        status: step.status,
        duration,
        depth,
        parentId: null,
        children: [],
      });

      // Traverse all children
      if (step.children) {
        for (let i = 0; i < step.children.length; i++) {
          traverse(step.children[i], depth + 1, `${path}-${i}`);
        }
      }
    };

    for (let i = 0; i < steps.length; i++) {
      traverse(steps[i], 0, `${i}`);
    }

    return nodes;
  }, [steps]);

  if (flatNodes.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {flatNodes.map((node, index) => (
        <div key={node.uniqueKey} className="flex items-center">
          {index > 0 && (
            <ArrowRight className="h-3 w-3 text-muted-foreground/50 mx-1 shrink-0" />
          )}
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs shrink-0",
              node.type === "agent"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {node.type === "agent" ? (
              <Bot className="h-3 w-3" />
            ) : (
              <Wrench className="h-3 w-3" />
            )}
            <span className="truncate max-w-[100px]">{node.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
