"use client";

import { useState, useEffect } from "react";
import { useSafeWalletAuth } from "@/src/hooks/useSafeWallet";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { readContract } from "wagmi/actions";
import { sharedConfig as config } from "@/src/lib/wagmiConfig";
import { parseEther } from "viem";
import { toast } from "sonner";
import {
  STREME_DEPLOY_V2_ABI,
  STREME_PUBLIC_DEPLOYER_V2,
  STREME_SUPER_TOKEN_FACTORY,
  STREME_ALLOCATION_HOOK,
  LP_FACTORY_ADDRESS,
} from "@/src/lib/contracts";
import {
  createStakingAllocation,
  createVaultAllocation,
  calculateLPAllocation,
  validateAllocations,
} from "@/src/lib/allocationHelpers";

export function CreateForm() {
  const { login, authenticated, user } = useSafeWalletAuth();
  const { isMiniAppView, isConnected, farcasterContext } = useAppFrameLogic();
  const { address } = useAccount();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
  });
  const [useDefaultStaking, setUseDefaultStaking] = useState(true);
  const [vaultMode, setVaultMode] = useState<"off" | "default" | "custom">(
    "off"
  );
  const [v2Config, setV2Config] = useState({
    stakingAllocation: 10,
    stakingLockDays: 1,
    stakingFlowDays: 365,
    stakingDelegate: "",
    enableVault: false,
    vaultAllocation: 0,
    vaultBeneficiary: "",
    vaultLockDays: 0,
    vaultVestingDays: 0,
  });
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [deployedTokenAddress, setDeployedTokenAddress] = useState<string>("");

  // Get user's FID and primary address
  const userFid = farcasterContext?.user?.fid || 0;
  const userAddress = address || user?.wallet?.address;

  // Contract constants (matching server implementation)
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // Base WETH
  const TOKEN_SUPPLY = parseEther("100000000000"); // 100B tokens (matching server)
  const CREATOR_FEE = 10000; // 10% (matching server)
  const DEV_BUY_FEE = 10000; // 10% (matching server)
  const TICK = -230400; // Uniswap V3 tick (matching server)

  // We'll generate salt only when submitting, not on every keystroke

  // Deploy contract
  const {
    writeContract,
    data: deployHash,
    isPending: isWritePending,
  } = useWriteContract();

  // Wait for deployment transaction
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({
      hash: deployHash,
    });

  // Handle transaction success
  useEffect(() => {
    if (isTxSuccess && deployHash) {
      toast.success(
        "🎉 Token deployed successfully! Redirecting in 3 seconds..."
      );
      setIsDeploying(false);

      console.log("Deployment successful, transaction hash:", deployHash);
      if (deployedTokenAddress) {
        console.log("Token address:", deployedTokenAddress);
      }

      // Add a delay to allow backend indexing before redirect
      setTimeout(() => {
        router.push(`/launched-tokens`);
      }, 3000); // 3 second delay
    }
  }, [isTxSuccess, deployHash, router, deployedTokenAddress]);

  // Update loading state
  useEffect(() => {
    setIsDeploying(isWritePending || isTxLoading);
  }, [isWritePending, isTxLoading]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      e.target.value = ""; // Reset the input
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast.error("Image must be smaller than 1MB");
      e.target.value = ""; // Reset the input
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setPreviewUrl(previewUrl);
    setIsUploadingImage(true);

    try {
      // Upload to Vercel Blob
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const { url } = await response.json();

      // Update form data with the uploaded URL
      setFormData((prev) => ({ ...prev, imageUrl: url }));
      toast.success("Image uploaded successfully!");
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error("Failed to upload image");
      // Clear preview on error
      setPreviewUrl("");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isWalletConnected = isMiniAppView ? isConnected : authenticated;

    if (!isWalletConnected) {
      if (!isMiniAppView) {
        login();
      }
      return;
    }

    if (!userAddress) {
      toast.error("No wallet address found");
      return;
    }

    const sanitizedSymbol = formData.symbol.replace(/\$/g, "").trim();
    if (!sanitizedSymbol) {
      toast.error("Token symbol is required");
      return;
    }

    setIsDeploying(true);

    try {
      console.log(
        "Preparing token deployment for:",
        sanitizedSymbol,
        userAddress
      );

      // Use V2 contracts
      const deployerAddress = STREME_PUBLIC_DEPLOYER_V2;
      const tokenFactory = STREME_SUPER_TOKEN_FACTORY;
      const postDeployHook = STREME_ALLOCATION_HOOK;

      // Generate salt using the appropriate contract
      let salt =
        "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      try {
        console.log("Generating salt for V2:", deployerAddress);
        console.log("Using TOKEN_FACTORY:", tokenFactory);

        const saltResult = await readContract(config, {
          address: deployerAddress,
          abi: STREME_DEPLOY_V2_ABI,
          functionName: "generateSalt",
          args: [
            sanitizedSymbol,
            userAddress as `0x${string}`,
            tokenFactory,
            WETH_ADDRESS,
          ],
        });

        const [generatedSalt, predictedToken] = saltResult as [
          `0x${string}`,
          `0x${string}`
        ];
        salt = generatedSalt;
        setDeployedTokenAddress(predictedToken);
        console.log(
          "Generated salt:",
          salt,
          "Predicted token:",
          predictedToken
        );
      } catch (saltError) {
        console.warn("Salt generation failed, using default:", saltError);
        // Keep the default 0x0 salt
      }

      // Prepare token config (matching server implementation)
      const tokenConfig = {
        _name: formData.name,
        _symbol: sanitizedSymbol,
        _supply: TOKEN_SUPPLY,
        _fee: CREATOR_FEE,
        _salt: salt, // Use the generated salt (or default if generation failed)
        _deployer: userAddress as `0x${string}`,
        _fid: BigInt(userFid),
        _image: formData.imageUrl || "",
        _castHash: "streme deployment",
        _poolConfig: {
          tick: TICK,
          pairedToken: WETH_ADDRESS as `0x${string}`,
          devBuyFee: DEV_BUY_FEE,
        },
      };

      console.log("Token config:", tokenConfig);

      // Validate allocations
      const validation = validateAllocations(
        v2Config.stakingAllocation,
        v2Config.enableVault ? v2Config.vaultAllocation : 0
      );
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Build allocations array
      const allocations = [];

      // Add staking allocation if > 0
      if (v2Config.stakingAllocation > 0) {
        allocations.push(
          createStakingAllocation(
            v2Config.stakingAllocation,
            v2Config.stakingLockDays,
            v2Config.stakingFlowDays,
            v2Config.stakingDelegate || undefined
          )
        );
      }

      // Add vault allocation if enabled and > 0
      if (v2Config.enableVault && v2Config.vaultAllocation > 0) {
        if (!v2Config.vaultBeneficiary) {
          throw new Error("Vault beneficiary address is required");
        }
        allocations.push(
          createVaultAllocation(
            v2Config.vaultAllocation,
            v2Config.vaultBeneficiary,
            v2Config.vaultLockDays,
            v2Config.vaultVestingDays
          )
        );
      }

      console.log("Deploying V2 token with allocations:", {
        contract: deployerAddress,
        tokenFactory,
        postDeployHook,
        liquidityFactory: LP_FACTORY_ADDRESS,
        tokenConfig,
        allocations,
      });

      // Deploy V2 token with allocations
      writeContract({
        address: deployerAddress,
        abi: STREME_DEPLOY_V2_ABI,
        functionName: "deployWithAllocations",
        args: [
          tokenFactory,
          postDeployHook,
          LP_FACTORY_ADDRESS,
          "0x0000000000000000000000000000000000000000", // postLPHook
          tokenConfig,
          allocations,
        ],
      });

      toast.success("Token deployment initiated!");
    } catch (error) {
      console.error("Token deployment error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to deploy token: ${errorMessage}`);
      setIsDeploying(false);
    }
  };

  const isWalletConnected = isMiniAppView ? isConnected : authenticated;
  const buttonText = !isWalletConnected
    ? isMiniAppView
      ? "WALLET CONNECTING..."
      : "CONNECT WALLET TO LAUNCH"
    : isDeploying
    ? "LAUNCHING TOKEN..."
    : "LAUNCH TOKEN";

  // Calculate LP allocation for display
  const lpAllocation = calculateLPAllocation(
    v2Config.stakingAllocation,
    v2Config.enableVault ? v2Config.vaultAllocation : 0
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name Field */}
      <div>
        <label className="block mb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Name</span>
            <span className="badge badge-sm">Required</span>
          </div>
        </label>
        <input
          type="text"
          placeholder="Enter token name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="input input-bordered w-full bg-base-200"
          required
        />
      </div>

      {/* Symbol Field */}
      <div>
        <label className="block mb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Symbol</span>
            <span className="badge badge-sm">Required</span>
          </div>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content text-lg font-medium z-10 pointer-events-none">
            $
          </span>
          <input
            type="text"
            placeholder="Enter token symbol"
            value={formData.symbol}
            onChange={(e) => {
              const rawValue = e.target.value;
              // Only remove $ if it's the first character
              const sanitizedValue = rawValue.startsWith("$")
                ? rawValue.substring(1)
                : rawValue;
              setFormData({ ...formData, symbol: sanitizedValue });
            }}
            className="input input-bordered w-full bg-base-200 pl-8"
            required
          />
        </div>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block mb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Image</span>
            <span className="badge badge-sm badge-ghost">Optional</span>
          </div>
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
          id="image-upload"
        />
        <label
          htmlFor="image-upload"
          className="btn btn-outline border-base-content/20 w-full justify-center normal-case"
        >
          {isUploadingImage ? (
            <>
              <span className="loading loading-spinner loading-sm mr-2"></span>
              UPLOADING...
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              SELECT FILE (JPEG / PNG, 1MB MAX)
            </>
          )}
        </label>

        {/* Image Preview */}
        {previewUrl && (
          <div className="mt-4 flex justify-center">
            <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-base-300">
              <Image
                src={previewUrl}
                alt="Token preview"
                fill
                className="object-cover"
              />
            </div>
          </div>
        )}
      </div>

      {/* Staking Configuration */}
      <div className="card bg-base-200 p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          Staking Configuration
          <span className="badge badge-sm">Required</span>
        </h3>

        {/* Preset Templates */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="tooltip tooltip-bottom"
            data-tip="Recommended configuration for most token launches"
          >
            <button
              type="button"
              onClick={() => {
                setUseDefaultStaking(true);
                setV2Config({
                  ...v2Config,
                  stakingAllocation: 10,
                  stakingLockDays: 1,
                  stakingFlowDays: 365,
                });
              }}
              className={`btn btn-sm w-full ${
                useDefaultStaking && v2Config.stakingAllocation === 10
                  ? "btn-primary"
                  : "btn-outline"
              } flex-col h-auto py-3`}
            >
              <span className="font-semibold">Standard</span>
              <span className="text-xs opacity-70">10% / 1d lock / 365d</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setUseDefaultStaking(false)}
            className={`btn btn-sm w-full ${
              !useDefaultStaking ? "btn-primary" : "btn-outline"
            } flex-col h-auto py-3`}
          >
            <span className="font-semibold">Custom</span>
            <span className="text-xs opacity-70">Configure manually</span>
          </button>
        </div>

        {!useDefaultStaking && (
          <>
            <div>
              <label className="block mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  Staking Allocation (%)
                  <div
                    className="tooltip tooltip-right"
                    data-tip="Percentage of total token supply allocated to staking rewards. This amount will be distributed to stakers over the flow duration."
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 opacity-60 hover:opacity-100 cursor-help"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={v2Config.stakingAllocation}
                onChange={(e) =>
                  setV2Config({
                    ...v2Config,
                    stakingAllocation: Number(e.target.value),
                  })
                }
                className="input input-bordered w-full bg-base-100"
              />
              <p className="text-xs opacity-60 mt-1">
                % of total supply allocated to staking rewards
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    Lock Duration (days)
                    <div
                      className="tooltip tooltip-right"
                      data-tip="Minimum time users must keep tokens staked before they can unstake. Set to 0 for no lock period."
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 opacity-60 hover:opacity-100 cursor-help"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={v2Config.stakingLockDays}
                  onChange={(e) =>
                    setV2Config({
                      ...v2Config,
                      stakingLockDays: Number(e.target.value),
                    })
                  }
                  className="input input-bordered w-full bg-base-100"
                />
              </div>
              <div>
                <label className="block mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    Flow Duration (days)
                    <div
                      className="tooltip tooltip-right"
                      data-tip="Total time period over which staking rewards are distributed. The allocated tokens stream continuously to stakers during this period."
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 opacity-60 hover:opacity-100 cursor-help"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={v2Config.stakingFlowDays}
                  onChange={(e) =>
                    setV2Config({
                      ...v2Config,
                      stakingFlowDays: Number(e.target.value),
                    })
                  }
                  className="input input-bordered w-full bg-base-100"
                />
              </div>
            </div>

            <div>
              <label className="block mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  Delegate Address (optional)
                  <div
                    className="tooltip tooltip-right"
                    data-tip="Alternative address to receive and manage staking rewards. Leave empty to use the default staking contract address."
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 opacity-60 hover:opacity-100 cursor-help"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </span>
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={v2Config.stakingDelegate}
                onChange={(e) =>
                  setV2Config({
                    ...v2Config,
                    stakingDelegate: e.target.value,
                  })
                }
                className="input input-bordered w-full bg-base-100"
              />
              <p className="text-xs opacity-60 mt-1">
                Address to receive staking rewards (leave empty for default)
              </p>
            </div>

            {/* Smart Validation Warnings */}
            <div className="space-y-2">
              {v2Config.stakingLockDays > 30 && (
                <div className="alert alert-warning py-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="text-xs">
                    Long lock duration ({v2Config.stakingLockDays} days) may
                    discourage stakers
                  </span>
                </div>
              )}
              {v2Config.stakingAllocation < 3 && (
                <div className="alert alert-info py-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-info shrink-0 w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs">
                    Low staking allocation ({v2Config.stakingAllocation}%) may
                    not attract stakers
                  </span>
                </div>
              )}
              {v2Config.stakingFlowDays < 90 && (
                <div className="alert alert-warning py-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="stroke-current shrink-0 w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="text-xs">
                    Short flow duration ({v2Config.stakingFlowDays} days) means
                    rapid reward depletion
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Token Metadata Collapsible */}
      <div className="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-medium flex items-center justify-between">
          <span>Token Metadata</span>
          <span className="badge badge-sm badge-ghost">Optional</span>
        </div>
        <div className="collapse-content">
          <div className="pt-4">
            <label className="block mb-2">
              <span className="text-sm font-medium">Description</span>
            </label>
            <textarea
              placeholder="Describe your token..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="textarea textarea-bordered w-full h-24 bg-base-100"
            />
          </div>
        </div>
      </div>

      {/* Vault Configuration (Advanced) */}
      <div className="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-medium flex items-center justify-between">
          <span>Vault (Advanced)</span>
          <span className="badge badge-sm badge-ghost">Optional</span>
        </div>
        <div className="collapse-content">
          <div className="space-y-4 pt-4">
            {/* Vault Mode Selection */}
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn btn-sm flex-1 h-auto py-3 ${
                  vaultMode === "off" ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => {
                  setVaultMode("off");
                  setV2Config({
                    ...v2Config,
                    enableVault: false,
                    vaultAllocation: 0,
                  });
                }}
              >
                Off
              </button>
              <button
                type="button"
                className={`btn btn-sm flex-1 h-auto py-3 ${
                  vaultMode === "default" ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => {
                  setVaultMode("default");
                  setV2Config({
                    ...v2Config,
                    enableVault: true,
                    vaultAllocation: 10,
                    vaultLockDays: 30,
                    vaultVestingDays: 365,
                  });
                }}
              >
                <div className="flex flex-col items-center">
                  <span className="font-semibold">Default</span>
                  <span className="text-xs opacity-70">
                    10% / 30d lock / 365d vest
                  </span>
                </div>
              </button>
              <button
                type="button"
                className={`btn btn-sm flex-1 h-auto py-3 ${
                  vaultMode === "custom" ? "btn-primary" : "btn-ghost"
                }`}
                onClick={() => {
                  setVaultMode("custom");
                  setV2Config({ ...v2Config, enableVault: true });
                }}
              >
                Custom
              </button>
            </div>

            {/* Vault Fields (only show when not "off") */}
            {vaultMode !== "off" && (
            <div className="space-y-4">
            <div>
              <label className="block mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  Vault Allocation (%)
                  <div
                    className="tooltip tooltip-right"
                    data-tip="Percentage of total token supply allocated to the vault. These tokens will be locked and vested according to the schedule below."
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 opacity-60 hover:opacity-100 cursor-help"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </span>
              </label>
              <input
                type="number"
                min="0"
                max={100 - v2Config.stakingAllocation}
                value={v2Config.vaultAllocation}
                onChange={(e) =>
                  setV2Config({
                    ...v2Config,
                    vaultAllocation: Number(e.target.value),
                  })
                }
                className="input input-bordered w-full bg-base-100"
                disabled={vaultMode === "default"}
              />
            </div>

            <div>
              <label className="block mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  Beneficiary Address
                  {v2Config.vaultAllocation > 0 && (
                    <span className="text-error">*</span>
                  )}
                  <div
                    className="tooltip tooltip-right"
                    data-tip="Wallet address that will receive the vested tokens. This address will be able to claim tokens as they vest over time."
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 opacity-60 hover:opacity-100 cursor-help"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </span>
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={v2Config.vaultBeneficiary}
                onChange={(e) =>
                  setV2Config({
                    ...v2Config,
                    vaultBeneficiary: e.target.value,
                  })
                }
                className="input input-bordered w-full bg-base-100"
                required={v2Config.enableVault && v2Config.vaultAllocation > 0}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    Lock Duration (days)
                    <div
                      className="tooltip tooltip-right"
                      data-tip="Initial lock period before vesting begins. No tokens can be claimed during this time."
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 opacity-60 hover:opacity-100 cursor-help"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={v2Config.vaultLockDays}
                  onChange={(e) =>
                    setV2Config({
                      ...v2Config,
                      vaultLockDays: Number(e.target.value),
                    })
                  }
                  className="input input-bordered w-full bg-base-100"
                  disabled={vaultMode === "default"}
                />
              </div>
              <div>
                <label className="block mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    Vesting Duration (days)
                    <div
                      className="tooltip tooltip-right"
                      data-tip="Time period over which tokens gradually become available after the lock period ends. Tokens stream continuously to the beneficiary."
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 opacity-60 hover:opacity-100 cursor-help"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={v2Config.vaultVestingDays}
                  onChange={(e) =>
                    setV2Config({
                      ...v2Config,
                      vaultVestingDays: Number(e.target.value),
                    })
                  }
                  className="input input-bordered w-full bg-base-100"
                  disabled={vaultMode === "default"}
                />
              </div>
            </div>

            {/* Vault Warning */}
            {v2Config.vaultAllocation > 20 && (
              <div className="alert alert-warning py-2 mt-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="text-xs">
                  High vault allocation ({v2Config.vaultAllocation}%) reduces
                  available liquidity
                </span>
              </div>
            )}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Allocation Summary */}
      <div className="card bg-base-300 p-4 space-y-4">
        <h4 className="text-sm font-semibold">Token Allocation Breakdown</h4>

        {/* Visual Bar Chart */}
        <div className="w-full h-8 flex rounded-lg overflow-hidden">
          <div
            className="bg-primary flex items-center justify-center text-xs font-semibold text-white transition-all duration-300"
            style={{ width: `${v2Config.stakingAllocation}%` }}
            title={`Staking: ${v2Config.stakingAllocation}%`}
          >
            {v2Config.stakingAllocation > 5 && `${v2Config.stakingAllocation}%`}
          </div>
          {v2Config.enableVault && v2Config.vaultAllocation > 0 && (
            <div
              className="bg-secondary flex items-center justify-center text-xs font-semibold text-white transition-all duration-300"
              style={{ width: `${v2Config.vaultAllocation}%` }}
              title={`Vault: ${v2Config.vaultAllocation}%`}
            >
              {v2Config.vaultAllocation > 5 && `${v2Config.vaultAllocation}%`}
            </div>
          )}
          <div
            className="bg-accent flex items-center justify-center text-xs font-semibold text-white transition-all duration-300"
            style={{ width: `${lpAllocation}%` }}
            title={`LP: ${lpAllocation}%`}
          >
            {lpAllocation > 5 && `${lpAllocation}%`}
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded"></div>
              <span>Staking Rewards</span>
            </div>
            <span className="font-mono font-semibold">
              {v2Config.stakingAllocation}%
            </span>
          </div>
          {v2Config.enableVault && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-secondary rounded"></div>
                <span>Vault (Locked)</span>
              </div>
              <span className="font-mono font-semibold">
                {v2Config.vaultAllocation}%
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 border-t border-base-content/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-accent rounded"></div>
              <span>Liquidity Pool</span>
            </div>
            <span className="font-mono font-semibold">{lpAllocation}%</span>
          </div>
        </div>
      </div>

      {/* Final Summary Before Launch */}
      {formData.name && formData.symbol && (
        <div className="card bg-base-100 border-2 border-primary/20 p-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Ready to Launch
          </h4>

          <div className="space-y-3">
            {/* Name & Symbol */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-base-200 p-3 rounded-lg">
                <div className="opacity-60 text-xs mb-1">Token Name</div>
                <div className="font-semibold truncate">{formData.name}</div>
              </div>
              <div className="bg-base-200 p-3 rounded-lg">
                <div className="opacity-60 text-xs mb-1">Symbol</div>
                <div className="font-semibold font-mono">
                  ${formData.symbol}
                </div>
              </div>
            </div>

            {/* Image */}
            <div className="flex items-center gap-3 bg-base-200 p-3 rounded-lg">
              {formData.imageUrl ? (
                <>
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-base-300 shrink-0">
                    <Image
                      src={formData.imageUrl}
                      alt="Token preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="text-xs opacity-60">Image uploaded ✓</div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-lg bg-base-300 shrink-0 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 opacity-40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div className="text-xs opacity-40 italic">
                    No image (optional)
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            <div className="bg-base-200 p-3 rounded-lg">
              <div className="opacity-60 text-xs mb-1">Description</div>
              {formData.description ? (
                <div className="text-sm line-clamp-2">
                  {formData.description}
                </div>
              ) : (
                <div className="text-xs opacity-40 italic">
                  No description (optional)
                </div>
              )}
            </div>

            {/* Supply */}
            <div className="bg-base-200 p-3 rounded-lg">
              <div className="opacity-60 text-xs mb-1">Supply</div>
              <div className="font-semibold font-mono">100B</div>
            </div>

            {/* Staking Pool */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-base-200 p-3 rounded-lg">
                <div className="opacity-60 text-xs mb-1">Staking Pool</div>
                <div className="font-semibold">
                  {v2Config.stakingAllocation}% over {v2Config.stakingFlowDays}{" "}
                  days
                </div>
              </div>
              <div className="bg-base-200 p-3 rounded-lg">
                <div className="opacity-60 text-xs mb-1">Lock Period</div>
                <div className="font-semibold">
                  {v2Config.stakingLockDays}{" "}
                  {v2Config.stakingLockDays === 1 ? "day" : "days"}
                </div>
              </div>
            </div>

            {/* Vault */}
            <div className="bg-base-200 p-3 rounded-lg">
              <div className="opacity-60 text-xs mb-1">Vault Configuration</div>
              {v2Config.enableVault && v2Config.vaultAllocation > 0 ? (
                <div className="font-semibold text-sm">
                  {v2Config.vaultAllocation}% locked for {v2Config.vaultLockDays} {v2Config.vaultLockDays === 1 ? "day" : "days"}, vesting {v2Config.vaultVestingDays} {v2Config.vaultVestingDays === 1 ? "day" : "days"}
                </div>
              ) : (
                <div className="text-xs opacity-40 italic">
                  No vault (optional)
                </div>
              )}
            </div>

            {/* Liquidity Pool */}
            <div className="bg-base-200 p-3 rounded-lg">
              <div className="opacity-60 text-xs mb-1">Liquidity Pool</div>
              <div className="font-semibold">
                {lpAllocation}% paired with WETH
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Launch Button */}
      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={(isMiniAppView && !isConnected) || isDeploying}
      >
        {buttonText}
      </button>
    </form>
  );
}
