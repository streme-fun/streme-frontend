"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Token } from "@/app/types/token";
import { StakeButton } from "@/app/components/StakeButton";
import { UniswapModal } from "@/app/components/UniswapModal";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { UnstakeButton } from "@/app/components/UnstakeButton";
import { ConnectPoolButton } from "@/app/components/ConnectPoolButton";
import { ZapStakeButton } from "@/app/components/ZapStakeButton";
import { Wallet } from "lucide-react";
import {
  LP_FACTORY_ADDRESS,
  LP_FACTORY_ABI,
  GDA_FORWARDER,
  GDA_ABI,
} from "@/app/lib/contracts";

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

interface TokenActionsProps {
  token: Token;
  onStakingChange: () => void;
}

type LinkedAccount = {
  type: string;
  address?: string;
};

type PrivyUser = {
  linkedAccounts?: LinkedAccount[];
};

const getAllUserAddresses = (user: PrivyUser) => {
  if (!user?.linkedAccounts) return [];
  return user.linkedAccounts
    .filter((account) => account.type === "wallet" && account.address)
    .map((account) => account.address!.toLowerCase());
};

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

  const { user, ready, login } = usePrivy();
  const address = user?.wallet?.address;
  const isConnected = ready && !!address;
  const [balance, setBalance] = useState<bigint>(BigInt(0));

  const [isConnectedToPool, setIsConnectedToPool] = useState(false);
  const [stakedBalance, setStakedBalance] = useState<bigint>(0n);

  // Add debug logs
  useEffect(() => {
    console.log("Wallet state:", {
      isReady: ready,
      user: user,
      address,
    });
  }, [ready, user, address]);

  // Fetch token data
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
    fetchToken(); // Initial fetch

    return () => clearInterval(interval);
  }, [token.contract_address]);

  // Then update the creator check useEffect
  useEffect(() => {
    if (!user) {
      console.log("Skipping creator check - no user");
      return;
    }

    const checkIsCreator = async () => {
      const userAddresses = getAllUserAddresses(user);
      console.log("Checking if addresses are creator:", {
        userAddresses,
        tokenAddress: token.contract_address,
      });

      try {
        // Check each address
        for (const address of userAddresses) {
          const deployments = (await publicClient.readContract({
            address: LP_FACTORY_ADDRESS,
            abi: LP_FACTORY_ABI,
            functionName: "getTokensDeployedByUser",
            args: [address as `0x${string}`],
          })) as Deployment[];
          const isCreatorResult = deployments.some(
            (d) =>
              d.token.toLowerCase() === token.contract_address.toLowerCase()
          );

          if (isCreatorResult) {
            return;
          }
        }
      } catch (error) {
        console.error("Error checking creator status:", error);
      }
    };

    checkIsCreator();
  }, [user, token.contract_address]);

  // Add effect to check pool connection
  useEffect(() => {
    const checkPoolConnection = async () => {
      if (!user?.wallet?.address || !token.staking_pool) return;

      try {
        const connected = await publicClient.readContract({
          address: GDA_FORWARDER,
          abi: GDA_ABI,
          functionName: "isMemberConnected",
          args: [
            token.staking_pool as `0x${string}`,
            user.wallet.address as `0x${string}`,
          ],
        });
        setIsConnectedToPool(connected);
      } catch (error) {
        console.error("Error checking pool connection:", error);
      }
    };

    checkPoolConnection();
  }, [user?.wallet?.address, token.staking_pool]);

  // Add effect to check staking balance
  useEffect(() => {
    const checkStakedBalance = async () => {
      if (!user?.wallet?.address || !token.staking_address) return;

      try {
        const staked = await publicClient.readContract({
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
          args: [user.wallet.address as `0x${string}`],
        });
        setStakedBalance(staked);
      } catch (error) {
        console.error("Error checking staked balance:", error);
      }
    };

    checkStakedBalance();
  }, [user?.wallet?.address, token.staking_address]);

  // Add balance fetch effect
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !isConnected) return;
      try {
        const bal = await publicClient.readContract({
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
        setBalance(bal);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    fetchBalance();
  }, [address, isConnected, token.contract_address]);

  const hasTokens = isConnected && balance > 0n;

  // Wrap in useCallback to prevent recreation on every render
  const refreshBalances = useCallback(async () => {
    if (!address || !isConnected) return;
    try {
      // Fetch token balance
      const bal = await publicClient.readContract({
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
      setBalance(bal);

      // Fetch staked balance if applicable
      if (token.staking_address) {
        const staked = await publicClient.readContract({
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
        setStakedBalance(staked);
      }
    } catch (error) {
      console.error("Error refreshing balances:", error);
    }
  }, [address, isConnected, token.contract_address, token.staking_address]);

  // Now the effect will only re-run when refreshBalances actually changes
  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  return (
    <div className="card border-gray-100 border-2 p-4 space-y-6">
      {/* Show connect wallet button if wallet is not connected */}
      {!isConnected ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <button onClick={() => login()} className="btn btn-primary gap-2">
            <Wallet size={18} />
            Connect Wallet
          </button>
        </div>
      ) : (
        /* Action Buttons - Only show when wallet is connected */
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
            {/* Connection status alerts */}
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
