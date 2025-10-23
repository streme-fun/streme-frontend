"use client";

import Image from "next/image";
import { useState, memo } from "react";

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

// Validate if a string is a valid URL
const isValidUrl = (urlString: string): boolean => {
  try {
    // Allow relative paths starting with /
    if (urlString.startsWith('/')) return true;

    // For absolute URLs, try to construct URL object
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
};

const SafeImageComponent = ({
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
}: SafeImageProps) => {
  // Validate URL before using it
  const validatedSrc = src && isValidUrl(src) ? src : fallbackSrc;
  const [imageSrc, setImageSrc] = useState<string>(validatedSrc);
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
};

export default memo(SafeImageComponent);