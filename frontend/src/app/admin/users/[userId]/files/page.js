/* frontend/src/app/admin/users/[userId]/files/page.js */
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function UserFiles() {
    const router = useRouter();
    const { userId } = useParams();

    const [user, setUser] = useState(null);
    const [files, setFiles] = useState([]);
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
                fetchUserFiles();
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

    const fetchUserFiles = async () => {
        try {
        const res = await fetch(`${API_URL}/admin/users/${userId}/files`, {
            credentials: 'include',
        });
        if (res.ok) {
            const data = await res.json();
            setFiles(data);
        } else {
            const errData = await res.json();
            setError(`Error: ${errData.detail}`);
        }
        } catch (err) {
        console.error('Error fetching user files:', err);
        setError('An error occurred while fetching user files.');
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
        <h1 className="text-2xl font-bold mb-4">User {userId} Files</h1>
        {files.length > 0 ? (
            <ul>
            {files.map((file) => (
                <li key={file.id} className="border-b py-4">
                <p>
                    <strong>Filename:</strong> {file.filename}
                </p>
                <p>
                    <strong>Status:</strong> {file.status}
                </p>
                <p>
                    <strong>Uploaded At:</strong>{' '}
                    {new Date(file.upload_time).toLocaleString()}
                </p>
                {file.transcription && (
                    <div>
                    <p>
                        <strong>Transcription:</strong>
                    </p>
                    <div className="max-h-64 overflow-y-auto border p-2">
                        <p>{file.transcription}</p>
                    </div>
                    </div>
                )}
                </li>
            ))}
            </ul>
        ) : (
            <p>No files found for this user.</p>
        )}
        </div>
    );
}
