// frontend/src/app/sitemap.xml.js

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Normally you would fetch dynamic routes from your database
  // For demonstration, we assume a few static pages and dynamic routes.
    
    const baseUrl = 'https://tutty.ir';
    
    // Static pages
    const pages = [
        '',
        'dashboard',
        'contact',
        'admin' // if admin panel is public or you want it indexed, otherwise omit
    ];
    
    // Construct sitemap entries
    const sitemapEntries = pages.map(page => `
        <url>
        <loc>${baseUrl}/${page}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>${page === '' ? '1.0' : '0.8'}</priority>
        </url>
    `).join('');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset
        xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
    >
        ${sitemapEntries}
    </urlset>`;

    return new NextResponse(sitemap, {
        headers: {
        'Content-Type': 'application/xml',
        },
    });
}
