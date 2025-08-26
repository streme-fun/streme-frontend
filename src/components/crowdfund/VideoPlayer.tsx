"use client";

import { useState, memo } from "react";
import Script from "next/script";

interface VideoPlayerProps {
  src: string;
  onError: () => void;
  onLoad: () => void;
}

const VideoPlayer = memo(
  ({ src, onError, onLoad }: VideoPlayerProps) => {
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const getVimeoId = (url: string): string | null => {
      const match = url.match(/vimeo\.com\/(\d+)/);
      return match ? match[1] : null;
    };

    const isVimeoUrl = src.includes("vimeo.com");
    const vimeoId = isVimeoUrl ? getVimeoId(src) : null;

    const handleError = (event?: Event | React.SyntheticEvent) => {
      console.error("Video/embed failed to load:", src);
      console.error("Error details:", event);
      if (isVimeoUrl) {
        console.error("Vimeo embed details:", {
          id: vimeoId,
          constructedUrl: `https://player.vimeo.com/video/${vimeoId}?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&loop=1&muted=1`,
        });
      }
      setLoading(false);
      setHasError(true);
      onError();
    };

    const handleLoad = () => {
      console.log("Video/embed loaded successfully:", src);
      setLoading(false);
      onLoad();
    };

    const handleIframeLoad = () => {
      setLoading(false);
      onLoad();
    };

    return (
      <>
        {loading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-base-200 rounded-lg z-10">
            <div className="loading loading-spinner loading-lg"></div>
          </div>
        )}
        {!hasError ? (
          <>
            {isVimeoUrl && vimeoId ? (
              <>
                <iframe
                  src={`https://player.vimeo.com/video/${vimeoId}?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&loop=1&muted=1&background=1&color=000000&title=0&byline=0&portrait=0&controls=0&dnt=1&fit=cover`}
                  className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
                    loading ? "opacity-0" : "opacity-100"
                  }`}
                  style={{
                    border: 0,
                    objectFit: "cover",
                  }}
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={handleIframeLoad}
                  onError={handleError}
                  title="$BUTTHOLE Launch"
                />
                <Script
                  src="https://player.vimeo.com/api/player.js"
                  strategy="lazyOnload"
                />
              </>
            ) : (
              <video
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                  loading ? "opacity-0" : "opacity-100"
                }`}
                autoPlay
                loop
                muted
                playsInline
                onError={handleError}
                onLoadedData={handleLoad}
                onLoadStart={() => setLoading(true)}
              >
                <source src={src} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
          </>
        ) : isVimeoUrl && vimeoId ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 transition-colors"
            onClick={() => window.open(src, "_blank")}
          >
            <div className="text-center p-4">
              <div className="text-4xl mb-2">🎥</div>
              <div className="text-sm font-medium">Video Blocked</div>
              <div className="text-xs text-base-content/60 mt-1">
                Click to view on Vimeo
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;