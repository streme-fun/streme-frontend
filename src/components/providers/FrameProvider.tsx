"use client";

import { useEffect, useState, useCallback } from "react";
import sdk, {
  type Context,
  type FrameNotificationDetails,
} from "@farcaster/frame-sdk";
import { createStore } from "mipd";
import React from "react";

interface FrameContextType {
  isSDKLoaded: boolean;
  context: Context.FrameContext | undefined;
  openUrl: (url: string) => Promise<void>;
  close: () => Promise<void>;
  added: boolean;
  notificationDetails: FrameNotificationDetails | null;
  lastEvent: string;
  addFrame: () => Promise<void>;
  addFrameResult: string;
}

const FrameContext = React.createContext<FrameContextType | undefined>(
  undefined
);

export function useFrame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [added, setAdded] = useState(false);
  const [notificationDetails, setNotificationDetails] =
    useState<FrameNotificationDetails | null>(null);
  const [lastEvent, setLastEvent] = useState("");
  const [addFrameResult, setAddFrameResult] = useState("");

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
    const load = async () => {
      try {
        console.log("Starting SDK initialization...");
        const context = await sdk.context;
        setContext(context);

        // Set up event listeners
        sdk.on("frameAdded", ({ notificationDetails }) => {
          console.log("Frame added", notificationDetails);
          setAdded(true);
          setNotificationDetails(notificationDetails ?? null);
          setLastEvent("Frame added");
        });

        sdk.on("frameAddRejected", ({ reason }) => {
          console.log("Frame add rejected", reason);
          setAdded(false);
          setLastEvent(`Frame add rejected: ${reason}`);
        });

        sdk.on("frameRemoved", () => {
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

        // Set up MIPD Store
        const store = createStore();
        store.subscribe((providerDetails) => {
          console.log("PROVIDER DETAILS", providerDetails);
        });

        // Only mark as loaded after everything is initialized
        setIsSDKLoaded(true);
      } catch (error) {
        console.error("Error initializing SDK:", error);
        // Still mark as loaded to prevent infinite loading, but with no context
        setIsSDKLoaded(true);
      }
    };

    // Add a timeout to prevent infinite loading in non-frame environments
    const timeoutId = setTimeout(() => {
      if (!isSDKLoaded) {
        console.log(
          "SDK initialization timeout - marking as loaded without context"
        );
        setIsSDKLoaded(true);
      }
    }, 3000); // 3 second timeout

    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      load();
      return () => {
        clearTimeout(timeoutId);
        sdk.removeAllListeners();
      };
    } else {
      clearTimeout(timeoutId);
    }
  }, [isSDKLoaded]);

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
