"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FiDownload, FiMaximize2, FiX } from "react-icons/fi";

export interface GeneratedImageData {
  imageUrl: string;
  prompt: string;
  model: string;
  dimensions?: {
    width: number;
    height: number;
  };
  aspectRatio?: string;
}

interface GeneratedImageProps {
  data: GeneratedImageData;
  className?: string;
}

export function GeneratedImage({ data, className }: GeneratedImageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check if image is already loaded from cache
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setIsLoading(false);
    }
  }, [data.imageUrl]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = data.imageUrl;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modelName = data.model?.split("/").pop() || data.model || "Unknown";

  return (
    <>
      <motion.div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-muted/30 max-w-md",
          className
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Image Container */}
        <div className="relative min-h-[200px]">
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {hasError ? (
            <div className="flex h-[200px] items-center justify-center bg-muted/30 text-muted-foreground">
              <span>Failed to load image</span>
            </div>
          ) : (
            <img
              ref={imgRef}
              src={data.imageUrl}
              alt={data.prompt || "Generated image"}
              className={cn(
                "w-full cursor-pointer transition-opacity duration-300",
                isLoading ? "opacity-0" : "opacity-100"
              )}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setHasError(true);
                setIsLoading(false);
              }}
              onClick={() => setIsExpanded(true)}
            />
          )}
        </div>

        {/* Metadata & Actions */}
        <div className="flex items-center justify-between border-t border-border bg-background/50 px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {modelName} | {data.dimensions ? `${data.dimensions.width}x${data.dimensions.height}` : data.aspectRatio || "1024px"}
            </span>
            <span className="max-w-[250px] truncate text-xs text-muted-foreground/70">
              {data.prompt}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsExpanded(true)}
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Expand"
            >
              <FiMaximize2 size={16} />
            </button>
            <button
              onClick={handleDownload}
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Download"
            >
              <FiDownload size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Expanded Modal */}
      {isExpanded && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setIsExpanded(false)}
        >
          <motion.div
            className="relative max-h-[90vh] max-w-[90vw]"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute -right-2 -top-2 z-10 rounded-full bg-background p-2 shadow-lg transition-colors hover:bg-muted"
            >
              <FiX size={20} />
            </button>
            <img
              src={data.imageUrl}
              alt={data.prompt}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
            <div className="mt-3 rounded-lg bg-background/90 p-3 backdrop-blur">
              <p className="text-sm text-foreground">{data.prompt}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Generated with {modelName} | {data.dimensions ? `${data.dimensions.width}x${data.dimensions.height}` : data.aspectRatio || "1024px"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
