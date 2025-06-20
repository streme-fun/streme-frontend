"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import {
  useTokenLiquidity,
  isLiquidityLow,
} from "@/src/hooks/useTokenLiquidity";

interface LiquidityWarningProps {
  tokenAddress: string;
  tokenLaunchTime: string | number | Date;
  tokenSymbol?: string;
  className?: string;
  onDismiss?: () => void;
}

export const LiquidityWarning = ({
  tokenAddress,
  tokenLaunchTime,
  tokenSymbol = "token",
  className = "",
  onDismiss,
}: LiquidityWarningProps) => {
  const { wethBalance, wethBalanceFormatted, poolAddress, isLoading, error } =
    useTokenLiquidity(tokenAddress);

  // Don't show warning if still loading or if there's an error
  if (isLoading || error) return null;

  // Check if liquidity is low
  const lowLiquidity = isLiquidityLow(wethBalance, tokenLaunchTime);

  // Don't show warning if liquidity is adequate
  if (!lowLiquidity) return null;

  const wethAmount = wethBalanceFormatted
    ? parseFloat(wethBalanceFormatted)
    : 0;
  const uniswapPoolUrl = poolAddress
    ? `https://app.uniswap.org/explore/pools/base/${poolAddress}`
    : null;

  return (
    <div className={`alert alert-warning shadow-lg ${className}`}>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div className="flex-1">
            <h3 className="font-bold text-sm">⚠️ Low Liquidity Warning</h3>
            <div className="text-xs mt-1 space-y-1">
              <p>
                This {tokenSymbol} pool has very low liquidity (
                {wethAmount.toFixed(4)} WETH). You may have difficulty selling
                your tokens later.
              </p>
            </div>
          </div>
        </div>

        {/* Pool link and actions */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {uniswapPoolUrl && (
              <a
                href={uniswapPoolUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-outline btn-warning"
              >
                <ExternalLink className="h-3 w-3" />
                View Pool
              </a>
            )}
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="btn btn-xs btn-ghost"
              title="Dismiss warning"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Compact version for inline use
export const InlineLiquidityWarning = ({
  tokenAddress,
  tokenLaunchTime,
  tokenSymbol = "token",
  className = "",
}: Omit<LiquidityWarningProps, "onDismiss">) => {
  const { wethBalance, wethBalanceFormatted, isLoading, error } =
    useTokenLiquidity(tokenAddress);

  if (isLoading || error) return null;

  const lowLiquidity = isLiquidityLow(wethBalance, tokenLaunchTime);
  if (!lowLiquidity) return null;

  const wethAmount = wethBalanceFormatted
    ? parseFloat(wethBalanceFormatted)
    : 0;

  return (
    <div
      className={`flex items-center gap-2 text-warning text-xs ${className}`}
    >
      <AlertTriangle className="h-4 w-4" />
      <span>
        Low {tokenSymbol} liquidity ({wethAmount.toFixed(4)} WETH) - selling may
        be difficult
      </span>
    </div>
  );
};
