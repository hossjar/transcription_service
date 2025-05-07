'use client';

import { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from '../../components/FileUpload';
import useSSE from '../hooks/useSSE';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import LanguageContext from '../../context/LanguageContext';
import Link from 'next/link';
import ParrotLoader from '../../components/ParrotLoader';
import DevLogin from '../../components/DevLogin';

export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [files, setFiles] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalFiles, setTotalFiles] = useState(0);
    const [filesPerPage] = useState(10);
    const [isLoaderVisible, setIsLoaderVisible] = useState(true);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expandedTranscriptions, setExpandedTranscriptions] = useState({});
    const [expandedSummaries, setExpandedSummaries] = useState({});
    const [summarizingFiles, setSummarizingFiles] = useState({});
    const [shortTranscriptions, setShortTranscriptions] = useState({});
    const { t } = useContext(LanguageContext);
    const router = useRouter();
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    const MIN_WORDS_FOR_SUMMARY = 350;

    useEffect(() => {
        const minLoaderTime = 3000;
        const timer = setTimeout(() => {
            setIsLoaderVisible(false);
        }, minLoaderTime);

        fetch(`${API_URL}/me`, { credentials: 'include' })
            .then(res => {
                if (res.ok) {
                    return res.json().then(data => {
                        setUser(data);
                        localStorage.setItem('tutty_user', JSON.stringify(data));
                        setIsDataLoaded(true);
                    });
                } else {
                    setUser(null);
                    localStorage.removeItem('tutty_user');
                    setIsDataLoaded(true);
                }
            })
            .catch(err => {
                console.error('Error fetching user:', err);
                setUser(null);
                localStorage.removeItem('tutty_user');
                setIsDataLoaded(true);
            });

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (user) {
            fetchFiles(currentPage);
        }
    }, [user, currentPage]);

    const { reconnect } = useSSE((data) => {
        console.log('SSE message received:', data);
        setFiles((prevFiles) => {
            const fileExists = prevFiles.some((f) => f.id === data.file_id);
            if (fileExists) {
                return prevFiles.map((file) =>
                    file.id === data.file_id
                        ? { ...file, status: data.status, message: data.message, transcription: data.transcription || file.transcription }
                        : file
                );
            } else {
                fetchFiles(currentPage);
                return prevFiles;
            }
        });
        if (data.status === 'transcribed' || data.status === 'error') {
            fetchUser();
        }
    });

    async function fetchUser() {
        try {
            const res = await fetch(`${API_URL}/me`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
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
            console.error('Error fetching files:', err);
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
            console.error('Error deleting file:', err);
        }
    };

    const handleDownload = (file, type) => {
        const text = type === 'summary' ? file.summary : file.transcription;
        if (!text) return;
        const extension = file.output_format === 'srt' ? 'srt' : 'txt';
        const bom = '\uFEFF';
        const blob = new Blob([bom + text], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.download = `${file.filename}_${type}.${extension}`;
        link.href = window.URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
    };

    const handleCopy = async (text) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            alert(t('copied_to_clipboard') || 'Text copied to clipboard!');
        } catch (err) {
            alert(t('copy_failed') || 'Failed to copy text.');
        }
    };

    const toggleTranscription = (fileId) => {
        setExpandedTranscriptions((prev) => ({
            ...prev,
            [fileId]: !prev[fileId],
        }));
    };

    const toggleSummary = (fileId) => {
        setExpandedSummaries((prev) => ({
            ...prev,
            [fileId]: !prev[fileId],
        }));
    };

    const countWords = (text) => {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    };

    const generateSummary = async (fileId) => {
        const file = files.find(f => f.id === fileId);
        if (!file || !file.transcription) return;
        
        const wordCount = countWords(file.transcription);
        
        if (wordCount < MIN_WORDS_FOR_SUMMARY) {
            setShortTranscriptions(prev => ({ ...prev, [fileId]: true }));
            setTimeout(() => {
                setShortTranscriptions(prev => ({ ...prev, [fileId]: false }));
            }, 5000);
            return;
        }
        
        try {
            setSummarizingFiles((prev) => ({ ...prev, [fileId]: true }));
            const res = await fetch(`${API_URL}/files/${fileId}/summarize`, {
                method: 'POST',
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setFiles((prevFiles) =>
                    prevFiles.map((file) =>
                        file.id === fileId ? { ...file, summary: data.summary } : file
                    )
                );
                setExpandedSummaries((prev) => ({ ...prev, [fileId]: true }));
            } else {
                alert(t('summary_failed') || 'Failed to generate summary');
            }
        } catch (err) {
            console.error('Error generating summary:', err);
            alert(t('summary_error') || 'Error generating summary');
        } finally {
            setSummarizingFiles((prev) => ({ ...prev, [fileId]: false }));
        }
    };
    
    const totalPages = Math.ceil(totalFiles / filesPerPage);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages) return;
        setCurrentPage(newPage);
    };

    if (isLoaderVisible || !isDataLoaded) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <ParrotLoader />
                <p className="mt-4 text-xl font-semibold">Loading Dashboard</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center mt-20">
                <h1 className="text-4xl font-extrabold mb-4">
                    {t('welcome_to') || 'Welcome to'} <span className="text-primary">Tootty</span>
                </h1>
                <p className="text-lg mb-8">
                    {t('transcribe_media') || 'Transcribe your media files easily and quickly.'}
                </p>
                <a
                    href={`${API_URL}/login`}
                    className="bg-primary hover:bg-secondary text-white py-3 px-6 rounded-md text-lg font-medium"
                >
                    {t('login_with_google') || 'Login with Google'}
                </a>
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-4">
                        <DevLogin />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold mb-2">{t('dashboard')}</h2>
                    <div className="flex flex-col items-start gap-2">
                        <p className="text-lg">
                            <strong>{t('remaining_time')}</strong>{' '}
                            {Math.floor(user.remaining_time)} {t('minutes')}
                        </p>
                        {user.expiration_date && (() => {
                            const exp = new Date(user.expiration_date);
                            const now = new Date();
                            const days = Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
                            if (days > 0) {
                                return (
                                    <p className="text-sm text-gray-500">
                                        {t("days_remaining", { days })}
                                    </p>
                                );
                            }
                        })()}
                        {user.remaining_time === 0 && (
                            <p className="text-red-500 text-sm">
                                {user.expiration_date && new Date(user.expiration_date) < new Date()
                                    ? t('time_expired') || 'Your transcription time has expired. Please buy more time.'
                                    : t('time_used_up') || 'You have used all your transcription time. Please buy more time.'}
                            </p>
                        )}
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
            <FileUpload onUploadComplete={() => fetchFiles(currentPage)} />
            {loading ? (
                <p className="mt-8">{t('loading_files') || 'Loading files...'}</p>
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
                                            {t('uploaded') || 'Uploaded'}: {new Date(file.upload_time).toLocaleString()}
                                        </p>
                                        <p
                                            className={`mt-2 ${file.status === 'transcribed'
                                                ? 'text-green-600'
                                                : file.status === 'error'
                                                ? 'text-red-600'
                                                : 'text-yellow-600'
                                            }`}
                                        >
                                            {t(`status_${file.status.toLowerCase()}`) || `Status: ${file.status}`}
                                        </p>
                                        {file.message && (
                                            <p className="text-sm text-gray-500">{file.message}</p>
                                        )}
                                    </div>
                                    <div className="md:w-1/2 md:flex md:justify-end md:items-center space-x-2 flex-wrap">
                                        {file.transcription && (
                                            <>
                                                <button
                                                    onClick={() => handleDownload(file, 'transcription')}
                                                    className="bg-secondary hover:bg-primary text-white py-1 px-3 rounded-md transition-colors m-1"
                                                >
                                                    {t('download') || 'Download'}
                                                </button>
                                                <button
                                                    onClick={() => handleCopy(file.transcription)}
                                                    className="bg-accent hover:bg-primary text-white py-1 px-3 rounded-md transition-colors m-1"
                                                >
                                                    {t('copy') || 'Copy'}
                                                </button>
                                                <button
                                                    onClick={() => toggleTranscription(file.id)}
                                                    className="bg-gray-500 hover:bg-gray-600 text-white py-1 px-3 rounded-md flex items-center transition-colors m-1"
                                                >
                                                    {expandedTranscriptions[file.id] ? (
                                                        <>
                                                            <EyeSlashIcon className="w-5 h-5 mr-1" />
                                                            {t('hide') || 'Hide'}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <EyeIcon className="w-5 h-5 mr-1" />
                                                            {t('view') || 'View'}
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => handleDelete(file.id)}
                                            className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md transition-colors m-1"
                                        >
                                            {t('delete') || 'Delete'}
                                        </button>
                                        {file.status === 'transcribed' && file.output_format !== 'json' && (
                                            file.summary ? (
                                                <button
                                                    onClick={() => toggleSummary(file.id)}
                                                    className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md flex items-center transition-colors m-1"
                                                >
                                                    {expandedSummaries[file.id] ? (
                                                        <>
                                                            <EyeSlashIcon className="w-5 h-5 mr-1" />
                                                            {t('hide_summary') || 'Hide Summary'}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <EyeIcon className="w-5 h-5 mr-1" />
                                                            {t('view_summary') || 'View Summary'}
                                                        </>
                                                    )}
                                                </button>
                                            ) : summarizingFiles[file.id] ? (
                                                <div className="flex items-center text-gray-500 m-1">
                                                    <svg
                                                        className="animate-spin h-5 w-5 mr-2"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        />
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                        />
                                                    </svg>
                                                    {t('generating_summary') || 'Generating summary...'}
                                                </div>
                                            ) : shortTranscriptions[file.id] ? (
                                                <div className="text-yellow-600 m-1 px-3 py-1 bg-yellow-100 rounded-md">
                                                    {t('transcription_too_short') || 'Transcription too short for summary (min 350 words)'}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => generateSummary(file.id)}
                                                    className="bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-md transition-colors m-1"
                                                >
                                                    {t('summarize') || 'Summarize'}
                                                </button>
                                        ))}
                                    </div>
                                </div>
                                {expandedTranscriptions[file.id] && file.transcription && (
                                    <div
                                        className={`transition-all duration-300 overflow-y-auto ${expandedTranscriptions[file.id] ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'} bg-gray-100 p-4 rounded-md`}
                                    >
                                        <h3 className="font-semibold mb-2">{t('transcription') || 'Transcription'}:</h3>
                                        <p className="whitespace-pre-wrap text-gray-800">
                                            {file.transcription}
                                        </p>
                                    </div>
                                )}
                                {expandedSummaries[file.id] && file.summary && (
                                    <div
                                        className={`transition-all duration-300 overflow-y-auto ${expandedSummaries[file.id] ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'} bg-blue-100 p-4 rounded-md`}
                                    >
                                        <h3 className="font-semibold mb-2">{t('summary') || 'Summary'}:</h3>
                                        <p className="whitespace-pre-wrap text-gray-800">
                                            {file.summary}
                                        </p>
                                        <div className="mt-2 flex space-x-2">
                                            <button
                                                onClick={() => handleDownload(file, 'summary')}
                                                className="bg-secondary hover:bg-primary text-white py-1 px-3 rounded-md transition-colors"
                                            >
                                                {t('download_summary') || 'Download Summary'}
                                            </button>
                                            <button
                                                onClick={() => handleCopy(file.summary)}
                                                className="bg-accent hover:bg-primary text-white py-1 px-3 rounded-md transition-colors"
                                            >
                                                {t('copy_summary') || 'Copy Summary'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center mt-6 space-x-4">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className={`py-2 px-4 rounded-md ${
                                    currentPage === 1 ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary text-white hover:bg-secondary'
                                }`}
                            >
                                {t('previous') || 'Previous'}
                            </button>
                            <span>
                                {t('page_of', { currentPage: currentPage, totalPages: totalPages }) ||
                                    `Page ${currentPage} of ${totalPages}`}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className={`py-2 px-4 rounded-md ${
                                    currentPage === totalPages ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary text-white hover:bg-secondary'
                                }`}
                            >
                                {t('next') || 'Next'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <p className="mt-8">{t('no_files_uploaded') || 'You have not uploaded any files yet.'}</p>
            )}
        </div>
    );
}