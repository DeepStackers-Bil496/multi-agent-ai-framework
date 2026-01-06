import { auth } from "@/app/(auth)/auth";
import { chat, message } from "@/lib/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import type { ExecutionStep } from "@/lib/types";
import { drizzle } from "drizzle-orm/neon-serverless";
import pool from "@/lib/db/pool";

const dbClient = drizzle(pool);

interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalCalls: number;
  totalToolCalls: number;
  avgLatencyMs: number;
  errorCount: number;
  lastUsed: string | null;
}

interface ExecutionEvent {
  id: string;
  type: "agent" | "tool";
  name: string;
  status: "running" | "completed" | "error";
  timestamp: number;
  duration: number;
  chatId: string;
}

function extractMetricsFromSteps(
  steps: ExecutionStep[],
  chatId: string,
  messageId: string,
  metrics: Map<string, AgentMetrics>,
  events: ExecutionEvent[],
  pathPrefix = ""
): void {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const currentPath = pathPrefix ? `${pathPrefix}-${i}` : `${i}`;

    if (step.type === "agent") {
      const existing = metrics.get(step.name) || {
        agentId: step.name.toLowerCase().replace(/\s+/g, "-"),
        agentName: step.name,
        totalCalls: 0,
        totalToolCalls: 0,
        avgLatencyMs: 0,
        errorCount: 0,
        lastUsed: null,
      };

      existing.totalCalls += 1;
      if (step.status === "error") {
        existing.errorCount += 1;
      }

      const duration = step.endTime
        ? step.endTime - step.startTime
        : 0;
      existing.avgLatencyMs =
        (existing.avgLatencyMs * (existing.totalCalls - 1) + duration) /
        existing.totalCalls;

      const stepTime = new Date(step.startTime).toISOString();
      if (!existing.lastUsed || stepTime > existing.lastUsed) {
        existing.lastUsed = stepTime;
      }

      metrics.set(step.name, existing);

      // Generate unique event ID using messageId and path
      const uniqueId = `${messageId}-${currentPath}-${step.startTime}`;

      events.push({
        id: uniqueId,
        type: "agent",
        name: step.name,
        status: step.status,
        timestamp: step.startTime,
        duration,
        chatId,
      });
    }

    if (step.type === "tool") {
      // Find parent agent and increment tool calls
      const parentName = step.name.split("_")[0] || "Unknown";
      const existing = metrics.get(parentName);
      if (existing) {
        existing.totalToolCalls += 1;
      }

      const duration = step.endTime
        ? step.endTime - step.startTime
        : 0;

      // Generate unique event ID using messageId and path
      const uniqueId = `${messageId}-${currentPath}-${step.startTime}`;

      events.push({
        id: uniqueId,
        type: "tool",
        name: step.name,
        status: step.status,
        timestamp: step.startTime,
        duration,
        chatId,
      });
    }

    // Recurse into children
    if (step.children && step.children.length > 0) {
      extractMetricsFromSteps(step.children, chatId, messageId, metrics, events, currentPath);
    }
  }
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get recent messages with execution data
    const recentMessages = await dbClient
      .select({
        id: message.id,
        chatId: message.chatId,
        parts: message.parts,
        createdAt: message.createdAt,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, session.user.id),
          eq(message.role, "assistant"),
          gte(message.createdAt, sevenDaysAgo)
        )
      )
      .orderBy(desc(message.createdAt))
      .limit(100);

    const agentMetrics = new Map<string, AgentMetrics>();
    const allEvents: ExecutionEvent[] = [];
    const recentExecutions: { chatId: string; steps: ExecutionStep[]; createdAt: string }[] = [];

    for (const msg of recentMessages) {
      const parts = msg.parts as Array<{ type: string; data?: ExecutionStep[]; text?: string }>;
      if (!parts) continue;

      for (const part of parts) {
        if (part.type === "data-agent-execution" && part.data) {
          extractMetricsFromSteps(part.data, msg.chatId, msg.id, agentMetrics, allEvents);

          // Store recent executions (limit to 10)
          if (recentExecutions.length < 10) {
            recentExecutions.push({
              chatId: msg.chatId,
              steps: part.data,
              createdAt: msg.createdAt.toISOString(),
            });
          }
        }
      }
    }

    // Calculate summary stats
    const metrics = Array.from(agentMetrics.values());
    const totalAgentCalls = metrics.reduce((sum, m) => sum + m.totalCalls, 0);
    const totalToolCalls = metrics.reduce((sum, m) => sum + m.totalToolCalls, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
    const avgLatency =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.avgLatencyMs, 0) / metrics.length
        : 0;

    // Sort events by timestamp (most recent first)
    allEvents.sort((a, b) => b.timestamp - a.timestamp);

    return Response.json({
      summary: {
        totalAgentCalls,
        totalToolCalls,
        totalErrors,
        avgLatencyMs: Math.round(avgLatency),
        activeAgents: metrics.length,
      },
      agentMetrics: metrics.sort((a, b) => b.totalCalls - a.totalCalls),
      recentEvents: allEvents.slice(0, 50),
      recentExecutions,
    });
  } catch (error) {
    console.error("Failed to get agent metrics:", error);
    return Response.json(
      { error: "Failed to get agent metrics" },
      { status: 500 }
    );
  }
}
