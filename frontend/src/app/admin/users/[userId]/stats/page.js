/* frontend/src/app/admin/users/[userId]/stats/page.js */
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function UserStats() {
    const router = useRouter();
    const { userId } = useParams();

    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    useEffect(() => {
        const fetchUser = async () => {
        try {
            const res = await fetch(`${API_URL}/me`, {
            credentials: 'include',
            });
            if (res.ok) {
            const data = await res.json();
            setUser(data);
            if (!data.is_admin) {
                setError('You are not authorized to access this page.');
            } else {
                fetchUserStats();
            }
            } else {
            setError('Please log in to access the admin panel.');
            }
        } catch (err) {
            console.error('Error fetching user:', err);
            setError('An error occurred while fetching user data.');
        }
        };
        fetchUser();
    }, []);

    const fetchUserStats = async () => {
        try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/stats`, {
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            setStats(data);
        } else {
            const errData = await res.json();
            setError(`Error: ${errData.detail}`);
        }
        } catch (err) {
        console.error('Error fetching user stats:', err);
        setError('An error occurred while fetching user stats.');
        }
    };

    if (error) {
        return <div className="text-red-500 p-4">{error}</div>;
    }

    if (!user || !stats) {
        return <div className="p-4">Loading...</div>;
    }

    return (
        <div className="p-4">
        <button
            onClick={() => router.back()}
            className="bg-gray-500 text-white px-2 py-1 rounded mb-4"
        >
            Back
        </button>
        <h1 className="text-2xl font-bold mb-4">User {userId} Statistics</h1>
        <p>
            <strong>Total Completed Transcription Duration:</strong>{' '}
            {Math.floor(stats.total_completed_duration / 60)} minutes
        </p>
        </div>
    );
}
