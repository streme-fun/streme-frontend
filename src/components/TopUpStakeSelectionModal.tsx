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

type FilterType = "all" | "topup" | "unstaked";

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

      return updated;
    });
  };

  // Calculate counts for each filter
  const topupCount = stakeOptions.filter(
    (option) => !!option.stakingPoolAddress
  ).length;
  const unstakedCount = stakeOptions.filter(
    (option) => !option.stakingPoolAddress
  ).length;

  // Check selection states for each category
  const allSelected =
    stakeOptions.length > 0 && stakeOptions.every((option) => option.selected);
  const topupTokens = stakeOptions.filter(
    (option) => !!option.stakingPoolAddress
  );
  const topupAllSelected =
    topupTokens.length > 0 && topupTokens.every((option) => option.selected);
  const unstakedTokens = stakeOptions.filter(
    (option) => !option.stakingPoolAddress
  );
  const unstakedAllSelected =
    unstakedTokens.length > 0 &&
    unstakedTokens.every((option) => option.selected);

  const handleBulkSelect = (filter: FilterType) => {
    setStakeOptions((prev) => {
      if (filter === "all") {
        const newSelectAll = !allSelected;
        return prev.map((option) => ({ ...option, selected: newSelectAll }));
      } else if (filter === "topup") {
        const newSelectTopup = !topupAllSelected;
        return prev.map((option) =>
          !!option.stakingPoolAddress
            ? { ...option, selected: newSelectTopup }
            : option
        );
      } else if (filter === "unstaked") {
        const newSelectUnstaked = !unstakedAllSelected;
        return prev.map((option) =>
          !option.stakingPoolAddress
            ? { ...option, selected: newSelectUnstaked }
            : option
        );
      }
      return prev;
    });
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setStakeOptions((prev) =>
      prev.map((option) => ({ ...option, selected: newSelectAll }))
    );
  };

  // Update selectAll state based on overall selection
  useEffect(() => {
    setSelectAll(allSelected);
  }, [allSelected]);

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
      <div className="bg-base-100 rounded-lg max-w-md w-full mx-4">
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
              {/* Bulk Selection Buttons */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="checkbox checkbox-primary"
                    />
                    <span className="font-medium">
                      Select All ({stakeOptions.length})
                    </span>
                  </label>

                  <div className="flex gap-1">
                    <button
                      className={`btn btn-xs ${
                        topupAllSelected
                          ? "btn-secondary"
                          : "btn-ghost text-gray-500 hover:text-gray-700"
                      }`}
                      onClick={() => handleBulkSelect("topup")}
                      title={`${
                        topupAllSelected ? "Deselect" : "Select"
                      } all top up tokens`}
                    >
                      {topupAllSelected ? "✓" : ""} Top up ({topupCount})
                    </button>
                    <button
                      className={`btn btn-xs ${
                        unstakedAllSelected
                          ? "btn-primary"
                          : "btn-ghost text-gray-500 hover:text-gray-700"
                      }`}
                      onClick={() => handleBulkSelect("unstaked")}
                      title={`${
                        unstakedAllSelected ? "Deselect" : "Select"
                      } all unstaked tokens`}
                    >
                      {unstakedAllSelected ? "✓" : ""} New ({unstakedCount})
                    </button>
                  </div>
                </div>
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
                                Top up
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
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-2">
                <div className="flex flex-col gap-2">
                  {selectedCount > 30 && (
                    <div className="text-xs text-base-content/70 text-center">
                      Note: Large selections will be processed in multiple batches for reliability
                    </div>
                  )}
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
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
