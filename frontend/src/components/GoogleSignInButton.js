/* src/components/GoogleSignInButton.js */

/* 
    KEEPING PREVIOUS COMMENTS (EXAMPLE):
    Old approach was using "window.google.accounts.id" for a popup sign-in.
    This sometimes led to slow popups and AbortErrors if the user closed it.

    Now, we switch to a simpler redirect-based approach. We do not remove these 
    old comments, just comment out the old code so you can reference it later.
    */

    'use client';
    import { useRouter } from 'next/navigation';
    import { useEffect } from 'react';

    export default function GoogleSignInButton({
    children,
    // user,           // old approach used user
    nextUrl = '/dashboard',
    // onLoginSuccess, // old approach used onLoginSuccess
    }) {
    const router = useRouter();
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    // --------------------------------------------
    // Old popup-based approach (commented out)
    // --------------------------------------------
    /*
    useEffect(() => {
        if (typeof window !== 'undefined') {
        window.handleGoogleCredentialResponse = async (response) => {
            // ... old logic
        };
        if (window.google?.accounts?.id) {
            window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            callback: (res) => window.handleGoogleCredentialResponse(res),
            });
            // setGoogleReady(true);
        }
        }
    }, [API_URL, nextUrl, onLoginSuccess, router]);
    
    const handleClickOld = async () => {
        if (user) {
        // if already logged in...
        router.push(nextUrl);
        } else {
        if (googleReady && window.google?.accounts?.id) {
            window.google.accounts.id.prompt();
        }
        }
    };
    */

    // --------------------------------------------
    // NEW: Redirect Flow
    // --------------------------------------------
    const handleClick = () => {
        // Simply redirect to /login/google (FastAPI route)
        // That route will redirect to Google’s OAuth page.
        window.location.href = `${API_URL}/login/google`;
    };

    return (
        <button
        onClick={handleClick}
        className="bg-primary text-white px-6 py-3 rounded-md font-semibold shadow hover:bg-secondary transition"
        >
        {children}
        </button>
    );
}
