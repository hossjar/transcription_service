/* frontend/src/context/LanguageContext.js */
'use client';

import React, { createContext, useState } from 'react';
import Cookies from 'js-cookie';

// Import locale messages synchronously
import enMessages from '../locales/en.json';
import faMessages from '../locales/fa.json';

const LanguageContext = createContext();

export function LanguageProvider({ children, initialLocale }) { // Accept initialLocale as a prop
  // Initialize state with the initialLocale passed from server
    const [locale, setLocale] = useState(initialLocale || 'fa');
    const [messages, setMessages] = useState(
        initialLocale === 'fa' ? faMessages : enMessages
    );

    const switchLanguage = (lang) => {
        setLocale(lang);
        Cookies.set('locale', lang, { expires: 365 }); // Store language preference

        // Update messages based on the selected language
        if (lang === 'fa') {
        setMessages(faMessages);
        } else {
        setMessages(enMessages);
        }
    };

    const t = (key, vars) => {
        let text = messages[key] || key;
        if (vars) {
        Object.keys(vars).forEach((varKey) => {
            text = text.replace(`{{${varKey}}}`, vars[varKey]);
        });
        }
        return text;
    };

    return (
        <LanguageContext.Provider value={{ locale, switchLanguage, t }}>
        {children}
        </LanguageContext.Provider>
    );
}

export default LanguageContext;
