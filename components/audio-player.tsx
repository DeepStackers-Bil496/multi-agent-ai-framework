"use client";

import { cn } from "@/lib/utils";

export function AudioPlayer({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  return (
    <audio
      className={cn("w-full max-w-sm", className)}
      controls
      preload="none"
      src={src}
    />
  );
}
