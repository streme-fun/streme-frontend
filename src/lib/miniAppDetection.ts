import sdk from "@farcaster/miniapp-sdk";
import type { Context } from "@farcaster/miniapp-core";

export interface MiniAppDetectionResult {
  isMiniApp: boolean;
  clientFid?: number;
  detectionMethod: "clientFid" | "sdk" | "iframe" | "none";
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
    const callerId = Math.random().toString(36).substring(7);
    console.log(`🔍 [${callerId}] Starting mini-app detection...`);

    // Gather all detection signals first
    const detectionData = {
      userAgent: "",
      hasEthereum: false,
      walletProperties: {} as Record<string, boolean>,
      farcasterClientFid: undefined as number | undefined,
      farcasterContext: undefined as Context.MiniAppContext | undefined,
    };

    // Collect browser/wallet data
    if (typeof window !== "undefined") {
      detectionData.userAgent = window.navigator?.userAgent || "";
      detectionData.hasEthereum = !!window.ethereum;
      
      if (window.ethereum) {
        detectionData.walletProperties = {
          isCoinbaseWallet: !!(window.ethereum.isCoinbaseWallet ||
                             window.ethereum.isCoinbaseWalletExtension ||
                             window.ethereum.isCoinbaseWalletBrowser),
          isRainbow: !!window.ethereum.isRainbow,
          isMetaMask: !!window.ethereum.isMetaMask,
          isRabby: !!window.ethereum.isRabby,
          isTrust: !!(window.ethereum.isTrust || window.ethereum.isTrustWallet),
          isBraveWallet: !!window.ethereum.isBraveWallet,
          isOpera: !!window.ethereum.isOpera,
          isOkxWallet: !!window.ethereum.isOkxWallet,
          isZerion: !!window.ethereum.isZerion,
          isOneInchIOSWallet: !!window.ethereum.isOneInchIOSWallet,
        };
      }
    }

    // Collect Farcaster context data
    console.log(`🔍 [${callerId}] Checking for Farcaster context...`);
    console.log(`🔍 [${callerId}] Provided context:`, farcasterContext);
    
    if (farcasterContext?.client?.clientFid) {
      console.log(`🔍 [${callerId}] Found clientFid in provided context:`, farcasterContext.client.clientFid);
      detectionData.farcasterClientFid = farcasterContext.client.clientFid;
      detectionData.farcasterContext = farcasterContext;
    } else {
      // Try SDK context if no provided context
      console.log(`🔍 [${callerId}] No provided context, trying SDK...`);
      try {
        const context = await sdk.context;
        console.log(`🔍 [${callerId}] SDK context result:`, context);
        if (context?.client?.clientFid) {
          console.log(`🔍 [${callerId}] Found clientFid in SDK context:`, context.client.clientFid);
          detectionData.farcasterClientFid = context.client.clientFid;
          detectionData.farcasterContext = context;
        } else {
          console.log(`🔍 [${callerId}] No clientFid in SDK context`);
        }
      } catch (contextError) {
        console.warn(`🔍 [${callerId}] Could not get SDK context:`, contextError);
      }
    }

    // Now make decisions based on combinations of signals
    console.log(`🔍 [${callerId}] Detection data:`, {
      hasWalletProperties: Object.values(detectionData.walletProperties).some(Boolean),
      walletProperties: detectionData.walletProperties,
      farcasterClientFid: detectionData.farcasterClientFid,
      userAgent: detectionData.userAgent.substring(0, 100),
      hasEthereum: detectionData.hasEthereum,
    });

    // Special case: Base app with Coinbase wallet properties
    if (detectionData.farcasterClientFid === 309857) {
      console.log(`🔍 [${callerId}] Base App detected (clientFid 309857) - treating as mini-app regardless of wallet properties`);
      return {
        isMiniApp: true,
        clientFid: 309857,
        detectionMethod: "clientFid" as const,
        context: detectionData.farcasterContext,
      };
    }

