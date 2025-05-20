"use client";

import { Trophy, Info } from "lucide-react";

export function LeaderboardHeader() {
  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <span className="relative inline-block">
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 blur-lg opacity-60"></span>
            <span className="relative inline-block px-3 py-1 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-lg border border-indigo-200/20 text-2xl font-mono text-primary bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
              Season Zero
            </span>
          </span>
          Leaderboard
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const modal = document.getElementById(
                "reward-modal"
              ) as HTMLDialogElement;
              if (modal) modal.showModal();
            }}
            className="btn btn-outline gap-2 text-primary hover:bg-indigo-50"
          >
            <Trophy className="w-5 h-5" />
            Reward
          </button>
          <button
            onClick={() => {
              const modal = document.getElementById(
                "how-to-earn-modal"
              ) as HTMLDialogElement;
              if (modal) modal.showModal();
            }}
            className="btn btn-outline gap-2 text-primary hover:bg-indigo-50"
          >
            <Info className="w-5 h-5" />
            How to earn
          </button>
        </div>
      </div>

      <dialog id="reward-modal" className="modal">
        <div className="modal-box bg-base-100 w-full max-w-lg mx-4 p-8 shadow-xl border border-black/[.1] dark:border-white/[.1]">
          <form method="dialog">
            <button className="absolute top-4 right-4 btn btn-ghost btn-sm">
              ✕
            </button>
          </form>
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Reward System</h2>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">
                Proportional Reward
              </h3>
              <p className="opacity-80">
                $1,000 reward pool split among the top 25 tokens based on total
                stakers and rewards streamed to winners.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-secondary">
                Your Reward
              </h3>
              <p className="opacity-80">
                Each one of the top 25 tokens will receive a part of the total
                reward pool proportional to its score.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-accent">
                Example
              </h3>
              <p className="opacity-80">
                For example, if your token drove 10% of all stakers and rewards
                among the top 25 tokens, it will receive 10% of the reward, or
                $100.
              </p>
            </div>
          </div>
        </div>
        <form
          method="dialog"
          className="modal-backdrop bg-black/20 backdrop-blur-sm"
        ></form>
      </dialog>

      <dialog id="how-to-earn-modal" className="modal">
        <div className="modal-box bg-base-100 w-full max-w-lg mx-4 p-8 shadow-xl border border-black/[.1] dark:border-white/[.1]">
          <form method="dialog">
            <button className="absolute top-4 right-4 btn btn-ghost btn-sm">
              ✕
            </button>
          </form>
          <div className="flex items-center gap-2 mb-6">
            <Info className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">How to earn</h2>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">
                Launch a token
              </h3>
              <p className="opacity-80">
                Your ranking is based on the seasonal rulset.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-secondary">
                Get Ranked {"->"} Top 25
              </h3>
              <p className="opacity-80">
                Each week, the top 25 tokens will receive USDC rewards streamed
                based on their ranking.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-accent">
                Receive USDC
              </h3>
              <p className="opacity-80">
                Rewards are sent to your connected Ethereum address on Base
                network.
              </p>
            </div>
          </div>
        </div>
        <form
          method="dialog"
          className="modal-backdrop bg-black/20 backdrop-blur-sm"
        ></form>
      </dialog>
    </>
  );
}
