"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import sdk from "@farcaster/miniapp-sdk";
import type {
  Context,
  MiniAppNotificationDetails,
} from "@farcaster/miniapp-core";
import { createStore } from "mipd";
import React from "react";

// Extend Window interface for custom properties
declare global {
  interface Window {
    __FARCASTER_SDK_INITIALIZED__?: boolean;
    __FARCASTER_SDK_INIT_TIME__?: number;
  }
}

// Centralized SDK access
export function getFrameSDK() {
  if (typeof window !== "undefined" && !window.__FARCASTER_SDK_INITIALIZED__) {
    console.warn("SDK not yet initialized");
  }
  return sdk;
}

interface FrameContextType {
  isSDKLoaded: boolean;
  context: Context.MiniAppContext | undefined;
  openUrl: (url: string) => Promise<void>;
  close: () => Promise<void>;
  added: boolean;
  notificationDetails: MiniAppNotificationDetails | null;
  lastEvent: string;
  addFrame: () => Promise<void>;
  addFrameResult: string;
}

const FrameContext = React.createContext<FrameContextType | undefined>(
  undefined
);

export function useFrame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.MiniAppContext>();
  const [added, setAdded] = useState(false);
  const [notificationDetails, setNotificationDetails] =
    useState<MiniAppNotificationDetails | null>(null);
  const [lastEvent, setLastEvent] = useState("");
  const [addFrameResult, setAddFrameResult] = useState("");
  const initializationRef = useRef(false);

  // SDK actions only work in mini app clients, so this pattern supports browser actions as well
  const openUrl = useCallback(
    async (url: string) => {
      if (context) {
        await sdk.actions.openUrl(url);
      } else {
        window.open(url, "_blank");
      }
    },
    [context]
  );

  const close = useCallback(async () => {
    if (context) {
      await sdk.actions.close();
    } else {
      window.close();
    }
  }, [context]);

  const addFrame = useCallback(async () => {
    try {
      setNotificationDetails(null);
      const result = await sdk.actions.addFrame();

      if (result.notificationDetails) {
        setNotificationDetails(result.notificationDetails);
      }
      setAddFrameResult(
        result.notificationDetails
          ? `Added, got notificaton token ${result.notificationDetails.token} and url ${result.notificationDetails.url}`
          : "Added, got no notification details"
      );
    } catch (error) {
      // Type assertion for error handling
      const err = error as { name?: string; message: string };
      if (
        err &&
        (err.name === "RejectedByUser" ||
          err.name === "InvalidDomainManifestJson")
      ) {
        setAddFrameResult(`Not added: ${err.message}`);
      } else {
        // Fallback for other errors
        setAddFrameResult(`Error: ${err.message || String(error)}`);
      }
    }
  }, []);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializationRef.current) {
      return;
    }

    // Mark as initialized immediately to prevent re-entry
    initializationRef.current = true;

    // Global check to prevent multiple SDK instances, but still load context
    if (typeof window !== "undefined" && window.__FARCASTER_SDK_INITIALIZED__) {
      // Only log once when first detected, not on every re-render
      if (!isSDKLoaded) {
        console.log("SDK already initialized globally, loading context...");
      }

      // Still need to load context even if SDK is already initialized
      const loadContextOnly = async () => {
        try {
          const context = await sdk.context;
          setContext(context);
          setIsSDKLoaded(true);
        } catch (error) {
          console.error("Error loading context on re-initialization:", error);
          setIsSDKLoaded(true);
        }
      };
      loadContextOnly();
      return;
    }
    let storeUnsubscribe: (() => void) | null = null;

    const load = async () => {
      try {
        console.log("Starting SDK initialization...", {
          timestamp: new Date().toISOString(),
          stack: new Error().stack?.split("\n").slice(2, 5).join("\n"),
        });

        // Mark SDK as globally initialized
        if (typeof window !== "undefined") {
          window.__FARCASTER_SDK_INITIALIZED__ = true;
          window.__FARCASTER_SDK_INIT_TIME__ = Date.now();
        }
        const context = await sdk.context;
        setContext(context);

        // Set up event listeners
        sdk.on("miniAppAdded", ({ notificationDetails }) => {
          console.log("Frame added", notificationDetails);
          setAdded(true);
          setNotificationDetails(notificationDetails ?? null);
          setLastEvent("Frame added");
        });

        sdk.on("miniAppAddRejected", ({ reason }) => {
          console.log("Frame add rejected", reason);
          setAdded(false);
          setLastEvent(`Frame add rejected: ${reason}`);
        });

        sdk.on("miniAppRemoved", () => {
          console.log("Frame removed");
          setAdded(false);
          setLastEvent("Frame removed");
        });

        sdk.on("notificationsEnabled", ({ notificationDetails }) => {
          console.log("Notifications enabled", notificationDetails);
          setNotificationDetails(notificationDetails ?? null);
          setLastEvent("Notifications enabled");
        });

        sdk.on("notificationsDisabled", () => {
          console.log("Notifications disabled");
          setNotificationDetails(null);
          setLastEvent("Notifications disabled");
        });

        sdk.on("primaryButtonClicked", () => {
          console.log("Primary button clicked");
          setLastEvent("Primary button clicked");
        });

        // Call ready action
        console.log("Calling ready");
        await sdk.actions.ready({});

        console.log("SDK loaded, context available");

        // Only mark as loaded after everything is initialized
        setIsSDKLoaded(true);
      } catch (error) {
        console.error("Error initializing SDK:", error);
        // Still mark as loaded to prevent infinite loading, but with no context
        setIsSDKLoaded(true);
      }
    };

    // Set up MIPD Store outside of async function to ensure proper cleanup
    try {
      const store = createStore();
      storeUnsubscribe = store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
      });
    } catch (error) {
      console.error("Error setting up MIPD store:", error);
    }

    // Add a timeout to prevent infinite loading in non-frame environments
    const timeoutId = setTimeout(() => {
      if (!isSDKLoaded) {
        console.log(
          "SDK initialization timeout - marking as loaded without context"
        );
        setIsSDKLoaded(true);
      }
    }, 3000); // 3 second timeout

    if (sdk) {
      console.log("Calling load");
      load();
    } else {
      setIsSDKLoaded(true);
    }

    return () => {
      clearTimeout(timeoutId);
      sdk.removeAllListeners();
      // Clean up MIPD store subscription
      if (storeUnsubscribe) {
        storeUnsubscribe();
      }
      // Note: We intentionally don't clear the global flag here
      // because the SDK should remain initialized for the app lifetime
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isSDKLoaded,
    context,
    added,
    notificationDetails,
    lastEvent,
    addFrame,
    addFrameResult,
    openUrl,
    close,
  };
}

export function FrameProvider({ children }: { children: React.ReactNode }) {
  const frameContext = useFrame();

  // Always render children - the app logic will handle frame vs non-frame UI
  return (
    <FrameContext.Provider value={frameContext}>
      {children}
    </FrameContext.Provider>
  );
}
