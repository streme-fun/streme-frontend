"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Token } from "@/app/types/token";
import { calculateRewards, REWARDS_PER_SECOND } from "@/app/lib/rewards";
import { StakeButton } from "@/app/components/StakeButton";
import { UniswapModal } from "@/app/components/UniswapModal";
import {
  createPublicClient,
  http,
  parseAbi,
  createWalletClient,
  custom,
} from "viem";
import { base } from "viem/chains";
import Image from "next/image";
import FarcasterIcon from "@/public/farcaster.svg";
import { UnstakeButton } from "@/app/components/UnstakeButton";
import { toast } from "sonner";

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// Helper functions from TokenTable
const formatPrice = (price: number | undefined) => {
  if (!price || isNaN(price)) return "-";

  if (price < 0.01 && price > 0) {
    // Find the first non-zero decimal place
    const decimalStr = price.toFixed(20).split(".")[1];
    let zeroCount = 0;
    while (decimalStr[zeroCount] === "0") {
      zeroCount++;
    }

    // Format as 0.0₅984 (example)
    return (
      <span className="whitespace-nowrap">
        $0.0{zeroCount > 0 && <sub>{zeroCount}</sub>}
        {decimalStr.slice(zeroCount, zeroCount + 4)}
      </span>
    );
  }

  return `$${price.toLocaleString(undefined, {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  })}`;
};

const formatCurrency = (value: number | undefined) => {
  if (!value || isNaN(value)) return "-";
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
};

interface TokenActionsProps {
  token: Token;
}

const AnimatedReward = ({ value }: { value: number }) => {
  const [current, setCurrent] = useState(value);

  // Update initial value when it changes
  useEffect(() => {
    setCurrent(value);
  }, [value]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => prev + REWARDS_PER_SECOND / 20);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-lg">
      {current.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </div>
  );
};

const shortenHash = (hash: string | undefined) => {
  if (!hash) return "";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

// Add LP Factory ABI and address
const LP_FACTORY_ADDRESS = "0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8";
const LP_FACTORY_ABI = parseAbi([
  "function getTokensDeployedByUser(address) external view returns ((address token, address locker, uint256 positionId)[])",
  "function claimRewards(address) external",
]);

// Add GDA constants at the top with other constants
const GDA_FORWARDER = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08";
const GDA_ABI = [
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "member", type: "address" },
    ],
    name: "isMemberConnected",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "userData", type: "bytes" },
    ],
    name: "connectPool",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

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

