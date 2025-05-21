"use client";

import { useState, useEffect, useCallback } from "react";
// import { usePrivy } from "@privy-io/react-auth"; // Replaced
import { Token } from "@/src/app/types/token";
import { StakeButton } from "@/src/components/StakeButton";
import { UniswapModal } from "@/src/components/UniswapModal";
import { publicClient } from "@/src/lib/viemClient";
import { UnstakeButton } from "@/src/components/UnstakeButton";
import { ConnectPoolButton } from "@/src/components/ConnectPoolButton";
import { ZapStakeButton } from "@/src/components/ZapStakeButton";
import { Wallet } from "lucide-react";
import {
  LP_FACTORY_ADDRESS,
  LP_FACTORY_ABI,
  GDA_FORWARDER,
  GDA_ABI,
} from "@/src/lib/contracts";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic"; // Added
import { Button as UiButton } from "@/src/components/ui/button"; // Added for connect/switch
// import { base } from "wagmi/chains"; // Removed as it's unused after refactoring

interface TokenActionsProps {
  token: Token;
  onStakingChange: () => void;
}

// Removed PrivyUser, LinkedAccount, getAllUserAddresses as they are not used with useAppFrameLogic direct address

type Deployment = {
  token: string;
  locker: string;
  positionId: bigint;
};

