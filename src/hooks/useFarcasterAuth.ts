"use client";

import { useState, useCallback } from "react";
import { sdk } from "@farcaster/frame-sdk";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useFarcasterAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });

  const signIn = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log("Starting Farcaster authentication...");

      // First, try the experimental quickAuth method
      try {
        console.log("Attempting quickAuth...");
        const { token } = await sdk.experimental.quickAuth();
        console.log(
          "QuickAuth successful, got token:",
          token ? "Token received" : "No token"
        );

        // Store the token
        setAuthState((prev) => ({
          ...prev,
          token,
          isAuthenticated: true,
          isLoading: false,
        }));

        return token;
      } catch (quickAuthError) {
        console.warn(
          "QuickAuth failed, trying standard signIn:",
          quickAuthError
        );

        // Fallback to standard Sign In with Farcaster
        try {
          console.log("Attempting standard signIn...");

          // Generate a nonce for SIWF
          const nonce = generateNonce();
          console.log("Generated nonce:", nonce);

          // Call the standard signIn method
          const signInResult = await sdk.actions.signIn({ nonce });
          console.log(
            "SignIn successful, got result:",
            signInResult ? "Result received" : "No result"
          );

          // Send the SIWF message and signature to our server for verification
          const response = await fetch("/api/auth/verify-siwf", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: signInResult.message,
              signature: signInResult.signature,
              nonce,
            }),
          });

          if (!response.ok) {
            throw new Error(`SIWF verification failed: ${response.status}`);
          }

          const { token: siwfToken } = await response.json();

          // Store the token
          setAuthState((prev) => ({
            ...prev,
            token: siwfToken,
            isAuthenticated: true,
            isLoading: false,
          }));

          return siwfToken;
        } catch (siwfError) {
          console.error("Standard signIn also failed:", siwfError);
          const siwfErrorMessage =
            siwfError instanceof Error
              ? siwfError.message
              : "Unknown SIWF error";
          const quickAuthErrorMessage =
            quickAuthError instanceof Error
              ? quickAuthError.message
              : "Unknown quickAuth error";
          throw new Error(
            `Both quickAuth and signIn failed. QuickAuth: ${quickAuthErrorMessage}, SignIn: ${siwfErrorMessage}`
          );
        }
      }
    } catch (error) {
      console.error("Authentication completely failed:", error);
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      }));
      throw error;
    }
  }, []);

  const signOut = useCallback(() => {
    setAuthState({
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...authState,
    signIn,
    signOut,
  };
}

// Generate a cryptographically secure nonce for SIWF
function generateNonce(): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  // Use crypto.getRandomValues if available (browser environment)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) {
      nonce += charset[array[i] % charset.length];
    }
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 16; i++) {
      nonce += charset[Math.floor(Math.random() * charset.length)];
    }
  }

  return nonce;
}
