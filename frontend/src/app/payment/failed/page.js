/* frontend/src/app/payment/failed/page.js */
"use client";

import { useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import LanguageContext from "../../../context/LanguageContext";

export default function PaymentFailedPage() {
    const router = useRouter();
    const { t } = useContext(LanguageContext);

    // Automatically redirect to /purchase after 5 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
        router.push("/purchase");
        }, 5000);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="max-w-2xl mx-auto p-6 text-center mt-20">
        <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-red-500 mb-4">
            <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            </div>
            <h1 className="text-2xl font-bold mb-4">{t("payment_failed")}</h1>
            <p className="text-gray-600 mb-4">{t("payment_failed_message")}</p>
            
            {/* Automatic redirect notice */}
            <p className="text-sm text-gray-500 mb-6">
            {t("redirecting_to_purchase_in_5_sec") ||
                "Redirecting to Purchase page in 5 seconds..."}
            </p>

            {/* Instant redirect button */}
            <button
            onClick={() => router.push("/purchase")}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
            >
            {t("go_now") || "Go to Purchase Now"}
            </button>
        </div>
        </div>
    );
}
