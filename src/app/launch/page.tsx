"use client";

// Original imports - commented out for maintenance
// import { CreateForm } from "./CreateForm";
// import { useAppFrameLogic } from "@/src/hooks/useAppFrameLogic";
// import sdk from "@farcaster/miniapp-sdk";
// import Image from "next/image";
// import { useEffect } from "react";

export default function LaunchPage() {
  // TEMPORARILY DISABLED FOR MAINTENANCE
  // const { isMiniAppView, isSDKLoaded } = useAppFrameLogic();

  // // Call ready when the component is fully loaded in mini app view
  // useEffect(() => {
  //   if (isMiniAppView && isSDKLoaded) {
  //     console.log("🟢 Launch page ready, calling sdk.actions.ready()");
  //     sdk.actions.ready();
  //   }
  // }, [isMiniAppView, isSDKLoaded]);

  // const handleCreateWithCast = async () => {
  //   const castText = `@streme Launch a token for me

  // Name: [your token name]
  // Symbol: $[your ticker]

  // [Don't forget to attach an image!] 🎨`;

  //   if (isMiniAppView && isSDKLoaded && sdk) {
  //     // Mini-app: use SDK to compose cast
  //     try {
  //       await sdk.actions.composeCast({
  //         text: castText,
  //         embeds: [],
  //       });
  //     } catch (error) {
  //       console.error("Error composing cast:", error);
  //       // Fallback to web URL
  //       const farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
  //       window.open(farcasterUrl, '_blank');
  //     }
  //   } else {
  //     // Desktop/mobile: open Farcaster web with pre-filled text
  //     const farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
  //     window.open(farcasterUrl, '_blank');
  //   }
  // };

  return (
    <div className="flex items-center justify-center min-h-screen bg-base-100">
      <div className="max-w-md mx-auto text-center px-4">
        <div className="mb-6">
          <div className="text-6xl mb-4">🔧</div>
          <h1 className="text-4xl font-bold mb-4">Currently Upgrading</h1>
        </div>
      </div>
    </div>
  );

  // ORIGINAL LAUNCH CODE - COMMENTED OUT FOR MAINTENANCE
  // return (
  //   <>
  //     {/* <div className="fixed inset-0 -z-10">
  //       <HeroAnimationMini />
  //     </div> */}
  //     <div className="max-w-md lg:max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-24 relative z-10 bg-base-100">
  //       <div className="mx-auto">
  //         <div className="text-center mb-8">
  //           <h1 className="text-4xl font-bold tracking-tight mb-4">
  //             Launch a Streme Token
  //           </h1>
  //           <p className="opacity-60">
  //             Launch a token with customizable staking rewards and vesting schedules.
  //             Configure flexible allocations for staking, vaults, and liquidity.
  //           </p>
  //         </div>
  //
  //         <CreateForm />
  //
  //         {/* Launch with Cast button */}
  //         <div className="mt-6 text-center">
  //           <p className="text-sm opacity-60 mb-3">
  //             Or
  //           </p>
  //           <button
  //             onClick={handleCreateWithCast}
  //             className="btn btn-outline btn-primary"
  //           >
  //             <Image
  //               src="/farcaster.svg"
  //               alt="Farcaster"
  //               width={20}
  //               height={20}
  //               className="mr-2"
  //             />
  //             Launch Token with Cast
  //           </button>
  //         </div>
  //       </div>
  //     </div>
  //   </>
  // );
}
