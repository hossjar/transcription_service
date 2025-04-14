/* frontend/src/app/page.js */
'use client';

import { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LanguageContext from '../context/LanguageContext';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function Home() {
    const [user, setUser] = useState(null);
    const router = useRouter();
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    const { t } = useContext(LanguageContext);

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async () => {
        try {
            const res = await fetch(`${API_URL}/me`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
            } else {
                setUser(null);
            }
        } catch (err) {
            console.error('Error fetching user:', err);
        }
    };

    // Handler for login success
    const handleLoginSuccess = (userData) => {
        setUser(userData);
    };

    return (
        <div className="max-w-7xl mx-auto py-12 px-4">
            {/* Structured Data for SEO */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        name: "Tootty",
                        url: "https://tootty.com/",
                        description:
                            "Transcribe and convert media files (audio, video) automatically.",
                    }),
                }}
            />

            {/* Hero Section */}
            <section className="text-center mt-16 mb-20">
                <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 text-primary">
                    {t('welcome_message')}
                </h1>
                <p className="text-xl text-gray-700 max-w-2xl mx-auto">
                    {t('transcribe_your_media')}
                </p>
            </section>

            {/* Features Section */}
            <section className="mt-10">
                <h2 className="text-3xl font-bold text-center mb-10 text-foreground">
                    {t('features')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="text-center p-6 rounded-lg bg-white shadow">
                        <Image
                            src="/images/feature1.svg"
                            alt="Accurate Transcriptions"
                            width={80}
                            height={80}
                            className="mx-auto mb-4"
                        />
                        <h3 className="text-lg font-semibold mb-2 text-foreground">
                            {t('accurate_transcribe')}
                        </h3>
                        <p className="text-gray-600">
                            {t('accurate_transcribe_text')}
                        </p>
                    </div>
                    <div className="text-center p-6 rounded-lg bg-white shadow">
                        <Image
                            src="/images/feature2.svg"
                            alt="Multiple Languages"
                            width={80}
                            height={80}
                            className="mx-auto mb-4"
                        />
                        <h3 className="text-lg font-semibold mb-2 text-foreground">
                            {t('multi_language')}
                        </h3>
                        <p className="text-gray-600">{t('multi_language_text')}</p>
                    </div>
                    <div className="text-center p-6 rounded-lg bg-white shadow">
                        <Image
                            src="/images/feature3.svg"
                            alt="Secure & Private"
                            width={80}
                            height={80}
                            className="mx-auto mb-4"
                        />
                        <h3 className="text-lg font-semibold mb-2 text-foreground">
                            {t('detect_speaker')}
                        </h3>
                        <p className="text-gray-600">{t('detect_speaker_text')}</p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="text-center mt-16 mb-20">
                <h2 className="text-3xl font-bold text-primary mb-4">
                    {t('ready_to_get_started')}
                </h2>
                {!user && (
                    <p className="text-lg text-gray-700 mb-6">
                        {t('enjoy_seamless_transcription')}
                    </p>
                )}

                {/* Replace the “needs to be completed” part with the button below */}
                <GoogleSignInButton
                user={user}
                nextUrl="/dashboard"
                onLoginSuccess={handleLoginSuccess} // (optional) update local user state
                >
                    {t('start_here')}
                </GoogleSignInButton>
            </section>
        </div>
    );
}
