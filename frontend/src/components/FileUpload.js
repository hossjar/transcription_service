/* frontend/src/components/FileUpload.js */

'use client';

import { useState, useContext, useEffect } from 'react';
import LanguageContext from '../context/LanguageContext';
import Link from 'next/link';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';

export default function FileUpload({ onUploadComplete }) {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [outputFormat, setOutputFormat] = useState('txt');
    const [language, setLanguage] = useState('fa');
    const [diarize, setDiarize] = useState(false);
    const { t, locale } = useContext(LanguageContext);
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    // Reset progress when component mounts or file changes
    useEffect(() => {
        setProgress(0);
        setMessage('');
    }, [file]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        // Client-side validation
        const allowedExtensions = ['wav', 'mp3', 'mp4', 'm4a', 'flac', 'aac', 'ogg'];
        const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
        const maxSize = 250 * 1024 * 1024; // 250MB

        if (!allowedExtensions.includes(fileExtension)) {
            setMessage(t('unsupported_file_type') || 'Unsupported file type');
            setFile(null);
            return;
        }
        if (selectedFile.size > maxSize) {
            setMessage(t('file_too_large') || 'File size exceeds 250MB limit');
            setFile(null);
            return;
        }

        setFile(selectedFile);
        setMessage('');
    };

    const uploadFile = () => {
        if (!file) {
            setMessage(t('please_select_a_file') || 'Please select a file');
            return;
        }

        setUploading(true);
        setMessage(t('uploading') || 'Uploading...');
        setProgress(0);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/upload`, true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                setProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            setUploading(false);
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                setMessage(t('upload_completed_transcription_in_progress') || 'Upload completed. Transcription in progress...');
                setFile(null);
                setProgress(0);
                onUploadComplete && onUploadComplete();
            } else {
                const data = JSON.parse(xhr.responseText);
                if (data.detail === 'Insufficient transcription time. Please buy more time.') {
                    setMessage(
                        <Link href="/purchase" className="text-primary underline">
                            {t('insufficient_transcription_time') || 'Insufficient transcription time. Please buy more time.'}
                        </Link>
                    );
                } else {
                    setMessage(`${t('upload_failed') || 'Upload failed'}: ${data.detail || 'An error occurred'}`);
                }
                setProgress(0);
            }
        };

        xhr.onerror = () => {
            setUploading(false);
            setMessage(t('upload_failed') || 'Upload failed');
            setProgress(0);
        };

        const formData = new FormData();
        formData.append('file', file);
        formData.append('output_format', outputFormat);
        formData.append('language', language);
        formData.append('tag_audio_events', 'false');
        formData.append('diarize', diarize.toString());

        xhr.send(formData);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        uploadFile();
    };

    return (
        <div
            dir={locale === 'fa' ? 'rtl' : 'ltr'}
            className="bg-white shadow-lg rounded-lg p-6 max-w-4xl mx-auto mt-8 animate-fade-in"
        >
            <div className="flex items-center mb-4">
                <svg
                    className="w-6 h-6 text-primary mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                </svg>
                <h2 className="text-2xl font-bold text-foreground">
                    {t('upload_media') || 'Upload Media'}
                </h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
                {t('media_file_limits') || 'Audio or video files with maximum 4 hours length and 250 MB size'}
            </p>

            <div className="flex items-center justify-center w-full mb-4">
                <label
                    htmlFor="file-upload"
                    className="group flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition"
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ArrowUpTrayIcon className="w-8 h-8 mb-3 text-gray-400 group-hover:text-primary transition" />
                        <p className="mb-2 text-base text-gray-700 font-medium group-hover:text-primary transition">
                            {t('click_to_upload') || 'Click to upload'}
                        </p>
                        <p className="text-sm text-gray-500">
                            {t('or_drag_and_drop') || 'or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500">
                            {t('supported_file_types') || 'Audio or video files (max. 250MB)'}
                        </p>
                    </div>
                    <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".wav,.mp3,.mp4,.m4a,.flac,.aac,.ogg"
                        disabled={uploading}
                    />
                </label>
            </div>

            {file && (
                <p className="text-sm text-gray-600 mb-4">
                    {t('selected_file') || 'Selected file'}: <span className="truncate max-w-[200px] inline-block">{file.name}</span>
                </p>
            )}

            <div className="space-y-4">
                <label className="block text-foreground">
                    {t('language') || 'Language'}
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2"
                        disabled={uploading}
                    >
                        <option value="fa">Persian</option>
                        <option value="en">English</option>
                        <option value="ar">Arabic</option>
                        <option value="tr">Turkish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ur">Urdu</option>
                        <option value="he">Hebrew</option>
                        <option value="es">Spanish</option>
                        <option value="pt">Portuguese</option>
                        <option value="ru">Russian</option>
                        <option value="cmn">Mandarin</option>
                        <option value="ja">Japanese</option>
                        <option value="hi">Hindi</option>
                        <option value="bn">Bengali</option>
                        <option value="id">Indonesian</option>
                        <option value="ko">Korean</option>
                        <option value="it">Italian</option>
                        <option value="nl">Dutch</option>
                        <option value="pl">Polish</option>
                        <option value="uk">Ukrainian</option>
                        <option value="ro">Romanian</option>
                        <option value="sv">Swedish</option>
                        <option value="el">Greek</option>
                        <option value="hu">Hungarian</option>
                        <option value="cs">Czech</option>
                        <option value="th">Thai</option>
                        <option value="ms">Malay</option>
                        <option value="vi">Vietnamese</option>
                        <option value="no">Norwegian</option>
                        <option value="fi">Finnish</option>
                        <option value="bg">Bulgarian</option>
                        <option value="sw">Swahili</option>
                        <option value="et">Estonian</option>
                        <option value="gl">Galician</option>
                        <option value="ga">Irish</option>
                        <option value="ug">Uyghur</option>
                    </select>
                </label>

                <label className="block text-foreground">
                    {t('output_format') || 'Output Format'}
                    <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2"
                        disabled={uploading}
                    >
                        <option value="txt">Text (txt)</option>
                        <option value="srt">SubRip (srt)</option>
                        <option value="json">JSON</option>
                    </select>
                </label>

                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="diarize"
                        checked={diarize}
                        onChange={(e) => setDiarize(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        disabled={uploading}
                    />
                    <label htmlFor="diarize" className="ml-2 text-sm text-foreground">
                        {t('diarize') || 'Diarize (Speaker Identification)'}
                    </label>
                </div>

                <button
                    onClick={handleSubmit}
                    className={`w-full sm:w-auto flex items-center justify-center bg-primary text-white py-2 px-4 rounded-md transition ${
                        uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-secondary'
                    }`}
                    disabled={uploading}
                >
                    {uploading ? (
                        <>
                            <svg
                                className="animate-spin h-5 w-5 mr-3 text-white"
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
                            {t('uploading') || 'Uploading...'}
                        </>
                    ) : (
                        t('upload') || 'Upload'
                    )}
                </button>
            </div>

            {uploading && (
                <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">
                        {t('uploading_progress') || 'Uploading...'} {Math.round(progress)}%
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className="bg-primary h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {message && (
                <p
                    className={`mt-4 text-sm ${
                        typeof message === 'object'
                            ? 'text-red-600'
                            : message.toLowerCase().includes('failed') ||
                              message.toLowerCase().includes('insufficient')
                            ? 'text-red-600'
                            : 'text-green-600'
                    }`}
                >
                    {message}
                </p>
            )}
        </div>
    );
}

// Inline CSS for fade-in animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fade-in {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    .animate-fade-in {
        animation: fade-in 0.5s ease-out;
    }
`;
document.head.appendChild(style);