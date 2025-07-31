import sdk from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";

export interface MiniAppDetectionResult {
  isMiniApp: boolean;
  clientFid?: number;
  detectionMethod: 'clientFid' | 'sdk' | 'iframe' | 'none';
  context?: Context.MiniAppContext;
}

/**
 * Comprehensive mini-app detection that works at different app lifecycle stages
 * 
 * @param farcasterContext - Optional Farcaster context from FrameProvider (if available)
 * @returns Promise<MiniAppDetectionResult>
 */
export async function detectMiniApp(
  farcasterContext?: Context.MiniAppContext
): Promise<MiniAppDetectionResult> {
  try {
    console.log("🔍 Starting mini-app detection...");

    // Method 1: Use provided Farcaster context (most reliable when available)
    if (farcasterContext?.client?.clientFid) {
      console.log("Using provided Farcaster context:", farcasterContext.client.clientFid);
      
      // Check for Base App specifically
      if (farcasterContext.client.clientFid === 309857) {
        console.log("Base App detected via provided context (clientFid 309857)");
        return {
          isMiniApp: true,
          clientFid: 309857,
          detectionMethod: 'clientFid',
          context: farcasterContext
        };
      }
      
      // Any other Farcaster client
      console.log(`Other Farcaster client detected via provided context: ${farcasterContext.client.clientFid}`);
      return {
        isMiniApp: true,
        clientFid: farcasterContext.client.clientFid,
        detectionMethod: 'clientFid',
        context: farcasterContext
      };
    }

    // Method 2: Try to get SDK context directly (fallback when no context provided)
    try {
      const context = await sdk.context;
      console.log("Retrieved SDK context:", context?.client?.clientFid);
      
      if (context?.client?.clientFid === 309857) {
        console.log("Base App detected via SDK context (clientFid 309857)");
        return {
          isMiniApp: true,
          clientFid: 309857,
          detectionMethod: 'clientFid',
          context
        };
      }
      
      if (context?.client?.clientFid) {
        console.log(`Other Farcaster client detected via SDK context: ${context.client.clientFid}`);
        return {
          isMiniApp: true,
          clientFid: context.client.clientFid,
          detectionMethod: 'clientFid',
          context
        };
      }
    } catch (contextError) {
      console.warn("Could not get SDK context:", contextError);
    }

    // Method 3: Try SDK isInMiniApp method
    try {
      const isMiniApp = await sdk.isInMiniApp();
      console.log(`sdk.isInMiniApp() result: ${isMiniApp}`);
      
      if (isMiniApp) {
        return {
          isMiniApp: true,
          detectionMethod: 'sdk'
        };
      }
    } catch (sdkError) {
      console.warn("sdk.isInMiniApp() not supported:", sdkError);
    }

    // Method 4: Basic iframe detection (last resort)
    const isInIframe = typeof window !== "undefined" && 
      !window.location.hostname.includes("localhost") &&
      !window.location.hostname.includes("127.0.0.1") &&
      (window.parent !== window || window.location !== window.parent.location);

    if (isInIframe) {
      console.log("Iframe context detected (potential mini-app)");
      return {
        isMiniApp: true,
        detectionMethod: 'iframe'
      };
    }

    // No mini-app detected
    console.log("No mini-app detected, using desktop mode");
    return {
      isMiniApp: false,
      detectionMethod: 'none'
    };

  } catch (error) {
    console.error("Error during mini-app detection:", error);
    return {
      isMiniApp: false,
      detectionMethod: 'none'
    };
  }
}

/**
 * Quick environment detection for early provider selection
 * Does not require React context, suitable for ClientLayout
 */
export async function detectEnvironmentForProviders(): Promise<boolean> {
  const result = await detectMiniApp();
  return result.isMiniApp;
}

/**
 * Enhanced detection with Farcaster context for app logic
 * Use this in useAppFrameLogic when FrameProvider context is available
 */
export async function detectMiniAppWithContext(
  farcasterContext?: Context.MiniAppContext
): Promise<MiniAppDetectionResult> {
  return detectMiniApp(farcasterContext);
}