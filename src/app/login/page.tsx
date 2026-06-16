"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Btn, Coin } from '@/components/components';
import { auth, googleProvider, isFirebaseEnabled } from '@/firebase/config';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirectTo') || '/';
  const { account, handleLogin, logout, isHydrated } = useGameContext();

  // Handle redirect result after Google sign-in redirect completes
  useEffect(() => {
    if (!isFirebaseEnabled || !auth) return;
    import('firebase/auth').then(({ getRedirectResult }) => {
      getRedirectResult(auth).then((result) => {
        if (result?.user) {
          // onAuthStateChanged in GameContext handles account mapping
          router.replace(redirectTo);
        }
      }).catch((error: any) => {
        console.error('Redirect result error:', error);
        setErrorMsg(error.message || 'Sign in failed. Please try again.');
      });
    });
  }, []);

  // Auto-redirect to redirect target if already signed in
  useEffect(() => {
    if (isHydrated && account) {
      router.replace(redirectTo);
    }
  }, [isHydrated, account, router, redirectTo]);

  const [showChooser, setShowChooser] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    if (isFirebaseEnabled && auth && googleProvider) {
      setIsLoading(true);
      try {
        const { signInWithRedirect } = await import('firebase/auth');
        // signInWithRedirect navigates the entire page to Google — no popup, no COOP issues
        await signInWithRedirect(auth, googleProvider);
        // Page will navigate away; result is handled by getRedirectResult on mount above
      } catch (error: any) {
        console.error("Google sign in failed:", error);
        setErrorMsg(error.message || "Google sign in failed. Please try again.");
        setIsLoading(false);
      }
    } else {
      // Sandbox Simulator fallback
      setShowChooser(true);
    }
  };

  const handleSelectAccount = (name: string, email: string) => {
    handleLogin({ name, email });
    setShowChooser(false);
    router.push(redirectTo);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customEmail.trim() && customName.trim()) {
      handleSelectAccount(customName.trim(), customEmail.trim());
    }
  };

  const handleCancel = () => {
    router.push('/');
  };

  return (
    <div className="screen center-screen" data-screen-label="Log in">
      <div className="auth auth-google-flow">
        <h2 className="auth-title">Who's laughing?</h2>
        <p className="auth-sub">Sign in to sync your unlocked packs, upgrades, coins, and stats.</p>
        
        {account ? (
          <div className="auth-logged-in-state">
            <div className="auth-logged-in-info">
              <span className="auth-logged-label">Signed in as:</span>
              <span className="auth-logged-name">{account.name}</span>
              <span className="auth-logged-email">{account.email}</span>
              {account.admin && <span className="auth-logged-admin-badge">System Administrator</span>}
            </div>
            <div className="auth-logged-actions">
              <Btn big={true} variant="secondary" className="auth-cta" onClick={logout}>
                Sign Out
              </Btn>
              <button className="linkbtn auth-logged-back" onClick={handleCancel}>
                ← Go back to Home
              </button>
            </div>
          </div>
        ) : (
          <React.Fragment>
            {errorMsg && <div className="auth-error-banner">{errorMsg}</div>}
            
            <div className="auth-btn-container">
              <button className="google-btn" disabled={isLoading} onClick={handleGoogleSignIn}>
                <svg className="google-logo" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.48 3.77v3.13h4.01c2.34-2.16 3.69-5.32 3.69-8.75z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.01-3.13c-1.11.75-2.53 1.19-3.92 1.19-3.02 0-5.58-2.04-6.5-4.78H1.31v3.23A12.01 12.01 0 0 0 12 24z"/>
                  <path fill="#FBBC05" d="M5.5 14.38A7.17 7.17 0 0 1 5 12c0-.82.14-1.63.4-2.38V6.39H1.31A12.01 12.01 0 0 0 0 12c0 2.13.56 4.14 1.31 5.61l4.19-3.23z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.28 2.71 1.31 6.39l4.19 3.23c.92-2.74 3.48-4.78 6.5-4.78z"/>
                </svg>
                <span>{isLoading ? "Signing in..." : "Sign in with Google"}</span>
              </button>
            </div>

            {!isFirebaseEnabled && (
              <div className="firebase-setup-helper">
                <h4>💡 Sandbox Testing Mode</h4>
                <p>
                  Actual Google Authentication is ready to go! To connect your real Firebase project, duplicate <code>.env.local.example</code> to <code>.env.local</code>, populate your key details, and restart the server.
                </p>
              </div>
            )}

            <div className="auth-alt-google">
              <button className="linkbtn" onClick={handleCancel}>Cancel</button>
            </div>
            
            <p className="auth-note">New Google accounts start with <Coin size={13} /> 50 coins on the house.</p>
          </React.Fragment>
        )}
      </div>

      <footer className="landing-footer" style={{ marginTop: '24px', borderTop: 'none', padding: '12px 0' }}>
        <p className="footer-warning">
          By signing in, you confirm you are 18+ and agree to play responsibly.
        </p>
        <div className="footer-links">
          <button className="linkbtn" onClick={() => router.push('/terms')}>Terms of Service</button>
          <span>·</span>
          <button className="linkbtn" onClick={() => router.push('/privacy')}>Privacy Policy</button>
        </div>
      </footer>

      {/* ---------- GOOGLE ACCOUNT CHOOSER SIMULATOR ---------- */}
      {showChooser && (
        <div className="google-chooser-overlay">
          <div className="google-chooser-modal">
            <header className="google-chooser-head">
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.48 3.77v3.13h4.01c2.34-2.16 3.69-5.32 3.69-8.75z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.01-3.13c-1.11.75-2.53 1.19-3.92 1.19-3.02 0-5.58-2.04-6.5-4.78H1.31v3.23A12.01 12.01 0 0 0 12 24z"/>
                <path fill="#FBBC05" d="M5.5 14.38A7.17 7.17 0 0 1 5 12c0-.82.14-1.63.4-2.38V6.39H1.31A12.01 12.01 0 0 0 0 12c0 2.13.56 4.14 1.31 5.61l4.19-3.23z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.28 2.71 1.31 6.39l4.19 3.23c.92-2.74 3.48-4.78 6.5-4.78z"/>
              </svg>
              <h3>Choose an account</h3>
              <p>to continue to <b>Cards Against Humanity</b></p>
            </header>

            {!showCustomForm ? (
              <div className="google-chooser-body">
                <button
                  className="google-account-row google-admin-row"
                  onClick={() => handleSelectAccount("Sidhanshu Monga", "sidhanshumonga28@gmail.com")}
                >
                  <span className="google-account-avatar google-admin-avatar">SM</span>
                  <div className="google-account-details">
                    <span className="google-account-name">Sidhanshu Monga <span className="google-admin-label">Admin</span></span>
                    <span className="google-account-email">sidhanshumonga28@gmail.com</span>
                  </div>
                </button>

                <button
                  className="google-account-row"
                  onClick={() => handleSelectAccount("Alex Rivers", "alex.rivers@gmail.com")}
                >
                  <span className="google-account-avatar">AR</span>
                  <div className="google-account-details">
                    <span className="google-account-name">Alex Rivers</span>
                    <span className="google-account-email">alex.rivers@gmail.com</span>
                  </div>
                </button>

                <button
                  className="google-account-row google-add-account"
                  onClick={() => setShowCustomForm(true)}
                >
                  <span className="google-account-avatar google-add-avatar">+</span>
                  <div className="google-account-details">
                    <span className="google-account-name">Use another account</span>
                    <span className="google-account-email">Sign in with different Google account</span>
                  </div>
                </button>
              </div>
            ) : (
              <form onSubmit={handleCustomSubmit} className="google-custom-form">
                <div className="google-form-row">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    value={customName}
                    placeholder="e.g. Charlie Smith"
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <div className="google-form-row">
                  <label>Google Email address</label>
                  <input
                    type="email"
                    required
                    value={customEmail}
                    placeholder="name@gmail.com"
                    onChange={(e) => setCustomEmail(e.target.value)}
                  />
                </div>
                <div className="google-form-actions">
                  <button type="submit" className="google-form-btn submit">Next</button>
                  <button
                    type="button"
                    className="google-form-btn cancel"
                    onClick={() => { setShowCustomForm(false); setCustomEmail(""); setCustomName(""); }}
                  >
                    Back
                  </button>
                </div>
              </form>
            )}

            <footer className="google-chooser-foot">
              <button className="google-chooser-cancel" onClick={() => setShowChooser(false)}>
                Cancel
              </button>
              <span className="google-terms">
                To continue, Google will share your name, email address, language preference, and profile picture with Cards Against Humanity.
              </span>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="screen center-screen"><div className="waiting-text">Loading...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}
