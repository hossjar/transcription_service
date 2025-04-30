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
            id: 'phone_whatsapp_telegram',
            label: locale === 'fa' ? 'تماس' : 'Contact',
            identifier: '09335622283',
            icons: [
                <PhoneIcon key="phone" className="h-6 w-6 text-green-500" />,
                <FaWhatsapp key="whatsapp" className="h-6 w-6 text-green-500" />,
                <FaTelegramPlane key="telegram" className="h-6 w-6 text-blue-500" />,
            ],
            links: [
                'tel:+989335622283',
                'https://wa.me/989335622293',
                'https://t.me/tootty_com',
            ],
            ariaLabels: ['Phone', 'WhatsApp', 'Telegram'],
        },
    ];

    return (
        <div className="max-w-2xl mx-auto p-4 mt-20">
            <h1 className="text-3xl font-bold mb-6 text-center">
                {locale === 'fa' ? 'تماس با ما' : 'Contact Us'}
            </h1>

            <div className="space-y-6">
                {contactMethods.map((method) => (
                    <div key={method.id} className="text-center mb-4">
                        <p className="text-center" dir="auto">
                            <span className="font-bold">{method.label}</span> {method.identifier}
                        </p>
                        <div className="flex justify-center space-x-4 mt-2">
                            {method.icons.map((icon, index) => (
                                <a
                                    key={index}
                                    href={method.links[index]}
                                    {...(method.links[index].startsWith('http')
                                        ? { target: '_blank', rel: 'noopener noreferrer' }
                                        : {})}
                                    aria-label={method.ariaLabels[index]}
                                    className="hover:scale-110 transition-transform"
                                >
                                    {icon}
                                </a>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}