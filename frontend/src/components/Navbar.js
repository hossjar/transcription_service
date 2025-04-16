/* frontend/src/components/Navbar.js */
'use client';
import Link from 'next/link';
import { useState, useEffect, useContext } from 'react';
import Image from 'next/image';
import LanguageContext from '../context/LanguageContext';
import GoogleSignInButton from './GoogleSignInButton';

export default function Navbar() {
  // State management for user data and mobile menu
    const [user, setUser] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    
    // Environment and context setup
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    const { locale, switchLanguage, t } = useContext(LanguageContext);

    // Helper function to check and update user state from localStorage
    const checkLocalStorage = () => {
        const cachedUser = localStorage.getItem('tutty_user');
        if (cachedUser) {
        try {
            const parsed = JSON.parse(cachedUser);
            setUser(parsed);
        } catch (err) {
            console.warn('Corrupted user data in localStorage:', err);
        }
        }
    };

    // Setup effect for user state management and event listeners
    useEffect(() => {
        // Initial state setup
        checkLocalStorage();
        fetchUser();
        
        // Event listener for login state changes
        const handleNavbarRefetch = () => {
        checkLocalStorage();
        fetchUser();
        };
        
        // Add event listener for cross-component communication
        window.addEventListener('navbarRefetch', handleNavbarRefetch);
        
        // Cleanup on component unmount
        return () => {
        window.removeEventListener('navbarRefetch', handleNavbarRefetch);
        };
    }, []);

    // Function to fetch latest user data from the server
    async function fetchUser() {
        try {
        const res = await fetch(`${API_URL}/me`, {
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            setUser(data);
            // Keep localStorage in sync with server data
            localStorage.setItem('tutty_user', JSON.stringify(data));
        } else {
            setUser(null);
            localStorage.removeItem('tutty_user');
        }
        } catch (err) {
        console.error('Error fetching user:', err);
        setUser(null);
        localStorage.removeItem('tutty_user');
        }
    }

    // Handle user logout process
    const handleLogout = async () => {
        try {
        const res = await fetch(`${API_URL}/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        if (res.ok) {
            setUser(null);
            localStorage.removeItem('tutty_user');
            window.location.href = '/';
        } else {
            console.error('Logout failed:', res.statusText);
        }
        } catch (err) {
        console.error('Error logging out:', err);
        }
    };

    // Render user-specific content based on login state
    const renderUserActions = () => {
        if (user) {
        return (
            <>
            <span className="text-gray-700">
                {user.name ? user.name.split(' ')[0] : 'User'}
            </span>
            <button
                onClick={handleLogout}
                className="bg-primary hover:bg-secondary text-white px-3 py-2 rounded-md"
            >
                {t('logout') ?? 'Logout'}
            </button>
            </>
        );
        } else {
        return (
            <GoogleSignInButton
            user={user}
            onLoginSuccess={fetchUser}
            >
            {t('login') ?? 'Sign in by Google'}
            </GoogleSignInButton>
        );
        }
    };

    return (
        <nav className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
            {/* Logo Section */}
            <Link href="/" className="flex items-center text-xl font-bold text-foreground">
            <Image
                src="/images/logo.png"
                alt="Tutty Logo"
                width={36}
                height={36}
                className="mr-2"
            />
            <span className="text-primary">tutty</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-4">
            {/* Language Switcher */}
            <button
                onClick={() => switchLanguage('fa')}
                className={`px-3 py-2 rounded-md hover:bg-gray-100 transition ${
                locale === 'fa' ? 'bg-gray-100' : ''
                }`}
            >
                فارسی
            </button>
            <button
                onClick={() => switchLanguage('en')}
                className={`px-3 py-2 rounded-md hover:bg-gray-100 transition ${
                locale === 'en' ? 'bg-gray-100' : ''
                }`}
            >
                English
            </button>

            {/* Navigation Links for Logged-in Users */}
            {user && (
                <>
                <Link href="/dashboard" className="hover:text-primary transition px-3 py-2">
                    {t('dashboard') ?? 'Dashboard'}
                </Link>
                <Link href="/purchase" className="hover:text-primary transition px-3 py-2">
                    {locale === 'fa' ? 'خرید زمان' : 'Buy Time'}
                </Link>
                </>
            )}

            {/* Admin Panel Link */}
            {user?.is_admin && (
                <Link href="/admin" className="hover:text-primary transition px-3 py-2">
                {t('admin_panel') ?? 'Admin Panel'}
                </Link>
            )}
            </div>

            {/* Desktop User Actions */}
            <div className="hidden md:flex items-center space-x-4">
            {renderUserActions()}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
            <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-foreground focus:outline-none"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor">
                {menuOpen ? (
                    <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                    />
                ) : (
                    <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                    />
                )}
                </svg>
            </button>
            </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {menuOpen && (
            <div className="md:hidden bg-white border-t shadow-sm">
            <div className="px-2 pt-2 pb-3 space-y-1">
                {/* Language Switcher - Mobile */}
                <button
                onClick={() => switchLanguage('fa')}
                className={`block px-3 py-2 rounded-md ${
                    locale === 'fa' ? 'bg-gray-100' : ''
                }`}
                >
                فارسی
                </button>
                <button
                onClick={() => switchLanguage('en')}
                className={`block px-3 py-2 rounded-md ${
                    locale === 'en' ? 'bg-gray-100' : ''
                }`}
                >
                English
                </button>

                {/* Navigation Links - Mobile */}
                {user && (
                <>
                    <Link href="/dashboard" className="block px-3 py-2 rounded-md hover:bg-gray-100">
                    {t('dashboard') ?? 'Dashboard'}
                    </Link>
                    <Link href="/purchase" className="block px-3 py-2 rounded-md hover:bg-gray-100">
                    {locale === 'fa' ? 'خرید زمان' : 'Buy Time'}
                    </Link>
                </>
                )}

                {/* Admin Panel Link - Mobile */}
                {user?.is_admin && (
                <Link
                    href="/admin"
                    className="block px-3 py-2 rounded-md hover:bg-gray-100"
                >
                    {t('admin_panel') ?? 'Admin Panel'}
                </Link>
                )}

                {/* Mobile User Actions */}
                <div className="mt-2">
                {user ? (
                    <>
                    <span className="block px-3 py-2 text-gray-700">
                        {user.name ? user.name.split(' ')[0] : 'User'}
                    </span>
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 bg-primary text-white"
                    >
                        {t('logout') ?? 'Logout'}
                    </button>
                    </>
                ) : (
                    <div className="px-3 py-2">
                    <GoogleSignInButton
                        user={user}
                        onLoginSuccess={fetchUser}
                    >
                        {t('login') ?? 'Sign in by Google'}
                    </GoogleSignInButton>
                    </div>
                )}
                </div>
            </div>
            </div>
        )}
        </nav>
    );
}