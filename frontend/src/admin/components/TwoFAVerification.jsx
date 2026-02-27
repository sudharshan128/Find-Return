import { useState } from "react";

/**
 * TwoFAVerification Component
 * STEP 2.3: Frontend 2FA Verification (Hidden by Default)
 * 
 * ⚠️ IMPORTANT:
 * - This component is hidden until backend says requires_2fa = true
 * - No changes to AdminAuthContext or OAuth flow
 * - User pastes or types 6-digit code from authenticator app
 * - Auto-submits when 6 digits entered
 * - Handles rate limiting (try again later)
 * - Shows attempt count
 * 
 * @param {Object} props
 * @param {() => void} props.onSuccess - Called when 2FA verification succeeds
 * @param {() => void} props.onCancel - Called when user cancels verification
 */

export function TwoFAVerification({
  onSuccess,
  onCancel,
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(3);
  const [isLocked, setIsLocked] = useState(false);

  /**
   * Handle user typing/pasting code
   * Only allows digits, max 6 characters
   */
  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);

    // Auto-submit when 6 digits entered
    if (value.length === 6) {
      verifyCode(value);
    }
  };

  /**
   * Verify 2FA code with backend
   */
  const verifyCode = async (codeToVerify) => {
    if (isLocked) return;

    try {
      setLoading(true);
      setError(null);

      // Get access token from Supabase session
      const token = localStorage.getItem("supabase.auth.token");
      if (!token) {
        setError("Authentication session lost. Please log in again.");
        onCancel();
        return;
      }

      // Call backend verify-login endpoint
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/2fa/verify-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token: codeToVerify }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (data.code === "RATE_LIMITED") {
          setIsLocked(true);
          setError(
            `Too many failed attempts. Please try again in ${data.retryAfter} seconds.`
          );
          setCode("");
          return;
        }

        if (data.code === "INVALID_CODE") {
          setAttempts(data.attemptsRemaining || 2);
          setError(
            `Invalid code. ${data.attemptsRemaining || 2} attempt${data.attemptsRemaining !== 1 ? "s" : ""} remaining.`
          );
          setCode("");
          return;
        }

        setError(data.error || "Verification failed");
        setCode("");
        return;
      }

      // Success!
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle manual verify button click
   */
  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    await verifyCode(code);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Two-Factor Authentication
          </h1>
          <p className="text-gray-600 mt-2">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        {error && (
          <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="code" className="block text-sm font-medium mb-2 text-gray-700">
            Authenticator Code
          </label>
          <input
            type="text"
            id="code"
            value={code}
            onChange={handleCodeChange}
            placeholder="000000"
            disabled={loading || isLocked}
            maxLength={6}
            inputMode="numeric"
            autoComplete="off"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-mono font-semibold disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            {isLocked
              ? "❌ Account locked. Try again later."
              : `Attempts remaining: ${attempts}`}
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6 || isLocked}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>

          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg font-medium disabled:opacity-50 hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Using Google Authenticator, Authy, or Microsoft Authenticator?
        </p>
      </div>
    </div>
  );
}
