"use client";

import { cn } from "@/lib/utils";

export function AudioPlayer({
  src,
  className,
  autoPlay = false,
}: {
  src: string;
  className?: string;
  autoPlay?: boolean;
}) {
  return (
    <audio
      autoPlay={autoPlay}
      className={cn("w-full max-w-sm", className)}
      controls
      preload="none"
      src={src}
    />
  );
}
