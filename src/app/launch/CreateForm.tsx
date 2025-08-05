"use client";

import { useState, useEffect } from "react";
import { useSafePrivy } from "@/src/hooks/useSafePrivy";
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
  STREME_DEPLOY_ADDRESS,
  STREME_DEPLOY_ABI,
  LP_FACTORY_ADDRESS,
  TOKEN_FACTORY_ADDRESS,
  POST_DEPLOY_HOOK_ADDRESS,
  MAIN_STREME_ADDRESS,
} from "@/src/lib/contracts";

export function CreateForm() {
  const { login, authenticated, user } = useSafePrivy();
  const { isMiniAppView, isConnected, farcasterContext } = useAppFrameLogic();
  const { address } = useAccount();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
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
    if (isTxSuccess && deployedTokenAddress) {
      toast.success(
        "🎉 Token deployed successfully! Redirecting in 3 seconds..."
      );
      setIsDeploying(false);

      console.log(
        "Deployment successful, token address:",
        deployedTokenAddress
      );
      console.log("Transaction hash:", deployHash);

      // Add a delay to allow backend indexing before redirect
      setTimeout(() => {
        router.push(`/launched-tokens`);
      }, 3000); // 3 second delay
    }
  }, [isTxSuccess, deployedTokenAddress, router, deployHash]);

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

    if (!formData.symbol.trim()) {
      toast.error("Token symbol is required");
      return;
    }

    setIsDeploying(true);

    try {
      console.log(
        "Preparing token deployment for:",
        formData.symbol,
        userAddress
      );

      // Generate salt using the main Streme contract (matching successful transaction pattern)
      let salt =
        "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

      try {
        console.log("Generating salt with main contract:", MAIN_STREME_ADDRESS);
        console.log("Should NOT be using wrapper:", STREME_DEPLOY_ADDRESS);
        console.log("Using TOKEN_FACTORY_ADDRESS:", TOKEN_FACTORY_ADDRESS);

        const saltResult = await readContract(config, {
          address: MAIN_STREME_ADDRESS,
          abi: [
            {
              inputs: [
                { name: "_symbol", type: "string" },
                { name: "_requestor", type: "address" },
                { name: "_tokenFactory", type: "address" },
                { name: "_pairedToken", type: "address" },
              ],
              name: "generateSalt",
              outputs: [
                { name: "salt", type: "bytes32" },
                { name: "token", type: "address" },
              ],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "generateSalt",
          args: [
            formData.symbol,
            userAddress as `0x${string}`,
            TOKEN_FACTORY_ADDRESS, // Use the correct tokenFactory address
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
        _symbol: formData.symbol,
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

      // Deploy token using the wrapper contract (as originally requested)
      // but with correct addresses from successful transaction
      console.log("Deploying with wrapper contract and correct addresses:", {
        contract: STREME_DEPLOY_ADDRESS, // Use wrapper as originally requested
        tokenFactory: TOKEN_FACTORY_ADDRESS,
        postDeployHook: POST_DEPLOY_HOOK_ADDRESS,
        liquidityFactory: LP_FACTORY_ADDRESS,
        postLPHook: "0x0000000000000000000000000000000000000000",
        tokenConfig,
        note: "No ETH value - just gas fees",
      });

      // Use the wrapper contract (as originally requested) with correct addresses
      writeContract({
        address: STREME_DEPLOY_ADDRESS, // Back to using wrapper contract
        abi: STREME_DEPLOY_ABI, // Use the original wrapper ABI
        functionName: "deploy", // Wrapper function name
        args: [
          TOKEN_FACTORY_ADDRESS, // tokenFactory (from successful transaction)
          POST_DEPLOY_HOOK_ADDRESS, // postDeployHook (from successful transaction)
          LP_FACTORY_ADDRESS, // liquidityFactory (from successful transaction)
          "0x0000000000000000000000000000000000000000", // postLPHook (zero address)
          tokenConfig, // Token config with proper salt
        ],
        // No value needed - just gas fees
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      {/* Name Field */}
      <div>
        <label className="block mb-2">
          <span className="text-sm font-medium">Name</span>
          <span className="text-error ml-1">*</span>
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
          <span className="text-sm font-medium">Symbol</span>
          <span className="text-error ml-1">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50">
            $
          </span>
          <input
            type="text"
            placeholder="Enter token symbol"
            value={formData.symbol}
            onChange={(e) =>
              setFormData({ ...formData, symbol: e.target.value })
            }
            className="input input-bordered w-full bg-base-200"
            required
          />
        </div>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block mb-2">
          <span className="text-sm font-medium">Image</span>
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

      {/* Token Metadata Collapsible */}
      <div className="collapse collapse-arrow bg-base-200">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-medium flex items-center">
          <span>Token Metadata (optional)</span>
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
