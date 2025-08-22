'use client';
import { useRouter } from 'next/navigation';

export default function GoogleSignInButton({
    children,
    nextUrl = '/dashboard',
    className,
}) {
    const router = useRouter();
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    const handleClick = () => {
        window.location.href = `${API_URL}/login/google`;
    };

    return (
        <button
        onClick={handleClick}
        className={className || "bg-primary text-white px-6 py-3 rounded-md font-semibold shadow hover:bg-secondary transition"}
        >
        {children}
        </button>
    );
}
