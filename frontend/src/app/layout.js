/* frontend/src/app/layout.js */
import './globals.css';
import { LanguageProvider } from '../context/LanguageContext';
import AppLayout from '../components/AppLayout';
import { cookies } from 'next/headers';
import Script from 'next/script';
import { GA_TRACKING_ID } from '../lib/gtag'; // Google Analytics tracking ID

export const metadata = {
  metadataBase: new URL('https://tootty.com'),
  title: 'Tootty AI',
  description: 'Transcribe and convert your media files (audio, video) to text or subtitles seamlessly with Tootty. Supports multiple languages including Persian, English, French, and more.',
  keywords: ['تبدیل صوت به متن','زیرنویس اتوماتیک','پیاده سازی','transcription', 'subtitle generation', 'media transcription', 'audio to text', 'farsi subtitle', 'speech recognition', 'Tootty', 'automatic transcription'],
  icons: '/favicon.ico',
  openGraph: {
    title: 'TooTTy - Advanced Transcription and Subtitle Generation',
    description: 'Automatically transcribe and generate subtitles from your media files. Fast, accurate, and multi-lingual.',
    url: 'https://tootty.com',
    siteName: 'Tootty',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 800,
        height: 600,
        alt: 'Tutty Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tootty - Transcription Service',
    description: 'Transcribe your media files easily with Tootty.',
    images: ['/images/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://tootty.com/',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale');
  const locale = localeCookie?.value || 'fa';

  return (
    <html lang={locale === 'fa' ? 'fa' : 'en'} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <head>
        <meta name="author" content="Tootty Team" />
        <meta name="robots" content="index,follow" />
        <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
        {/* Google Analytics Script */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
          strategy="afterInteractive"
        />

        {/* Initialize Google Analytics */}
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', '${GA_TRACKING_ID}', {
              page_path: window.location.pathname,
            });
          `}
        </Script>
      </head>
      <body className="flex flex-col min-h-screen">
        <LanguageProvider initialLocale={locale}>
          <AppLayout>
            {/* MAIN CONTENT */}
            {children}
          </AppLayout>
        </LanguageProvider>
      </body>
    </html>
  );
}
