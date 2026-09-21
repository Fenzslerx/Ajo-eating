"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  aspectRatio?: string
  wrapperClassName?: string
}

export function LazyImage({
  src,
  alt,
  className,
  wrapperClassName,
  aspectRatio,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted/60",
        wrapperClassName
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Skeleton shimmer while loading */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 animate-pulse bg-muted-foreground/10" />
      )}

      {/* Actual image */}
      {!hasError ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          {...props}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          ✕ โหลดรูปไม่สำเร็จ
        </div>
      )}
    </div>
  )
}
