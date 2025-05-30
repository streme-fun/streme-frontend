"use client";

import { useFarcasterAuth } from "../hooks/useFarcasterAuth";
import { useSupPoints } from "../hooks/useSupPoints";
import { ClaimPointsFlow } from "./ClaimPointsFlow";
import { useAccount, useConnect } from "wagmi";
import { useEffect } from "react";

export function FarcasterAuthDemo() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
    token,
    signIn,
    signOut,
  } = useFarcasterAuth();

  const {
    userData,
    isLoading: pointsLoading,
    error: pointsError,
    fetchUserData,
    clearData: clearPointsData,
  } = useSupPoints();

  const { address: walletAddress, isConnected: isWalletConnected } =
    useAccount();
  const { connect, connectors } = useConnect();

  // Fetch user points data when authentication succeeds
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchUserData(token);
    } else if (!isAuthenticated) {
      clearPointsData();
    }
  }, [isAuthenticated, token, fetchUserData, clearPointsData]);

  const isLoading = authLoading || pointsLoading;
  const error = authError || pointsError;

  const handleSignOut = () => {
    signOut();
    clearPointsData();
  };

  const refreshUserData = async () => {
    if (token) {
      await fetchUserData(token);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-center mt-2">Loading...</p>
        <p className="text-center text-sm text-gray-500">
          {authLoading
            ? "Authenticating with Farcaster..."
            : "Loading user data..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 border-red-200">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          {authError ? "Authentication Error" : "Data Loading Error"}
        </h3>
        <p className="text-red-600 mb-4">{error}</p>
        <div className="space-y-2">
          {authError ? (
            <>
              <button
                onClick={signIn}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 mr-2"
              >
                Try Again
              </button>
              <button
                onClick={handleSignOut}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Reset
              </button>
            </>
          ) : (
            <button
              onClick={refreshUserData}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 mr-2"
            >
              Retry Loading Data
            </button>
          )}
        </div>
        <div className="mt-4 p-3 bg-red-100 rounded text-sm">
          <h4 className="font-semibold text-red-800 mb-1">Troubleshooting:</h4>
          <ul className="text-red-700 space-y-1">
            <li>
              • Make sure you&apos;re running this in a Farcaster client
              (Warpcast)
            </li>
            <li>• Check browser console for detailed error logs</li>
            <li>• Try refreshing the page</li>
            <li>• Ensure you&apos;re signed into your Farcaster account</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 border rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Test Farcaster Authentication
          </h3>
          <p className="text-gray-600 mb-6">
            Click the button below to authenticate with your Farcaster account.
            This will try quickAuth first, then fallback to standard Sign In
            with Farcaster if needed.
          </p>
          <button
            onClick={signIn}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transform hover:scale-105 transition-all duration-200 font-semibold"
          >
            🎭 Sign In with Farcaster
          </button>
          <div className="mt-4 p-3 bg-blue-100 rounded text-sm">
            <p className="text-blue-800">
              <strong>Note:</strong> This authentication demo works best when
              opened in a Farcaster client like Warpcast. It may not work in a
              regular browser.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg bg-green-50 border-green-200">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-green-800 mb-2">
          ✅ Authentication Successful!
        </h3>
        <p className="text-green-600">
          You are now authenticated with Farcaster and connected to the
          /api/sup/points endpoint.
        </p>
      </div>

      {userData && (
        <div className="bg-white p-4 rounded-lg border border-green-200 mb-4">
          <h4 className="font-semibold text-gray-800 mb-3">
            Your Profile & Points Data:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-gray-700 mb-1">Profile</h5>
              <p>
                <strong>FID:</strong> {userData.fid}
              </p>
              <p>
                <strong>Address:</strong> {userData.address.slice(0, 6)}...
                {userData.address.slice(-4)}
              </p>
            </div>
            <div>
              <h5 className="font-medium text-gray-700 mb-1">Points</h5>
              <p>
                <strong>Total Earned:</strong>{" "}
                {userData.points.totalEarned.toLocaleString()}
              </p>
              <p>
                <strong>Current Rate:</strong>{" "}
                {userData.points.currentRate.toFixed(2)}/day
              </p>
            </div>
            <div>
              <h5 className="font-medium text-gray-700 mb-1">FluidLocker</h5>
              <p>
                <strong>Address:</strong>{" "}
                {userData.fluidLocker.address?.slice(0, 6)}...
                {userData.fluidLocker.address?.slice(-4)}
              </p>
              <p>
                <strong>Created:</strong>{" "}
                {userData.fluidLocker.isCreated ? "✅ Yes" : "❌ No"}
              </p>
            </div>
            <div>
              <h5 className="font-medium text-gray-700 mb-1">Stack Data</h5>
              <p>
                <strong>Signed:</strong>{" "}
                {userData.points.stackSignedData ? "✅ Available" : "❌ None"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Claim Points Flow */}
      {userData && (
        <div className="space-y-4">
          {/* Wallet Connection Status */}
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-gray-800 mb-2">
              Wallet Connection
            </h4>
            {isWalletConnected ? (
              <div className="text-green-600">
                ✅ Wallet Connected: {walletAddress?.slice(0, 6)}...
                {walletAddress?.slice(-4)}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-orange-600">⚠️ Wallet not connected</div>
                <button
                  onClick={() =>
                    connectors[0] && connect({ connector: connectors[0] })
                  }
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Connect Wallet
                </button>
              </div>
            )}
          </div>

          <ClaimPointsFlow
            userData={userData}
            onUserDataUpdate={refreshUserData}
          />
        </div>
      )}

      <div className="flex gap-2 justify-center">
        <button
          onClick={refreshUserData}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Refresh Data
        </button>
        <button
          onClick={handleSignOut}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Sign Out
        </button>
      </div>

      <div className="mt-4 p-3 bg-green-100 rounded text-xs text-green-800">
        <strong>API Endpoint:</strong> GET /api/sup/points
        <br />
        <strong>Auth Method:</strong> Bearer token from Farcaster quickAuth or
        SIWF
        <br />
        <strong>Status:</strong> Working correctly! 🎉
      </div>
    </div>
  );
}