    // Check for wallet browsers using the collected data
    const walletChecks = [
      {
        name: "coinbase",
        ethereumCheck: detectionData.walletProperties.isCoinbaseWallet,
        userAgentCheck: detectionData.userAgent.includes("CoinbaseWallet") || 
                        detectionData.userAgent.includes("Coinbase"),
        requireBoth: false, // Already handled Base app case above
      },
      {
        name: "rainbow",
        ethereumCheck: detectionData.walletProperties.isRainbow,
        userAgentCheck: detectionData.userAgent.includes("Rainbow"),
        requireBoth: false,
      },
      {
        name: "metamask",
        ethereumCheck: detectionData.walletProperties.isMetaMask,
        userAgentCheck: detectionData.userAgent.includes("MetaMask"),
        requireBoth: true, // Require both to avoid false positives in Farcaster
      },
      {
        name: "rabby",
        ethereumCheck: detectionData.walletProperties.isRabby,
        userAgentCheck: detectionData.userAgent.includes("Rabby"),
        requireBoth: true, // Require both to avoid false positives in Farcaster
      },
      {
        name: "trust",
        ethereumCheck: detectionData.walletProperties.isTrust,
        userAgentCheck: detectionData.userAgent.includes("TrustWallet"),
        requireBoth: true, // Require both to avoid false positives in Farcaster
      },
      {
        name: "brave",
        ethereumCheck: detectionData.walletProperties.isBraveWallet,
        userAgentCheck: detectionData.userAgent.includes("Brave/"),
        requireBoth: true, // Require both to avoid false positives in Farcaster
      },
      {
        name: "opera",
        ethereumCheck: detectionData.walletProperties.isOpera,
        userAgentCheck: detectionData.userAgent.includes("OPR/") && 
                        detectionData.userAgent.includes("Opera"),
        requireBoth: false,
      },
      {
        name: "okx",
        ethereumCheck: detectionData.walletProperties.isOkxWallet,
        userAgentCheck: detectionData.userAgent.includes("OKApp") || 
                        detectionData.userAgent.includes("OKX"),
        requireBoth: false,
      },
      {
        name: "zerion",
        ethereumCheck: detectionData.walletProperties.isZerion,
        userAgentCheck: detectionData.userAgent.includes("Zerion"),
        requireBoth: false,
      },
      {
        name: "oneInch",
        ethereumCheck: detectionData.walletProperties.isOneInchIOSWallet,
        userAgentCheck: detectionData.userAgent.includes("1inch"),
        requireBoth: false,
      },
    ];

    // Check each wallet
    for (const wallet of walletChecks) {
      const isDetected = wallet.requireBoth 
        ? (wallet.ethereumCheck && wallet.userAgentCheck)
        : (wallet.ethereumCheck || wallet.userAgentCheck);

      if (isDetected) {
        console.log(`🔍 [${callerId}] ${wallet.name} wallet browser detected - forcing desktop mode`, {
          ethereumCheck: wallet.ethereumCheck,
          userAgentCheck: wallet.userAgentCheck,
          userAgent: detectionData.userAgent.substring(0, 100),
        });
        return {
          isMiniApp: false,
          detectionMethod: "none" as const,
        };
      }
    }

    // Check for other Farcaster clients (we already handled Base app above)
    if (detectionData.farcasterClientFid && detectionData.farcasterClientFid !== 309857) {
      console.log(
        `Other Farcaster client detected: ${detectionData.farcasterClientFid}`
      );
      return {
        isMiniApp: true,
        clientFid: detectionData.farcasterClientFid,
        detectionMethod: "clientFid",
        context: detectionData.farcasterContext,
      };
    }

    // No mini-app detected
    console.log("No mini-app detected, using desktop mode");
    return {
      isMiniApp: false,
      detectionMethod: "none",
    };
  } catch (error) {
    console.error("Error during mini-app detection:", error);
    return {
      isMiniApp: false,
      detectionMethod: "none",
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
