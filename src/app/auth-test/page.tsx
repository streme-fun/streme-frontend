import { FarcasterAuthDemo } from "../../components/FarcasterAuthDemo";

export default function AuthTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          Farcaster QuickAuth Test
        </h1>
        <p className="text-gray-600 text-center mb-8">
          This page demonstrates the Farcaster quickAuth integration with the
          /api/sup/points endpoint.
        </p>
        <FarcasterAuthDemo />

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">How it works:</h3>
          <ol className="list-decimal list-inside space-y-1 text-blue-700 text-sm">
            <li>
              Click &ldquo;Sign In with Farcaster&rdquo; to trigger quickAuth
            </li>
            <li>
              The SDK will request a JWT token from Farcaster&apos;s auth server
            </li>
            <li>
              The token is sent to /api/sup/points with Bearer authentication
            </li>
            <li>
              The API verifies the token and returns user data including points
              and fluidLocker info
            </li>
          </ol>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Note:</h3>
          <p className="text-yellow-700 text-sm">
            This currently returns mock data. The TODO items in the API include:
            implementing real Stack points integration, actual fluidLocker
            logic, and proper Stack signed data generation.
          </p>
        </div>
      </div>
    </div>
  );
}
