/* frontend/src/components/AppLayout.js */

'use client';

import Navbar from './Navbar';
import Footer from './Footer';

export default function AppLayout({ children }) {
    return (
        <>
            <Navbar />
            <main className="flex-grow">{children}</main>
            <Footer />
        </>
    );
}
