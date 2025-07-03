"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Image from "next/image";
import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { readContract } from "wagmi/actions";
import { config } from "@/src/components/providers/WagmiProvider";
import { parseEther } from "viem";
import { toast } from "sonner";
import { 
  STREME_DEPLOY_ADDRESS, 
  STREME_DEPLOY_ABI, 
  LP_FACTORY_ADDRESS,
  TOKEN_FACTORY_ADDRESS,
  POST_DEPLOY_HOOK_ADDRESS,
  MAIN_STREME_ADDRESS
} from "@/src/lib/contracts";

export function LaunchForm() {
  const { login, authenticated, user } = usePrivy();
  const { isMiniAppView, isConnected, farcasterContext } = useAppFrameLogic();
  const { address } = useAccount();

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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
  const { writeContract, data: deployHash, isPending: isWritePending } = useWriteContract();

  // Wait for deployment transaction
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: deployHash,
  });

  // Handle transaction success
  useEffect(() => {
    if (isTxSuccess) {
      toast.success("🎉 Token deployed successfully!");
      setIsDeploying(false);
      // Reset form
      setFormData({
        name: "",
        symbol: "",
        description: "",
        imageUrl: "",
      });
      setPreviewUrl("");
    }
  }, [isTxSuccess]);

  // Update loading state
  useEffect(() => {
    setIsDeploying(isWritePending || isTxLoading);
  }, [isWritePending, isTxLoading]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setPreviewUrl(previewUrl);
    setIsUploadingImage(true);

    try {
      // Upload to Vercel Blob
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { url } = await response.json();
      
      // Update form data with the uploaded URL
      setFormData(prev => ({ ...prev, imageUrl: url }));
      toast.success('Image uploaded successfully!');
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Failed to upload image');
      // Clear preview on error
      setPreviewUrl('');
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
      console.log("Preparing token deployment for:", formData.symbol, userAddress);

      // Generate salt using the main Streme contract (matching successful transaction pattern)
      let salt = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
      
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
        
        const [generatedSalt, predictedToken] = saltResult as [`0x${string}`, `0x${string}`];
        salt = generatedSalt;
        console.log("Generated salt:", salt, "Predicted token:", predictedToken);
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
        note: "No ETH value - just gas fees"
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    ? "DEPLOYING TOKEN..."
    : "LAUNCH TOKEN";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card bg-base-100 border border-black/[.1] dark:border-white/[.1]">
        <div className="card-body">
          {/* Token Details */}
          <div className="space-y-6">
            {/* Image Upload */}
            <div>
              <label className="text-base opacity-60 mb-2 block">
                Token Image
              </label>
              <div className="flex items-center gap-4">
                {/* Image Preview */}
                <div className="relative w-24 h-24 bg-black/[.02] dark:bg-white/[.02] rounded-full overflow-hidden flex items-center justify-center">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Token preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-4xl opacity-20">🖼️</span>
                  )}
                </div>
                {/* Upload Button */}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className={`btn btn-ghost bg-black/[.02] dark:bg-white/[.02] w-full justify-start normal-case ${
                      isUploadingImage ? "loading" : ""
                    }`}
                  >
                    {isUploadingImage 
                      ? "Uploading..." 
                      : previewUrl 
                      ? "Change Image" 
                      : "Upload Image"
                    }
                  </label>
                  <div className="text-xs opacity-40 mt-2">
                    Recommended: 400x400px or larger
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-base opacity-60 mb-2 block">
                Token Name
              </label>
              <input
                type="text"
                placeholder="e.g. Based Fwog"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="input input-ghost bg-black/[.02] dark:bg-white/[.02] w-full text-base"
                required
              />
            </div>

            <div>
              <label className="text-base opacity-60 mb-2 block">
                Token Symbol
              </label>
              <input
                type="text"
                placeholder="e.g. FWOG"
                value={formData.symbol}
                onChange={(e) =>
                  setFormData({ ...formData, symbol: e.target.value })
                }
                className="input input-ghost bg-black/[.02] dark:bg-white/[.02] w-full text-base"
                required
              />
            </div>

            <div>
              <label className="text-base opacity-60 mb-2 block">
                Description
              </label>
              <textarea
                placeholder="Tell us about your token..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="textarea textarea-ghost bg-black/[.02] dark:bg-white/[.02] w-full h-32"
                required
              />
              <div className="text-xs opacity-40 mt-2">
                200,000 tokens (20% of supply) will be distributed to stakers
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Launch Button */}
      <button
        type="submit"
        className="btn btn-primary btn-lg w-full font-bold text-lg"
        disabled={(isMiniAppView && !isConnected) || isDeploying}
      >
        {buttonText}
      </button>
    </form>
  );
}
