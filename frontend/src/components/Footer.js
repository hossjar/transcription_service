/* frontend\src\components\Footer.js */
import Link from 'next/link';
import Script from 'next/script';
import { useState, useEffect } from 'react';

export default function Footer() {
    // Whether we should load Enamad script at all
    const [loadEnamad, setLoadEnamad] = useState(false);
    // Whether the script actually finished loading
    const [enamadLoaded, setEnamadLoaded] = useState(false);

    useEffect(() => {
        // Lazy-load the Enamad script a few seconds after the component mounts
        const timer = setTimeout(() => {
        setLoadEnamad(true);
        }, 3000); // Adjust if needed
        return () => clearTimeout(timer);
    }, []);

    return (
        <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto py-6 px-4">
            {/* 
            We divide footer into three horizontal sections
            that stack into columns on small screens (md:flex-row).
            */}
            <div className="flex flex-col md:flex-row items-center">
            
            {/* 1) Left: Copyright & Powered by */}
            <div className="w-full md:w-1/3 flex justify-start items-center">
                <p className="text-sm text-gray-500">
                &copy; {new Date().getFullYear()}{' '}
                <span className="font-semibold text-primary">Tootty</span>.
                {' '}Powered by IRSDN.
                </p>
            </div>

            {/* 2) Center: Contact Link (make it bigger + centered) */}
            <div className="w-full md:w-1/3 flex justify-center my-4 md:my-0">
                <Link
                href="/contact"
                className="text-lg text-gray-600 hover:text-primary font-semibold"
                >
                Contact
                </Link>
            </div>

            {/* 3) Right: Enamad logo (lazy-loaded) */}
            <div className="w-full md:w-1/3 flex justify-end items-center">
                {loadEnamad ? (
                <div id="enamad-root">
                    <Script
                    id="enamad-script"
                    strategy="afterInteractive"
                    onLoad={() => setEnamadLoaded(true)}
                    onError={() => console.warn('Enamad script failed to load.')}
                    >
                    {`
                        var enamadHost = 'https://trustseal.enamad.ir';
                        var enamadParam = '?id=564053&Code=4PjgA4U3yuO3xKhgUj7WfjAcvjjPYsjX';
                        document.getElementById('enamad-root').innerHTML = 
                        '<a target="_blank" href="' + enamadHost + enamadParam + '" ' +
                        'referrerPolicy="origin">' +
                        '<img src="' + enamadHost + '/logo.aspx' + enamadParam + '" ' +
                        'alt="نماد اعتماد الکترونیکی" style="cursor:pointer" ' +
                        'referrerPolicy="origin"/></a>';
                    `}
                    </Script>

                    {!enamadLoaded && (
                    <span className="text-xs text-gray-400">
                        Loading Enamad...
                    </span>
                    )}
                </div>
                ) : (
                <span className="text-xs text-gray-400">
                    Loading...
                </span>
                )}
            </div>

            </div>
        </div>
        </footer>
    );
}