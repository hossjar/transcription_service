/* frontend/src/components/FileUpload.js */
'use client';

import { useState, useContext } from 'react';
import LanguageContext from '../context/LanguageContext';
import Link from 'next/link'; 

export default function FileUpload({ onUploadComplete }) {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    const [outputFormat, setOutputFormat] = useState('txt');
    const [language, setLanguage] = useState('fa');

    // --------------------------------------------------------------------------
    // NEW: Add a "diarization" state to let the user select "none", "speaker", or "channel".
    // --------------------------------------------------------------------------
    const [diarization, setDiarization] = useState('none');

    const { t } = useContext(LanguageContext);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setMessage('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file) {
            setMessage(t('please_select_a_file') || 'Please select a file'); // Ensure this key exists in localization files
            return;
        }

        setUploading(true);
        setMessage(t('uploading') || 'Uploading...');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('output_format', outputFormat);
        formData.append('language', language);

        // ----------------------------------------------------------------------
        // NEW: Pass the diarization choice from the user to the backend.
        // ----------------------------------------------------------------------
        formData.append('diarization', diarization);

        try {
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            setUploading(false);

            if (res.ok) {
                setMessage(t('upload_completed_transcription_in_progress') || 'Upload completed. Transcription in progress...');
                setFile(null);
                onUploadComplete && onUploadComplete();
            } else {
                const data = await res.json();
                if (data.detail === 'Insufficient transcription time. Please buy more time.') {
                    // Set message as a localized link to /purchase
                    setMessage(
                        <Link href="/purchase" className="text-primary underline">
                            {t('insufficient_transcription_time')}
                        </Link>
                    );
                } else {
                    setMessage(`${t('upload_failed') || 'Upload failed'}: ${data.detail || 'An error occurred'}`);
                }
            }
        } catch (err) {
            console.error('Error during upload:', err);
            setUploading(false);
            setMessage(`${t('upload_failed') || 'Upload failed'}: ${err.message || 'An error occurred'}`);
        }
    };

    return (
        <div className="p-4 bg-white border rounded-md mt-8 shadow-sm">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-foreground">
                {t('upload_file') || 'Upload File'}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                <input
                    type="file"
                    accept=".wav,.mp3,.mp4,.m4a,.flac,.aac,.ogg"
                    onChange={handleFileChange}
                    className="border p-2 rounded-md"
                    disabled={uploading}
                />

                <label className="flex flex-col text-foreground">
                    {t('output_format') || 'Output Format'}
                    <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="border p-2 rounded-md mt-1"
                    >
                        <option value="txt">Text (txt)</option>
                        <option value="srt">SubRip (srt)</option>
                        <option value="json">JSON</option>
                    </select>
                </label>

                <label className="flex flex-col text-foreground">
                    {t('language') || 'Language'}
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="border p-2 rounded-md mt-1"
                    >
                        <option value="auto">Automatic</option>
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

                {/*
                    NEW: Diarization Dropdown 
                    "none" (default), "speaker", "channel"
                */}
                <label className="flex flex-col text-foreground">
                    {t('diarization') || 'Diarization'}
                    <select
                        value={diarization}
                        onChange={(e) => setDiarization(e.target.value)}
                        className="border p-2 rounded-md mt-1"
                    >
                        <option value="none">{t('no_diarization') || 'None'}</option>
                        <option value="speaker">{t('speaker_diarization') || 'Speaker'}</option>
                        <option value="channel">{t('channel_diarization') || 'Channel'}</option>
                    </select>
                </label>

                <button
                    type="submit"
                    className={`bg-primary text-white py-2 px-4 rounded-md ${
                        uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-secondary'
                    }`}
                    disabled={uploading}
                >
                    {uploading ? (t('uploading') || 'Uploading...') : (t('upload') || 'Upload')}
                </button>
            </form>
            {message && (
                <p
                    className={`mt-4 ${
                        typeof message === 'object' ? 'text-red-600' : (
                            message.toLowerCase().includes('failed') ||
                            message.toLowerCase().includes('insufficient')
                                ? 'text-red-600'
                                : 'text-green-600'
                        )
                    }`}
                >
                    {message}
                </p>
            )}
        </div>
    );
}