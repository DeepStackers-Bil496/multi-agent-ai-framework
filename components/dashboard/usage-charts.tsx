"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
} from "@/components/ui/glass-card";

interface MessagesPerDay {
  date: string;
  count: number;
}

interface UsageChartsProps {
  messagesPerDay: MessagesPerDay[];
}

export function UsageCharts({ messagesPerDay }: UsageChartsProps) {
  // Format data for chart
  const chartData = messagesPerDay.map((item) => ({
    date: formatDate(item.date),
    messages: item.count,
  }));

  // Fill in missing dates with 0
  const filledData = fillMissingDates(chartData);

  return (
    <GlassCard intensity="medium" className="col-span-full">
      <GlassCardHeader>
        <GlassCardTitle>Messages Over Time</GlassCardTitle>
        <GlassCardDescription>
          Your message activity over the last 30 days
        </GlassCardDescription>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="h-[300px] w-full">
          {filledData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filledData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted/30"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area
                  type="monotone"
                  dataKey="messages"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMessages)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No activity data available
            </div>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fillMissingDates(
  data: { date: string; messages: number }[]
): { date: string; messages: number }[] {
  if (data.length === 0) return [];

  const result: { date: string; messages: number }[] = [];
  const dataMap = new Map(data.map((d) => [d.date, d.messages]));

  // Generate last 30 days
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const formattedDate = formatDate(date.toISOString().split("T")[0]);
    result.push({
      date: formattedDate,
      messages: dataMap.get(formattedDate) || 0,
    });
  }

  return result;
}
