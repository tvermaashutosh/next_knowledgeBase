"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const redirect = searchParams.get("redirect") || "/";

  const handleGoogleLogin = async () => {
    const supabase = createSupabaseBrowserClient();
    // Store the intended post-login destination in a short-lived cookie.
    // We can't put it in the redirectTo query string because Supabase validates
    // the URL against the allowlist with strict matching (ignores query params).
    document.cookie = `redirect_after_login=${encodeURIComponent(redirect)}; path=/; max-age=300; SameSite=Lax`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo & Branding */}
        <div className="login-header">
          <div className="login-logo">
            <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" rx="20" fill="var(--color-kb-primary)" />
              <text x="50" y="65" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">
                KB
              </text>
            </svg>
          </div>
          <h1>Knowledge Base</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="login-error">
            Authentication failed. Please try again.
          </div>
        )}

        {/* Google Login Button */}
        <button className="google-login-btn" onClick={handleGoogleLogin}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Footer */}
        <div className="login-footer">
          <p>A personal knowledge-base project</p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-bg-primary);
          padding: 1rem;
        }
        .login-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 3rem 2.5rem;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .login-header {
          margin-bottom: 2rem;
        }
        .login-logo {
          display: inline-block;
          margin-bottom: 1rem;
        }
        .login-header h1 {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0 0 0.5rem;
        }
        .login-header p {
          color: var(--color-text-secondary);
          font-size: 0.9rem;
          margin: 0;
        }
        .login-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.85rem;
        }
        .google-login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.875rem;
          border: 1px solid var(--color-border);
          border-radius: 10px;
          background: var(--color-bg-primary);
          color: var(--color-text-primary);
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .google-login-btn:hover {
          background: var(--color-kb-primary);
          color: white;
          border-color: var(--color-kb-primary);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(23, 195, 178, 0.3);
        }
        .login-footer {
          margin-top: 2rem;
        }
        .login-footer p {
          color: var(--color-text-muted);
          font-size: 0.8rem;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--color-bg-primary)" }} />}>
      <LoginContent />
    </Suspense>
  );
}
