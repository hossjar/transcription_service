'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPanel() {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [users, setUsers] = useState([]);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    const usersPerPage = 10;

    useEffect(() => {
        // Fetch the current user data
        const fetchUser = async () => {
            try {
                const res = await fetch(`${API_URL}/me`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data);
                    if (data.is_admin) {
                        setIsAdmin(true);
                        fetchUsers();
                    } else {
                        setError('You are not authorized to access this page.');
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

    const fetchUsers = async (page = currentPage) => {
        try {
            setLoading(true);
            const skip = (page - 1) * usersPerPage;
            const res = await fetch(`${API_URL}/admin/users?limit=${usersPerPage}&skip=${skip}`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users);
                setTotalUsers(data.total);
            } else {
                throw new Error('Failed to fetch users.');
            }
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('An error occurred while fetching users.');
        } finally {
            setLoading(false);
        }
    };

    const updateUserTime = async (userId) => {
        const amountStr = prompt('Enter amount in minutes to add (positive) or reduce (negative):');
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) {
            alert('Invalid amount');
            return;
        }
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}/time`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount }),
            });
            if (res.ok) {
                const data = await res.json();
                alert(`User ${userId} new remaining time: ${Math.floor(data.new_remaining_time)} minutes`);
                fetchUsers(currentPage);
            } else {
                const errData = await res.json();
                alert(`Error: ${errData.detail || 'An error occurred'}`);
            }
        } catch (err) {
            console.error('Error updating user time:', err);
            alert('An error occurred while updating user time.');
        }
    };

    const viewUserFiles = (userId) => {
        router.push(`/admin/users/${userId}/files`);
    };

    const viewUserActivities = (userId) => {
        router.push(`/admin/users/${userId}/activities`);
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > Math.ceil(totalUsers / usersPerPage)) return;
        setCurrentPage(newPage);
        fetchUsers(newPage);
    };

    if (error) {
        return <div className="text-red-500 p-4">{error}</div>;
    }

    if (!user || !isAdmin) {
        return <div className="p-4">Loading...</div>;
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
            
            {/* Admin Navigation Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
                <button
                    onClick={() => router.push('/admin/discount_codes')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow-md transition-all duration-200 flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Manage Discount Codes
                </button>
            </div>
            
            {loading ? (
                <p>Loading users...</p>
            ) : (
                <table className="table-auto w-full mb-4">
                    <thead>
                        <tr className="bg-gray-200">
                            <th className="px-4 py-2">ID</th>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">Name</th>
                            <th className="px-4 py-2">Remaining Time</th>
                            <th className="px-4 py-2">Expiration Date</th>
                            <th className="px-4 py-2">Successful Jobs</th>
                            <th className="px-4 py-2">Unsuccessful Jobs</th>
                            <th className="px-4 py-2">Total Transcription Duration</th>
                            <th className="px-4 py-2">Last Login</th>
                            <th className="px-4 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((userItem) => (
                            <tr key={userItem.id} className="border-b">
                                <td className="px-4 py-2">{userItem.id}</td>
                                <td className="px-4 py-2">{userItem.email}</td>
                                <td className="px-4 py-2">{userItem.name}</td>
                                <td className="px-4 py-2">{Math.floor(userItem.remaining_time)} minutes</td>
                                <td className="px-4 py-2">
                                    {userItem.expiration_date
                                        ? new Date(userItem.expiration_date).toLocaleDateString()
                                        : 'N/A'}
                                </td>
                                <td className="px-4 py-2">{userItem.successful_jobs}</td>
                                <td className="px-4 py-2">{userItem.failed_jobs}</td>
                                <td className="px-4 py-2">{Math.floor(userItem.total_used_time)} minutes</td>
                                <td className="px-4 py-2">
                                    {userItem.last_login ? new Date(userItem.last_login).toLocaleString() : 'Never'}
                                </td>
                                <td className="px-4 py-2">
                                    <button
                                        onClick={() => viewUserFiles(userItem.id)}
                                        className="bg-blue-500 text-white px-2 py-1 rounded mr-2"
                                    >
                                        View Files
                                    </button>
                                    <button
                                        onClick={() => viewUserActivities(userItem.id)}
                                        className="bg-green-500 text-white px-2 py-1 rounded mr-2"
                                    >
                                        View Activities
                                    </button>
                                    <button
                                        onClick={() => updateUserTime(userItem.id)}
                                        className="bg-yellow-500 text-white px-2 py-1 rounded"
                                    >
                                        Update Time
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <div className="flex justify-center items-center mt-6 space-x-4">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`py-2 px-4 rounded ${
                        currentPage === 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 text-white'
                    }`}
                >
                    Previous
                </button>
                <span>
                    Page {currentPage} of {Math.ceil(totalUsers / usersPerPage)}
                </span>
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === Math.ceil(totalUsers / usersPerPage)}
                    className={`py-2 px-4 rounded ${
                        currentPage === Math.ceil(totalUsers / usersPerPage)
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-blue-500 text-white'
                    }`}
                >
                    Next
                </button>
            </div>
        </div>
    );
}