import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

interface LeaderboardRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeaderboardRewardModal({
  isOpen,
  onClose,
}: LeaderboardRewardModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-base-100 p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-2xl font-bold flex items-center gap-2"
                  >
                    <span className="text-2xl">🏆</span> Rewards
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="btn btn-ghost btn-sm btn-circle"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold mb-2">
                      Proportional Reward
                    </h4>
                    <p className="text-base-content/80">
                      $1,000 reward pool split among the top 25 tokens based on
                      total stakers and rewards distributed.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-2">Your Reward</h4>
                    <p className="text-base-content/80">
                      Each one of the top 25 tokens will receive a part of the
                      total reward pool proportional to its score.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold mb-2">Example</h4>
                    <p className="text-base-content/80">
                      For example, if your token drove 10% of all stakers and
                      rewards among the top 25 tokens, it will receive 10% of
                      the reward, or $100.
                    </p>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
