"use client";

import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { formatUnits } from "viem";

interface StakeOption {
  tokenAddress: string;
  stakingAddress: string;
  stakingPoolAddress: string;
  symbol: string;
  balance: bigint;
  selected: boolean;
}

interface TopUpStakeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  stakesWithBalances: Array<{
    tokenAddress: string;
    stakingAddress: string;
    stakingPoolAddress: string;
    symbol: string;
    balance: bigint;
  }>;
  onProceed: (
    selectedStakes: Array<{
      tokenAddress: string;
      stakingAddress: string;
      stakingPoolAddress: string;
      symbol: string;
      balance: bigint;
    }>
  ) => void;
}

export function TopUpStakeSelectionModal({
  isOpen,
  onClose,
  stakesWithBalances,
  onProceed,
}: TopUpStakeSelectionModalProps) {
  const [stakeOptions, setStakeOptions] = useState<StakeOption[]>([]);
  const [selectAll, setSelectAll] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    // Convert stakesWithBalances to stakeOptions with all selected by default
    const options: StakeOption[] = stakesWithBalances.map((stake) => ({
      ...stake,
      selected: true, // Pre-select all by default
    }));

    setStakeOptions(options);
    setSelectAll(true);
  }, [isOpen, stakesWithBalances]);

  const handleToggleStake = (index: number) => {
    setStakeOptions((prev) => {
      const updated = prev.map((option, i) =>
        i === index ? { ...option, selected: !option.selected } : option
      );

      // Update selectAll state based on whether all items are selected
      const allSelected = updated.every((option) => option.selected);
      setSelectAll(allSelected);

      return updated;
    });
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setStakeOptions((prev) =>
      prev.map((option) => ({ ...option, selected: newSelectAll }))
    );
  };

  const handleProceed = () => {
    const selectedStakes = stakeOptions
      .filter((option) => option.selected)
      .map((option) => ({
        tokenAddress: option.tokenAddress,
        stakingAddress: option.stakingAddress,
        stakingPoolAddress: option.stakingPoolAddress,
        symbol: option.symbol,
        balance: option.balance,
      }));

    onProceed(selectedStakes);
    onClose();
  };

  const selectedCount = stakeOptions.filter((option) => option.selected).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Select Tokens to Stake</h2>
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost"
            >
              ✕
            </button>
          </div>

          {stakeOptions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No tokens available to stake</p>
              <button onClick={onClose} className="btn btn-primary mt-4">
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="checkbox checkbox-primary"
                  />
                  <span className="font-medium">
                    Select All ({stakeOptions.length} tokens)
                  </span>
                </label>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {stakeOptions.map((option, index) => (
                  <div
                    key={option.tokenAddress}
                    className={`border rounded-lg p-3 transition-colors ${
                      option.selected
                        ? "border-primary bg-primary/5"
                        : "border-gray-200"
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={option.selected}
                        onChange={() => handleToggleStake(index)}
                        className="checkbox checkbox-primary"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{option.symbol}</span>
                            {option.stakingPoolAddress ? (
                              <span className="badge badge-secondary badge-xs">
                                Top-up
                              </span>
                            ) : (
                              <span className="badge badge-primary badge-xs">
                                New
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">
                            {Number(
                              formatUnits(option.balance, 18)
                            ).toLocaleString("en-US", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 6,
                            })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {option.tokenAddress.slice(0, 6)}...
                          {option.tokenAddress.slice(-4)}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm text-gray-500">
                      Selected: {selectedCount} tokens
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={onClose} className="btn btn-outline flex-1">
                    Cancel
                  </button>
                  <button
                    onClick={handleProceed}
                    disabled={selectedCount === 0}
                    className="btn btn-primary flex-1"
                  >
                    {selectedCount === 0
                      ? "Select tokens"
                      : `Stake ${selectedCount} token${
                          selectedCount === 1 ? "" : "s"
                        }`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
