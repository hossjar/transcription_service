/* frontend/src/app/contact/page.js */

'use client';

import { FaTelegramPlane, FaWhatsapp } from 'react-icons/fa';
import { PhoneIcon } from '@heroicons/react/24/solid';
import { useContext } from 'react';
import LanguageContext from '../../context/LanguageContext';

export default function Contact() {
    const { locale } = useContext(LanguageContext);
    const isRTL = locale === 'fa'; // Adjust based on your locale setup

    // Contact Methods Data
    const contactMethods = [
        {
            id: 'telegram',
            icon: <FaTelegramPlane className="h-6 w-6 text-blue-500" />,
            identifier: '@tootty_ai',
            link: 'https://t.me/tootty_com',
            ariaLabel: 'Telegram',
        },
        {
            id: 'phone_whatsapp',
            icons: [
                <PhoneIcon key="phone" className="h-6 w-6 text-green-500" />,
                <FaWhatsapp key="whatsapp" className="h-6 w-6 text-green-500" />,
            ],
            identifier: '+989335622283',
            links: {
                phone: 'tel:+989335622283',
                whatsapp: 'https://wa.me/989335622283',
            },
            ariaLabel: 'Phone and WhatsApp',
        },
    ];

    return (
        <div className="max-w-2xl mx-auto p-4 mt-20">
            <h1 className="text-3xl font-bold mb-6 text-center">
                {locale === 'fa' ? 'تماس با ما' : 'Contact Us'}
            </h1>

            <div className="space-y-6">
                {contactMethods.map((method) => (
                    <div
                        key={method.id}
                        className={`flex items-center ${
                            isRTL ? 'flex-row-reverse' : 'flex-row'
                        }`}
                    >
                        {method.id === 'phone_whatsapp' ? (
                            <div className="flex items-center space-x-3">
                                {/* Phone Link */}
                                <a
                                    href={method.links.phone}
                                    className="flex items-center space-x-1"
                                    aria-label="Phone"
                                >
                                    {method.icons[0]}
                                </a>
                                {/* WhatsApp Link */}
                                <a
                                    href={method.links.whatsapp}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-1"
                                    aria-label="WhatsApp"
                                >
                                    {method.icons[1]}
                                </a>
                                {/* Phone Number */}
                                <span className="text-lg text-gray-700">
                                    {method.identifier}
                                </span>
                            </div>
                        ) : (
                            <a
                                href={method.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-3"
                                aria-label={method.ariaLabel}
                            >
                                {method.icon}
                                <span className="text-lg text-gray-700">
                                    {method.identifier}
                                </span>
                            </a>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
