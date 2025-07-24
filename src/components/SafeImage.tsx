"use client";

import Image from "next/image";
import { useState } from "react";

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackSrc?: string;
  unoptimized?: boolean;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
}

const DEFAULT_AVATAR = "/avatars/streme.png";

export default function SafeImage({
  src,
  alt,
  width,
  height,
  className,
  fallbackSrc = DEFAULT_AVATAR,
  unoptimized,
  priority,
  fill,
  sizes,
}: SafeImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError && imageSrc !== fallbackSrc) {
      setHasError(true);
      setImageSrc(fallbackSrc);
    }
  };

  // If no src provided, use fallback immediately
  if (!src) {
    return (
      <Image
        src={fallbackSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        unoptimized={unoptimized}
        priority={priority}
        fill={fill}
        sizes={sizes}
        onError={handleError}
      />
    );
  }

  // Check if image is a GIF and use unoptimized for certain domains
  const isGif = src.toLowerCase().includes('.gif');
  const shouldBeUnoptimized = unoptimized || isGif || src.includes('imagedelivery.net');

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      unoptimized={shouldBeUnoptimized}
      priority={priority}
      fill={fill}
      sizes={sizes}
      onError={handleError}
    />
  );
}