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
    console.log("🔍 Starting mini-app detection...");

    // First, check if we're in any wallet browser - these should NEVER be treated as mini-app
    if (typeof window !== "undefined") {
      const userAgent = window.navigator?.userAgent || "";
      
      // Check for various wallet browsers
      const walletChecks = {
        // Coinbase Wallet
        coinbase: {
          ethereum: window.ethereum &&
            (window.ethereum.isCoinbaseWallet ||
             window.ethereum.isCoinbaseWalletExtension ||
             window.ethereum.isCoinbaseWalletBrowser),
          userAgent: userAgent.includes("CoinbaseWallet") || userAgent.includes("Coinbase")
        },
        // Rainbow Wallet
        rainbow: {
          ethereum: window.ethereum && window.ethereum.isRainbow,
          userAgent: userAgent.includes("Rainbow")
        },
        // MetaMask
        metamask: {
          ethereum: window.ethereum && window.ethereum.isMetaMask,
          userAgent: userAgent.includes("MetaMask")
        },
        // Rabby Wallet
        rabby: {
          ethereum: window.ethereum && window.ethereum.isRabby,
          userAgent: userAgent.includes("Rabby")
        },
        // Trust Wallet
        trust: {
          ethereum: window.ethereum && (window.ethereum.isTrust || window.ethereum.isTrustWallet),
          userAgent: userAgent.includes("TrustWallet")  // More specific, removed generic "Trust"
        },
        // Brave Wallet
        brave: {
          ethereum: window.ethereum && window.ethereum.isBraveWallet,
          userAgent: userAgent.includes("Brave/")  // More specific with slash
        },
        // Opera Crypto Browser
        opera: {
          ethereum: window.ethereum && window.ethereum.isOpera,
          userAgent: userAgent.includes("OPR/") && userAgent.includes("Opera")  // Require both for Opera
        },
        // OKX Wallet (formerly OKEx)
        okx: {
          ethereum: window.ethereum && window.ethereum.isOkxWallet,
          userAgent: userAgent.includes("OKApp") || userAgent.includes("OKX")
        },
        // Zerion Wallet
        zerion: {
          ethereum: window.ethereum && window.ethereum.isZerion,
          userAgent: userAgent.includes("Zerion")
        },
        // 1inch Wallet
        oneInch: {
          ethereum: window.ethereum && window.ethereum.isOneInchIOSWallet,
          userAgent: userAgent.includes("1inch")
        }
      };

      // Check if any wallet browser is detected
      for (const [walletName, checks] of Object.entries(walletChecks)) {
        // For wallets that Farcaster might inject compatibility flags for,
        // require BOTH ethereum and userAgent checks to avoid false positives
        const requireBothChecks = ['metamask', 'rabby', 'brave', 'trust'];
        
        if (requireBothChecks.includes(walletName)) {
          if (checks.ethereum && checks.userAgent) {
            console.log(`${walletName} wallet browser detected - forcing desktop mode`, {
              ethereumCheck: checks.ethereum,
              userAgentCheck: checks.userAgent,
              userAgent: userAgent.substring(0, 100),
            });
            return {
              isMiniApp: false,
              detectionMethod: "none",
            };
          }
        } else {
          // For other wallets, either check is sufficient
          if (checks.ethereum || checks.userAgent) {
            console.log(`${walletName} wallet browser detected - forcing desktop mode`, {
              ethereumCheck: checks.ethereum,
              userAgentCheck: checks.userAgent,
              userAgent: userAgent.substring(0, 100),
            });
            return {
              isMiniApp: false,
              detectionMethod: "none",
            };
          }
        }
      }
    }

    // Method 1: Use provided Farcaster context (most reliable when available)
    if (farcasterContext?.client?.clientFid) {
      console.log(
        "Using provided Farcaster context:",
        farcasterContext.client.clientFid
      );

      // Check for Base App specifically
      if (farcasterContext.client.clientFid === 309857) {
        console.log(
          "Base App detected via provided context (clientFid 309857)"
        );
        return {
          isMiniApp: true,
          clientFid: 309857,
          detectionMethod: "clientFid",
          context: farcasterContext,
        };
      }

      // Any other Farcaster client
      console.log(
        `Other Farcaster client detected via provided context: ${farcasterContext.client.clientFid}`
      );
      return {
        isMiniApp: true,
        clientFid: farcasterContext.client.clientFid,
        detectionMethod: "clientFid",
        context: farcasterContext,
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
          detectionMethod: "clientFid",
          context,
        };
      }

      if (context?.client?.clientFid) {
        console.log(
          `Other Farcaster client detected via SDK context: ${context.client.clientFid}`
        );
        return {
          isMiniApp: true,
          clientFid: context.client.clientFid,
          detectionMethod: "clientFid",
          context,
        };
      }
    } catch (contextError) {
      console.warn("Could not get SDK context:", contextError);
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
