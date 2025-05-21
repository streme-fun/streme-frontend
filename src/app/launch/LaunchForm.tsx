"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Image from "next/image";

export function LaunchForm() {
  const { login, authenticated } = usePrivy();
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a preview URL for the image
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      // TODO: Upload image to storage and get URL
      setFormData({ ...formData, imageUrl: url });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authenticated) {
      login();
      return;
    }
    // TODO: Implement token launch
    console.log("Launching token:", formData);
  };

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
                    required
                  />
                  <label
                    htmlFor="image-upload"
                    className="btn btn-ghost bg-black/[.02] dark:bg-white/[.02] w-full justify-start normal-case"
                  >
                    {previewUrl ? "Change Image" : "Upload Image"}
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
                className="input input-ghost bg-black/[.02] dark:bg-white/[.02] w-full"
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
                className="input input-ghost bg-black/[.02] dark:bg-white/[.02] w-full"
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
      >
        {authenticated ? "LAUNCH TOKEN" : "CONNECT WALLET TO LAUNCH"}
      </button>
    </form>
  );
}
