// frontend/src/components/admin/UserList.js

'use client';

import { useEffect, useState } from 'react';

export default function UserList({ onSelectUser }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    const fetchUsers = async () => {
        try {
        const res = await fetch(`${API_URL}/admin/users`, {
            credentials: 'include',
        });
        if (!res.ok) {
            throw new Error('Failed to fetch users');
        }
        const data = await res.json();
        setUsers(data);
        setLoading(false);
        } catch (error) {
        console.error('Error fetching users:', error);
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    if (loading) {
        return <p>Loading users...</p>;
    }

    return (
        <div className="bg-white shadow rounded p-4">
        <h2 className="text-2xl font-semibold mb-2">Users</h2>
        <ul className="divide-y divide-gray-200">
            {users.map((user) => (
            <li
                key={user.id}
                className="py-2 cursor-pointer hover:bg-gray-50"
                onClick={() => onSelectUser(user)}
            >
                <div className="flex items-center">
                <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full mr-4" />
                <div>
                    <p className="text-lg font-medium">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                </div>
            </li>
            ))}
        </ul>
        </div>
    );
}