export function TokenActions({ token: initialToken }: TokenActionsProps) {
  const [isUniswapOpen, setIsUniswapOpen] = useState(false);
  const [token, setToken] = useState(initialToken);
  const [rewardsData, setRewardsData] = useState<number>(0);
  const [membersData, setMembersData] = useState<string>("0");

  const { user, ready } = usePrivy();
  const address = user?.wallet?.address;
  const isConnected = ready && !!address;
  const [balance, setBalance] = useState<bigint>(BigInt(0));

  const [isCreator, setIsCreator] = useState(false);
  const [isClaimingFees, setIsClaimingFees] = useState(false);
  const [isConnectedToPool, setIsConnectedToPool] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Add staking balance check
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

  // Calculate rewards and members
  useEffect(() => {
    const calculateData = async () => {
      const { totalStreamed, totalMembers } = await calculateRewards(
        token.created_at,
        token.contract_address,
        token.staking_pool
      );
      setRewardsData(totalStreamed);
      setMembersData(totalMembers);
    };

    calculateData();
  }, [token]);

  // Update rewards periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRewardsData((prev) => prev + REWARDS_PER_SECOND);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch balance
  useEffect(() => {
    if (!address || !isConnected) return;

    const fetchBalance = async () => {
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
    };

    fetchBalance();
  }, [address, isConnected, token.contract_address]);

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
          const deployments = await publicClient.readContract({
            address: LP_FACTORY_ADDRESS,
            abi: LP_FACTORY_ABI,
            functionName: "getTokensDeployedByUser",
            args: [address as `0x${string}`],
          });

          const isCreatorResult = deployments.some(
            (d) =>
              d.token.toLowerCase() === token.contract_address.toLowerCase()
          );

          if (isCreatorResult) {
            setIsCreator(true);
            return;
          }
        }
        setIsCreator(false);
      } catch (error) {
        console.error("Error checking creator status:", error);
        setIsCreator(false);
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

  const handleClaimFees = async () => {
    if (!window.ethereum || !user?.wallet?.address) {
      console.error("No wallet available");
      return;
    }

    setIsClaimingFees(true);
    try {
      // Single toast for the entire process
      const toastId = toast.loading("Switching to Base network...");

      // Try to switch to Base chain first
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });

        const currentChain = await window.ethereum.request({
          method: "eth_chainId",
        });
        if (currentChain !== "0x2105") {
          toast.error(
            "Wallet did not switch to Base network, please switch manually",
            { id: toastId }
          );
          return;
        }

        // Update toast message
        toast.loading("Claiming LP fees...", { id: toastId });

        const walletClient = createWalletClient({
          chain: base,
          transport: custom(window.ethereum),
          account: user.wallet.address as `0x${string}`,
        });

        const tx = await walletClient.writeContract({
          address: LP_FACTORY_ADDRESS,
          abi: LP_FACTORY_ABI,
          functionName: "claimRewards",
          args: [token.contract_address as `0x${string}`],
        });

        console.log("Transaction submitted:", tx);

        // Update toast while waiting for confirmation
        toast.loading("Waiting for confirmation...", { id: toastId });

        await publicClient.waitForTransactionReceipt({
          hash: tx,
        });

        // Show success toast with transaction link
        toast.success(
          <div className="flex flex-col gap-2">
            <div>Successfully claimed LP fees!</div>
            <a
              href={`https://basescan.org/tx/${tx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs opacity-80 hover:opacity-100 underline"
            >
              View on Basescan
            </a>
          </div>,
          { id: toastId, duration: 8000 }
        );
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to claim LP fees", { id: toastId });
      }
    } finally {
      setIsClaimingFees(false);
    }
  };

  // Add connect pool function
  const handleConnectPool = async () => {
    if (!window.ethereum || !user?.wallet?.address) return;

    setIsConnecting(true);
    const toastId = toast.loading("Connecting to reward pool...");

    try {
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(window.ethereum),
        account: user.wallet.address as `0x${string}`,
      });

      const userData = "0x" as const;
      const tx = await walletClient.writeContract({
        address: GDA_FORWARDER,
        abi: GDA_ABI,
        functionName: "connectPool",
        args: [token.staking_pool as `0x${string}`, userData],
      });

      toast.loading("Confirming transaction...", { id: toastId });

      await publicClient.waitForTransactionReceipt({ hash: tx });

      setIsConnectedToPool(true);
      toast.success("Successfully connected to reward pool!", { id: toastId });
    } catch (error) {
      console.error("Error connecting to pool:", error);
      toast.error("Failed to connect to reward pool", { id: toastId });
    } finally {
      setIsConnecting(false);
    }
  };

  const hasTokens = isConnected && balance > 0n;

  return (
    <div className="space-y-6">
      {/* Token Header */}
      <div className="flex items-center gap-4">
        {token.img_url ? (
          <div className="relative w-16 h-16">
            <Image
              src={token.img_url}
              alt={token.name}
              fill
              className="object-cover rounded-md"
            />
          </div>
        ) : (
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-2xl font-mono">
            {token.symbol?.[0] ?? "?"}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{token.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-base opacity-60">${token.symbol}</span>
            <span
              className={`text-base ${
                token.change24h && token.change24h >= 0
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {token.change24h
                ? `${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(
                    2
                  )}%`
                : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Price Row */}
      <div className="flex items-end justify-between px-1">
        <div>
          <div className="text-sm opacity-60 mb-1">Price</div>
          <div className="font-mono text-2xl font-bold">
            {formatPrice(token.price)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm opacity-60 mb-1">24h Change</div>
          <div
            className={`font-mono text-lg ${
              token.change24h && token.change24h >= 0
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {token.change24h
              ? `${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(
                  2
                )}%`
              : "-"}
          </div>
        </div>
      </div>

      {/* Creator Info */}
      {token.creator && (
        <div className="flex items-center gap-2 px-1">
          <div className="avatar">
            <div className="w-6 h-6 rounded-full">
              <Image
                src={
                  token.creator.profileImage ??
                  `/avatars/${token.creator.name}.avif`
                }
                alt={token.creator.name}
                width={24}
                height={24}
              />
            </div>
          </div>
          <a
            href={`https://warpcast.com/${token.creator.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base opacity-60 hover:opacity-100 hover:underline"
          >
            {token.creator.name}
          </a>
          {token.cast_hash && (
            <a
              href={`https://warpcast.com/${token.creator.name}/${shortenHash(
                token.cast_hash
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary inline-flex items-center ml-2"
              title="View original cast"
            >
              <Image
                src={FarcasterIcon}
                alt="View on Farcaster"
                width={14}
                height={14}
                className="opacity-60 hover:opacity-100"
              />
            </a>
          )}
        </div>
      )}

      {/* Market Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm opacity-60 mb-1">Volume 24h</div>
          <div className="font-mono text-lg">
            {formatCurrency(token.volume24h)}
          </div>
        </div>
        <div>
          <div className="text-sm opacity-60 mb-1">Market Cap</div>
          <div className="font-mono text-lg">
            {formatCurrency(token.marketCap)}
          </div>
        </div>
      </div>

      {/* Rewards Section */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-sm opacity-60 mb-1">
            Rewards ({membersData ?? 0}{" "}
            {membersData === "1" ? "staker" : "stakers"})
          </div>
          <AnimatedReward value={rewardsData} />
        </div>
        <div className="text-sm opacity-40">
          {REWARDS_PER_SECOND.toFixed(2)} ${token.symbol}/sec
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setIsUniswapOpen(true)}
          className="btn btn-primary"
        >
          Buy
        </button>
        <StakeButton
          tokenAddress={token.contract_address}
          stakingAddress={token.staking_address}
          stakingPoolAddress={token.staking_pool}
          disabled={!hasTokens}
          symbol={token.symbol}
          totalStakers={membersData}
          className={`btn btn-outline relative 
            before:absolute before:inset-0 before:bg-gradient-to-r 
            before:from-[#ff75c3] before:via-[#ffa647] before:to-[#ffe83f] 
            before:opacity-30
            hover:before:opacity-40
            border-[#ffa647]/30
            hover:border-[#ffa647]/50
            shadow-[0_0_5px_rgba(255,166,71,0.3)]
            hover:shadow-[0_0_10px_rgba(255,166,71,0.5),0_0_20px_rgba(255,131,63,0.3)]
            disabled:before:opacity-0
            disabled:hover:before:opacity-0
            disabled:border-opacity-0
            disabled:shadow-none
            disabled:hover:shadow-none
            ${!hasTokens && "btn-disabled opacity-50"}`}
        />
        <UnstakeButton
          stakingAddress={token.staking_address}
          symbol={token.symbol}
          className="btn btn-outline"
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
                      Connect to the reward pool to start receiving streaming
                      rewards.
                    </div>
                  </div>
                </div>
                <div className="flex-none">
                  <button
                    onClick={handleConnectPool}
                    disabled={isConnecting}
                    className="btn btn-sm btn-primary"
                  >
                    {isConnecting ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Connecting...
                      </>
                    ) : (
                      "Connect"
                    )}
                  </button>
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

        {/* Claim Fees button for creator */}
        {isCreator && (
          <div className="space-y-1">
            <button
              onClick={handleClaimFees}
              disabled={isClaimingFees || !user?.wallet?.address}
              className="btn btn-secondary w-full"
            >
              {isClaimingFees ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Claiming...
                </>
              ) : !user?.wallet?.address ? (
                "Connect Wallet"
              ) : (
                "Claim Fees"
              )}
            </button>
            <div className="text-xs opacity-60 text-center">
              Claimable by: {shortenHash(user?.wallet?.address)}
            </div>
          </div>
        )}
      </div>

      <UniswapModal
        isOpen={isUniswapOpen}
        onClose={() => setIsUniswapOpen(false)}
        tokenAddress={token.contract_address}
      />
    </div>
  );
}