export function TokenActions({
  token: initialToken,
  onStakingChange,
}: TokenActionsProps) {
  const [isUniswapOpen, setIsUniswapOpen] = useState(false);
  const [token, setToken] = useState(initialToken);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [isConnectedToPool, setIsConnectedToPool] = useState(false);
  const [stakedBalance, setStakedBalance] = useState<bigint>(0n);

  const {
    isSDKLoaded, // Available if needed
    isMiniAppView, // To conditionally render UI
    // farcasterContext, // Not directly used in TokenActions, but available from hook
    address, // Connected wallet address
    isConnected, // Wallet connection status
    isOnCorrectNetwork,
    connect,
    connectors,
    // switchChain,      // Handled by parent in mini-app view
    // isSwitchingChain, // Handled by parent in mini-app view
  } = useAppFrameLogic();

  // const { user, ready, login } = usePrivy(); // Replaced
  // const address = user?.wallet?.address; // Replaced by hook's address
  // const isConnected = ready && !!address; // Replaced by hook's isConnected

  useEffect(() => {
    console.log("TokenActions Wallet state (from useAppFrameLogic):", {
      isSDKLoaded,
      isMiniAppView,
      address,
      isConnected,
      isOnCorrectNetwork,
    });
  }, [isSDKLoaded, isMiniAppView, address, isConnected, isOnCorrectNetwork]);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          `/api/tokens/single?address=${token.contract_address}`
        );
        const data = await response.json();
        if (data.data) {
          setToken(data.data);
        }
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };
    const interval = setInterval(fetchToken, 10000);
    fetchToken();
    return () => clearInterval(interval);
  }, [token.contract_address]);

  useEffect(() => {
    if (!address || !isConnected) {
      // Use address from hook
      console.log(
        "Skipping creator check - no address connected or user object not ready"
      );
      return;
    }
    const checkIsCreator = async () => {
      console.log("Checking if address is creator:", {
        userAddress: address, // Use address from hook
        tokenAddress: token.contract_address,
      });
      try {
        const deployments = (await publicClient.readContract({
          address: LP_FACTORY_ADDRESS,
          abi: LP_FACTORY_ABI,
          functionName: "getTokensDeployedByUser",
          args: [address as `0x${string}`], // Use address from hook
        })) as Deployment[];
        const isCreatorResult = deployments.some(
          (d) => d.token.toLowerCase() === token.contract_address.toLowerCase()
        );
        // setIsCreator(isCreatorResult); // Assuming you might have such a state, if needed
        if (isCreatorResult) {
          console.log("User is creator of this token");
        }
      } catch (error) {
        console.error("Error checking creator status:", error);
      }
    };
    checkIsCreator();
  }, [address, isConnected, token.contract_address]);

  useEffect(() => {
    const checkPoolConnection = async () => {
      if (!address || !isConnected || !token.staking_pool) return; // Use address from hook
      try {
        const connectedStatus = await publicClient.readContract({
          address: GDA_FORWARDER,
          abi: GDA_ABI,
          functionName: "isMemberConnected",
          args: [token.staking_pool as `0x${string}`, address as `0x${string}`], // Use address from hook
        });
        setIsConnectedToPool(connectedStatus);
      } catch (error) {
        console.error("Error checking pool connection:", error);
      }
    };
    checkPoolConnection();
  }, [address, isConnected, token.staking_pool]);

  useEffect(() => {
    const checkStakedBalance = async () => {
      if (!address || !isConnected || !token.staking_address) return; // Use address from hook
      try {
        const stakedVal = await publicClient.readContract({
          address: token.staking_address as `0x${string}`,
          abi: [
            {
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [address as `0x${string}`], // Use address from hook
        });
        setStakedBalance(stakedVal);
      } catch (error) {
        console.error("Error checking staked balance:", error);
      }
    };
    checkStakedBalance();
  }, [address, isConnected, token.staking_address]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !isConnected) return;
      try {
        const balVal = await publicClient.readContract({
          address: token.contract_address as `0x${string}`,
          abi: [
            {
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });
        setBalance(balVal);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };
    fetchBalance();
  }, [address, isConnected, token.contract_address]);

  const hasTokens = isConnected && balance > 0n;

  const refreshBalances = useCallback(async () => {
    if (!address || !isConnected) return;
    try {
      const balVal = await publicClient.readContract({
        address: token.contract_address as `0x${string}`,
        abi: [
          {
            inputs: [{ name: "account", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      setBalance(balVal);

      if (token.staking_address) {
        const stakedVal = await publicClient.readContract({
          address: token.staking_address as `0x${string}`,
          abi: [
            {
              inputs: [{ name: "account", type: "address" }],
              name: "balanceOf",
              outputs: [{ name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });
        setStakedBalance(stakedVal);
      }
    } catch (error) {
      console.error("Error refreshing balances:", error);
    }
  }, [address, isConnected, token.contract_address, token.staking_address]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // Mini App View: Wallet connection and network check handled by parent (TokenPageContent)
  // We just ensure we don't show actions if in mini-app view and not ready
  if (isMiniAppView && (!isConnected || !isOnCorrectNetwork)) {
    // Parent component (TokenPageContent) should be showing connect/switch buttons.
    // TokenActions can show a placeholder or minimal message, or null.
    return (
      <div className="card border-gray-100 border-2 p-4 space-y-6 text-center">
        <p className="text-sm text-gray-500">
          Please connect your wallet and switch to Base network using the
          options above.
        </p>
      </div>
    );
  }

  // Standard view or Mini-app view (wallet ready)
  return (
    <div className="card border-gray-100 border-2 p-4 space-y-6">
      {!isConnected ? (
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Use UiButton for consistency if desired, or keep Privy's login style if that was intentional for non-mini-app */}
          <UiButton
            onClick={() => connect && connect({ connector: connectors[0] })}
            className="btn btn-primary gap-2"
          >
            <Wallet size={18} />
            Connect Wallet
          </UiButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <ZapStakeButton
            tokenAddress={token.contract_address}
            stakingAddress={token.staking_address}
            onSuccess={onStakingChange}
            className="btn btn-outline relative 
              before:absolute before:inset-0 before:bg-gradient-to-r 
              before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f] 
              before:opacity-30
              hover:before:opacity-40
              border-[#ffa647]/30
              hover:border-[#ffa647]/50
              shadow-[0_0_5px_rgba(255,166,71,0.3)]
              hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setIsUniswapOpen(true)}
              className="btn btn-outline border-gray-400 text-gray-600 flex-1"
            >
              Swap
            </button>
            <StakeButton
              tokenAddress={token.contract_address}
              stakingAddress={token.staking_address}
              stakingPoolAddress={token.staking_pool}
              disabled={!hasTokens}
              symbol={token.symbol}
              onSuccess={onStakingChange}
              onPoolConnect={() => setIsConnectedToPool(true)}
              className={`btn btn-outline border-gray-400 text-gray-600 flex-1
              disabled:before:opacity-0
              disabled:hover:before:opacity-0
              disabled:border-opacity-0
              disabled:shadow-none
              disabled:hover:shadow-none
              ${!hasTokens && "btn-disabled opacity-50"}`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <UnstakeButton
              stakingAddress={token.staking_address}
              symbol={token.symbol}
              className="btn btn-outline border-gray-400 text-gray-600"
              onSuccess={onStakingChange}
            />
            {stakedBalance > 0n && (
              <>
                {!isConnectedToPool ? (
                  <div className="alert alert-warning shadow-lg">
                    <div className="flex">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="w-6 h-6 mx-2 stroke-current"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <div>
                        <h3 className="font-bold">Action Required</h3>
                        <div className="text-sm">
                          Connect to the reward pool to start receiving
                          streaming rewards.
                        </div>
                      </div>
                    </div>
                    <div className="flex-none">
                      <ConnectPoolButton
                        poolAddress={token.staking_pool}
                        onSuccess={() => setIsConnectedToPool(true)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-success shadow-lg">
                    <div className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="w-6 h-6 mx-2 stroke-current"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <div className="text-sm">Connected to reward pool</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <UniswapModal
        isOpen={isUniswapOpen}
        onClose={() => setIsUniswapOpen(false)}
        tokenAddress={token.contract_address}
        onAfterClose={refreshBalances}
      />
    </div>
  );
}
