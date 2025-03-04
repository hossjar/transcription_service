/* frontend/src/app/admin/users/[userId]/activities/page.js */
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function UserActivities() {
    const router = useRouter();
    const { userId } = useParams();

    const [user, setUser] = useState(null);
    const [activities, setActivities] = useState([]);
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
                fetchUserActivities();
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

    const fetchUserActivities = async () => {
        try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/activities`, {
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            setActivities(data);
        } else {
            const errData = await res.json();
            setError(`Error: ${errData.detail}`);
        }
        } catch (err) {
        console.error('Error fetching user activities:', err);
        setError('An error occurred while fetching user activities.');
        }
    };

    if (error) {
        return <div className="text-red-500 p-4">{error}</div>;
    }

    if (!user) {
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
        <h1 className="text-2xl font-bold mb-4">User {userId} Activities</h1>
        {activities.length > 0 ? (
            <ul>
            {activities.map((activity) => (
                <li key={activity.id} className="border-b py-4">
                <p>
                    <strong>Type:</strong> {activity.activity_type}
                </p>
                <p>
                    <strong>Timestamp:</strong>{' '}
                    {new Date(activity.timestamp).toLocaleString()}
                </p>
                <p>
                    <strong>Details:</strong> {activity.details}
                </p>
                </li>
            ))}
            </ul>
        ) : (
            <p>No activities found for this user.</p>
        )}
        </div>
    );
}
