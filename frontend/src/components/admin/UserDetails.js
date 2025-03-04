// frontend/src/components/admin/UserDetails.js

'use client';

import { useEffect, useState } from 'react';

export default function UserDetails({ user }) {
    const [files, setFiles] = useState([]);
    const [activities, setActivities] = useState([]);
    const [amount, setAmount] = useState(0);
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    const fetchUserFiles = async () => {
        try {
        const res = await fetch(`${API_URL}/admin/users/${user.id}/files`, {
            credentials: 'include',
        });
        if (!res.ok) {
            throw new Error('Failed to fetch user files');
        }
        const data = await res.json();
        setFiles(data);
        setLoadingFiles(false);
        } catch (error) {
        console.error('Error fetching user files:', error);
        setLoadingFiles(false);
        }
    };

    const fetchUserActivities = async () => {
        try {
        const res = await fetch(`${API_URL}/admin/users/${user.id}/activities`, {
            credentials: 'include',
        });
        if (!res.ok) {
            throw new Error('Failed to fetch user activities');
        }
        const data = await res.json();
        setActivities(data);
        setLoadingActivities(false);
        } catch (error) {
        console.error('Error fetching user activities:', error);
        setLoadingActivities(false);
        }
    };

    useEffect(() => {
        fetchUserFiles();
        fetchUserActivities();
    }, [user]);

    const handleUpdateTime = async () => {
        if (isNaN(amount)) {
        alert('Please enter a valid number');
        return;
        }
        try {
        const res = await fetch(`${API_URL}/admin/users/${user.id}/time`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount: parseFloat(amount) }),
        });
        if (!res.ok) {
            throw new Error('Failed to update user time');
        }
        const data = await res.json();
        alert(`User's remaining time updated to ${data.new_remaining_time} seconds`);
        setAmount(0);
        // Optionally, refresh user data
        } catch (error) {
        console.error('Error updating user time:', error);
        alert('Failed to update user time');
        }
    };

    return (
        <div className="bg-white shadow rounded p-4 w-full">
        <h2 className="text-2xl font-semibold mb-2">User Details</h2>
        <div className="flex items-center mb-4">
            <img src={user.picture} alt={user.name} className="w-16 h-16 rounded-full mr-4" />
            <div>
            <p className="text-xl font-medium">{user.name}</p>
            <p className="text-gray-500">{user.email}</p>
            <p className="mt-2">
                <strong>Remaining Time:</strong> {Math.floor(user.remaining_time / 60)} minutes
            </p>
            <p>
                <strong>Total Completed Duration:</strong> {user.total_completed_duration} seconds
            </p>
            </div>
        </div>

        {/* Update Remaining Time */}
        <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2">Update Remaining Time</h3>
            <div className="flex items-center">
            <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter seconds to add/reduce"
                className="border p-2 mr-2 w-64"
            />
            <button
                onClick={handleUpdateTime}
                className="bg-green-500 text-white py-2 px-4 rounded"
            >
                Update Time
            </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
            Enter a positive number to add time or a negative number to reduce time.
            </p>
        </div>

        {/* Uploaded Files */}
        <div className="mb-6">
            <h3 className="text-xl font-semibold mb-2">Uploaded Files</h3>
            {loadingFiles ? (
            <p>Loading files...</p>
            ) : (
            <table className="min-w-full bg-white">
                <thead>
                <tr>
                    <th className="py-2 px-4 border">Filename</th>
                    <th className="py-2 px-4 border">Status</th>
                    <th className="py-2 px-4 border">Uploaded At</th>
                    <th className="py-2 px-4 border">Actions</th>
                </tr>
                </thead>
                <tbody>
                {files.map((file) => (
                    <tr key={file.id}>
                    <td className="py-2 px-4 border">{file.filename}</td>
                    <td className="py-2 px-4 border">{file.status}</td>
                    <td className="py-2 px-4 border">
                        {new Date(file.upload_time).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 border">
                        {/* Implement actions like viewing transcription, deleting, etc. */}
                        <button className="bg-red-500 text-white py-1 px-3 rounded mr-2">
                        Delete
                        </button>
                        {file.transcription && (
                        <a
                            href={`data:text/plain;charset=utf-8,${encodeURIComponent(file.transcription)}`}
                            download={`${file.filename}_transcription.txt`}
                            className="bg-blue-500 text-white py-1 px-3 rounded"
                        >
                            Download
                        </a>
                        )}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            )}
        </div>

        {/* User Activities */}
        <div>
            <h3 className="text-xl font-semibold mb-2">User Activities</h3>
            {loadingActivities ? (
            <p>Loading activities...</p>
            ) : (
            <ul className="divide-y divide-gray-200">
                {activities.map((activity) => (
                <li key={activity.id} className="py-2">
                    <p className="text-sm">
                    <strong>{activity.activity_type.toUpperCase()}</strong> at{' '}
                    {new Date(activity.timestamp).toLocaleString()}
                    </p>
                    {activity.details && <p className="text-gray-600 text-sm">{activity.details}</p>}
                </li>
                ))}
            </ul>
            )}
        </div>
        </div>
    );
}
