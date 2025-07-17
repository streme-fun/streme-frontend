"use client";

import { useState } from "react";
import { Crowdfund, CrowdfundCategory } from "@/src/app/types/crowdfund";

interface CreateCrowdfundModalProps {
  onClose: () => void;
  onCrowdfundCreated: (crowdfund: Crowdfund) => void;
}

export const CreateCrowdfundModal = ({ onClose, onCrowdfundCreated }: CreateCrowdfundModalProps) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    goal: "",
    category: CrowdfundCategory.OTHER,
    endDate: "",
    imageUrl: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // In a real implementation, this would call your API
      const newCrowdfund: Crowdfund = {
        id: Date.now().toString(),
        title: formData.title,
        description: formData.description,
        goal: parseInt(formData.goal),
        currentAmount: 0,
        startDate: new Date().toISOString(),
        endDate: formData.endDate || undefined,
        isActive: true,
        category: formData.category,
        totalContributors: 0,
        createdBy: "0x0000000000000000000000000000000000000000", // Would be user's address
        imageUrl: formData.imageUrl || undefined
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onCrowdfundCreated(newCrowdfund);
    } catch (error) {
      console.error("Error creating crowdfund:", error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: CrowdfundCategory.DEFI, label: "DeFi" },
    { value: CrowdfundCategory.GAMING, label: "Gaming" },
    { value: CrowdfundCategory.SOCIAL, label: "Social" },
    { value: CrowdfundCategory.CHARITY, label: "Charity" },
    { value: CrowdfundCategory.DEVELOPMENT, label: "Development" },
    { value: CrowdfundCategory.COMMUNITY, label: "Community" },
    { value: CrowdfundCategory.OTHER, label: "Other" }
  ];

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">Create New Crowdfund</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Crowdfund Title</span>
            </label>
            <input
              type="text"
              placeholder="Enter crowdfund title"
              className="input input-bordered"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          {/* Description */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              placeholder="Describe your crowdfund and its goals"
              className="textarea textarea-bordered h-24"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              required
            />
          </div>

          {/* Goal and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Goal (STREME)</span>
              </label>
              <input
                type="number"
                placeholder="1000000"
                className="input input-bordered"
                value={formData.goal}
                onChange={(e) => setFormData({...formData, goal: e.target.value})}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Category</span>
              </label>
              <select
                className="select select-bordered"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value as CrowdfundCategory})}
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* End Date and Image URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">End Date (Optional)</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Image URL (Optional)</span>
              </label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                className="input input-bordered"
                value={formData.imageUrl}
                onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Creating...
                </>
              ) : (
                "Create Crowdfund"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};