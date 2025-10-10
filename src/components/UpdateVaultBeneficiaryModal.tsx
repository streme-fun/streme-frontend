"use client";

import { useState, useEffect } from "react";
import { useWriteContract } from "wagmi";
import { STREME_VAULT, STREME_VAULT_ABI } from "@/src/lib/contracts";
import { Modal } from "./Modal";

interface Beneficiary {
  address: string;
  units: string;
}

interface UpdateVaultBeneficiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  adminAddress: string;
  tokenSymbol: string;
}

export function UpdateVaultBeneficiaryModal({
  isOpen,
  onClose,
  tokenAddress,
  adminAddress,
  tokenSymbol,
}: UpdateVaultBeneficiaryModalProps) {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { address: "", units: "" },
  ]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const { writeContract, isPending, isSuccess, error } = useWriteContract();

  useEffect(() => {
    if (isSuccess) {
      // Reset form and close modal after successful transaction
      setTimeout(() => {
        onClose();
        setBeneficiaries([{ address: "", units: "" }]);
      }, 2000);
    }
  }, [isSuccess, onClose]);

  // Fetch current vault members
  useEffect(() => {
    if (!isOpen || !tokenAddress || !adminAddress) return;

    const fetchVaultMembers = async () => {
      setLoadingMembers(true);
      try {
        const response = await fetch(
          `/api/vault/${tokenAddress}/members?admin=${adminAddress}`
        );

        if (!response.ok) {
          console.warn("Failed to fetch vault members:", response.status);
          return;
        }

        const data = await response.json();

        if (data.members && data.members.length > 0) {
          setBeneficiaries(data.members);
        }
      } catch (error) {
        console.error("Error fetching vault members:", error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchVaultMembers();
  }, [isOpen, tokenAddress, adminAddress]);

  const handleUpdate = () => {
    const validBeneficiaries = beneficiaries.filter(
      (b) => b.address && b.units
    );

    if (validBeneficiaries.length === 0) {
      alert("Please add at least one beneficiary");
      return;
    }

    const addresses = validBeneficiaries.map((b) => b.address as `0x${string}`);
    const unitValues = validBeneficiaries.map((b) => BigInt(b.units));

    writeContract({
      address: STREME_VAULT as `0x${string}`,
      abi: STREME_VAULT_ABI,
      functionName: "updateMemberUnitsBatch",
      args: [
        tokenAddress as `0x${string}`,
        adminAddress as `0x${string}`,
        addresses,
        unitValues,
      ],
    });
  };

  const addBeneficiary = () => {
    setBeneficiaries([...beneficiaries, { address: "", units: "" }]);
  };

  const removeBeneficiary = (index: number) => {
    setBeneficiaries(beneficiaries.filter((_, i) => i !== index));
  };

  const updateBeneficiary = (
    index: number,
    field: "address" | "units",
    value: string
  ) => {
    const updated = [...beneficiaries];
    updated[index][field] = value;
    setBeneficiaries(updated);
  };

  const calculatePercentages = () => {
    const totalUnits = beneficiaries.reduce(
      (sum, b) => sum + (parseFloat(b.units) || 0),
      0
    );

    const percentages: Record<string, number> = {};
    beneficiaries.forEach((b) => {
      if (b.address && b.units) {
        percentages[b.address] =
          ((parseFloat(b.units) || 0) / totalUnits) * 100;
      }
    });

    return percentages;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h3 className="font-bold text-lg mb-4">
          Manage Vault Beneficiaries - ${tokenSymbol}
        </h3>

        <div className="alert alert-info mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span className="text-sm">
            Units represent shares of the vault distribution. If vesting is active,
            stream rates will adjust instantly.
          </span>
        </div>

        {/* Loading State */}
        {loadingMembers && (
          <div className="flex justify-center items-center py-4">
            <span className="loading loading-spinner loading-md"></span>
            <span className="ml-2">Loading current beneficiaries...</span>
          </div>
        )}

        <div className="space-y-4">
          {beneficiaries.map((b, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                placeholder="Address (0x...)"
                className="input input-bordered flex-1"
                value={b.address}
                onChange={(e) =>
                  updateBeneficiary(index, "address", e.target.value)
                }
              />
              <input
                type="number"
                placeholder="Units"
                className="input input-bordered w-24"
                value={b.units}
                onChange={(e) =>
                  updateBeneficiary(index, "units", e.target.value)
                }
                min="0"
              />
              <button
                className="btn btn-square btn-outline btn-error"
                onClick={() => removeBeneficiary(index)}
                disabled={beneficiaries.length === 1}
              >
                ×
              </button>
            </div>
          ))}

          <button
            className="btn btn-sm btn-outline w-full"
            onClick={addBeneficiary}
          >
            + Add Beneficiary
          </button>

          {/* Show percentage distribution */}
          <div className="bg-base-200 rounded-lg p-3">
            <p className="text-sm font-semibold mb-2">Distribution:</p>
            {Object.entries(calculatePercentages()).map(
              ([addr, pct]) =>
                addr && (
                  <p key={addr} className="text-xs font-mono">
                    {addr.slice(0, 6)}...{addr.slice(-4)}:{" "}
                    {pct.toFixed(2)}%
                  </p>
                )
            )}
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={handleUpdate}
            disabled={isPending}
          >
            {isPending ? (
              <span className="loading loading-spinner"></span>
            ) : (
              "Update Beneficiaries"
            )}
          </button>
        </div>

        {error && (
          <div className="alert alert-error mt-4">
            <span>
              {error.message.includes("User rejected") || error.message.includes("user rejected")
                ? "Transaction cancelled"
                : error.message}
            </span>
          </div>
        )}

        {isSuccess && (
          <div className="alert alert-success mt-4">
            <span>Beneficiary updated successfully!</span>
          </div>
        )}

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
