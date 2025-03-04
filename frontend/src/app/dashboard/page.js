/* frontend/src/app/dashboard/page.js */
'use client';

import { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '../../components/FileUpload';
import useSSE from '../hooks/useSSE';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import LanguageContext from '../../context/LanguageContext';
import Link from 'next/link';

export default function Home() {
    const [user, setUser] = useState(null);
    const [files, setFiles] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalFiles, setTotalFiles] = useState(0);
    const [filesPerPage] = useState(10);

    // Tracks whether we’ve done our initial fetch logic
    const [loadingUser, setLoadingUser] = useState(true);

    const [loading, setLoading] = useState(false);
    const [expandedFiles, setExpandedFiles] = useState({});
    const { t } = useContext(LanguageContext);

    const router = useRouter();
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    // ─────────────────────────────────────────────────────────────────────────────
    // NEW CACHING: On first render, try localStorage. Then do a background fetch.
    // ─────────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        // 1) Attempt to load a cached user from localStorage
        const cachedUser = localStorage.getItem('tutty_user');
        if (cachedUser) {
        try {
            const parsed = JSON.parse(cachedUser);
            setUser(parsed);
            setLoadingUser(false); // We have a user from cache, so skip the loading spinner
        } catch (err) {
            // If JSON parse fails, just ignore and do normal fetch
            console.warn('Corrupted user data in localStorage:', err);
        }
        }
        // 2) Always do a background fetch to confirm user validity
        fetchUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // SSE logic (unchanged)
    useEffect(() => {
        if (user) {
        fetchFiles(currentPage);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const { reconnect } = useSSE((data) => {
        setFiles((prevFiles) => {
        const fileExists = prevFiles.some((f) => f.id === data.file_id);
        if (fileExists) {
            return prevFiles.map((file) =>
            file.id === data.file_id
                ? { ...file, status: data.status, message: data.message }
                : file
            );
        } else {
            fetchFiles(currentPage);
            return prevFiles;
        }
        });

        if (data.status === 'transcribed' || data.status === 'error') {
        fetchUser();
        fetchFiles(currentPage);
        }
    });

    async function fetchUser() {
        try {
        const res = await fetch(`${API_URL}/me`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            setUser(data);
            // ─────────────────────────────────────────────────────────────────
            // NEW CACHING: Store the fresh user data in localStorage
            // ─────────────────────────────────────────────────────────────────
            localStorage.setItem('tutty_user', JSON.stringify(data));
        } else {
            setUser(null);
            localStorage.removeItem('tutty_user');
        }
        } catch (err) {
        console.error('Error fetching user:', err);
        setUser(null);
        localStorage.removeItem('tutty_user');
        } finally {
        // If no user was found in localStorage, we remain "loading" until now
        setLoadingUser(false);
        }
    }

    async function fetchFiles(page = currentPage) {
        try {
        setLoading(true);
        const offset = (page - 1) * filesPerPage;
        const res = await fetch(
            `${API_URL}/files?limit=${filesPerPage}&offset=${offset}`,
            { credentials: 'include' }
        );
        if (res.ok) {
            const data = await res.json();
            setFiles(data.files);
            setTotalFiles(data.total);
        } else {
            setFiles([]);
        }
        } catch (err) {
        setFiles([]);
        } finally {
        setLoading(false);
        }
    }

    const handleDelete = async (fileId) => {
        try {
        const res = await fetch(`${API_URL}/files/${fileId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (res.ok) {
            fetchFiles(currentPage);
        }
        } catch (err) {
        // Silently handle error
        }
    };

    const handleDownload = (file) => {
        if (!file.transcription) return;
        const extension = file.output_format === 'srt' ? 'srt' : 'txt';
        const blob = new Blob([file.transcription], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.download = `${file.filename}_transcription.${extension}`;
        link.href = window.URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
    };

    const handleCopy = async (transcription) => {
        if (!transcription) return;
        try {
        await navigator.clipboard.writeText(transcription);
        alert('Transcription copied to clipboard!');
        } catch (err) {
        alert('Failed to copy transcription.');
        }
    };

    const toggleTranscription = (fileId) => {
        setExpandedFiles((prev) => ({
        ...prev,
        [fileId]: !prev[fileId],
        }));
    };

    const totalPages = Math.ceil(totalFiles / filesPerPage);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages) return;
        setCurrentPage(newPage);
        fetchFiles(newPage);
    };

    // ───────────────────────────────────────────────────────────────────
    // Show a short "Loading" if we haven't confirmed the user from either
    // localStorage or background fetch. If we got user from localStorage,
    // loadingUser is already false by now.
    // ───────────────────────────────────────────────────────────────────
    if (loadingUser) {
        return (
        <div className="p-4 text-center">
            <p className="text-xl font-semibold">Loading your dashboard...</p>
        </div>
        );
    }

    if (!user) {
        return (
        <div className="text-center mt-20">
            <h1 className="text-4xl font-extrabold mb-4">
            Welcome to <span className="text-primary">Tutty</span>
            </h1>
            <p className="text-lg mb-8">
            Transcribe your media files easily and quickly.
            </p>
            <a
            href={`${API_URL}/login`}
            className="bg-primary hover:bg-secondary text-white py-3 px-6 rounded-md text-lg font-medium"
            >
            Login with Google
            </a>
        </div>
        );
    }

    // If we have a user, show the real dashboard:
    return (
        <div className="max-w-7xl mx-auto p-4">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
            <h2 className="text-2xl font-bold mb-2">{t('dashboard')}</h2>
            <div className="flex items-center gap-4">
                <p className="text-lg">
                <strong>{t('remaining_time')}</strong>{' '}
                {Math.floor(user.remaining_time)} {t('minutes')}
                </p>
                <Link
                href="/purchase"
                className="inline-flex items-center px-4 py-2 bg-primary hover:bg-secondary text-white rounded-md transition-colors"
                >
                {t('buy_more_time')}
                </Link>
            </div>
            </div>
            {user.picture && (
            <img
                src={user.picture}
                alt="Profile"
                className="rounded-full w-16 h-16 mt-4 md:mt-0 object-cover"
            />
            )}
        </div>

        {/* File Upload Component */}
        <FileUpload onUploadComplete={() => fetchFiles(currentPage)} />

        {/* File List */}
        {loading ? (
            <p className="mt-8">Loading files...</p>
        ) : files.length > 0 ? (
            <div>
            <h2 className="text-xl md:text-2xl font-bold mt-8">
                {t('your_files')}
            </h2>
            <ul className="mt-4 space-y-4">
                {files.map((file) => (
                <li
                    key={file.id}
                    className="border rounded-md p-4 flex flex-col space-y-4 bg-white shadow"
                >
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center w-full">
                    <div className="mb-4 md:mb-0 md:w-1/2">
                        <p className="font-medium break-all text-foreground">
                        {file.filename}
                        </p>
                        <p className="text-sm text-gray-500">
                        Uploaded: {new Date(file.upload_time).toLocaleString()}
                        </p>
                        <p
                        className={`mt-2 ${
                            file.status === 'transcribed'
                            ? 'text-green-600'
                            : file.status === 'error'
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}
                        >
                        Status: {file.status}
                        </p>
                        {file.message && (
                        <p className="text-sm text-gray-500">{file.message}</p>
                        )}
                    </div>
                    <div className="md:w-1/2 md:flex md:justify-end md:items-center space-x-2">
                        {file.transcription && (
                        <>
                            <button
                            onClick={() => handleDownload(file)}
                            className="bg-secondary hover:bg-primary text-white py-1 px-3 rounded-md transition-colors"
                            >
                            Download
                            </button>
                            <button
                            onClick={() => handleCopy(file.transcription)}
                            className="bg-accent hover:bg-primary text-white py-1 px-3 rounded-md transition-colors"
                            >
                            Copy
                            </button>
                        </>
                        )}
                        <button
                        onClick={() => handleDelete(file.id)}
                        className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md transition-colors"
                        >
                        Delete
                        </button>

                        {file.transcription && (
                        <button
                            onClick={() => toggleTranscription(file.id)}
                            className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-3 rounded-md flex items-center transition-colors"
                        >
                            {expandedFiles[file.id] ? (
                            <>
                                <EyeSlashIcon className="w-5 h-5 mr-1" />
                                Hide
                            </>
                            ) : (
                            <>
                                <EyeIcon className="w-5 h-5 mr-1" />
                                View
                            </>
                            )}
                        </button>
                        )}
                    </div>
                    </div>

                    {/* Transcription Preview */}
                    {file.transcription && (
                    <div
                        className={`transition-all duration-300 overflow-y-auto ${
                        expandedFiles[file.id]
                            ? 'max-h-96 opacity-100 mt-4'
                            : 'max-h-0 opacity-0'
                        } bg-gray-100 p-4 rounded-md`}
                    >
                        <h3 className="font-semibold mb-2">Transcription:</h3>
                        <p className="whitespace-pre-wrap text-gray-800">
                        {file.transcription}
                        </p>
                    </div>
                    )}
                </li>
                ))}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center mt-6 space-x-4">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`py-2 px-4 rounded-md ${
                    currentPage === 1
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-primary text-white hover:bg-secondary'
                    }`}
                >
                    Previous
                </button>

                <span>
                    Page {currentPage} of {totalPages}
                </span>

                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`py-2 px-4 rounded-md ${
                    currentPage === totalPages
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-primary text-white hover:bg-secondary'
                    }`}
                >
                    Next
                </button>
                </div>
            )}
            </div>
        ) : (
            <p className="mt-8">You have not uploaded any files yet.</p>
        )}
        </div>
    );
}
