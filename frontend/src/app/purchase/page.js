"use client";

import { useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import LanguageContext from "../../context/LanguageContext";

export default function PurchasePage() {
    const [hours, setHours] = useState(1);
    const [price, setPrice] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();
    const { t, locale } = useContext(LanguageContext);
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    // Updated pricing function
    const calculatePrice = (hrs) => {
        if (hrs <= 4) {
            return hrs * 120000;
        } else if (hrs <= 9) {
            return hrs * 100000;
        } else {
            return hrs * 90000;
        }
    };

    function formatNumber(num, currentLocale) {
        const rawString = String(Math.round(num));
        let withCommas = rawString.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        if (currentLocale === "fa") {
            const enToFa = {
                "0": "۰",
                "1": "۱",
                "2": "۲",
                "3": "۳",
                "4": "۴",
                "5": "۵",
                "6": "۶",
                "7": "۷",
                "8": "۸",
                "9": "۹",
            };
            withCommas = withCommas.replace(/[0-9]/g, (d) => enToFa[d]);
        }
        return withCommas;
    }

    useEffect(() => {
        setPrice(calculatePrice(hours));
    }, [hours]);

    const handleDecrement = () => {
        if (hours > 1) {
            setHours((prev) => prev - 1);
        }
    };

    const handleIncrement = () => {
        setHours((prev) => prev + 1);
    };

    const handleHoursChange = (e) => {
        const val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 1) {
            setHours(1);
        } else {
            setHours(val);
        }
    };

    const handlePurchase = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${API_URL}/payment/purchase`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ hours: Number(hours) }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Failed to initiate payment");
            }
            if (data.success && data.payment_url) {
                window.location.href = data.payment_url;
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const finalPrice = Math.round(price * 1.1);
    const isPersian = locale === "fa";

    // Updated pricing plans
    const plans = [
        { key: "basic", price: 120000, hoursKey: "basic_plan_hours" },
        { key: "standard", price: 100000, hoursKey: "standard_plan_hours" },
        { key: "premium", price: 90000, hoursKey: "premium_plan_hours" },
    ];

    return (
        <div className={`max-w-4xl mx-auto px-4 py-8 ${isPersian ? "rtl" : ""}`}>
            {/* Hero / Intro Section */}
            <div className="text-center mb-10">
                <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">
                    {t("purchase_time")}
                </h1>
                <p className="text-gray-700">{t("enjoy_seamless_transcription")}</p>
            </div>

            {/* Pricing Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {plans.map((plan, index) => (
                    <div
                        key={plan.key}
                        className={`bg-white shadow-lg rounded-lg p-6 text-center transition-transform duration-300 hover:scale-105 ${
                            index === 1
                                ? "border-2 border-primary scale-105 relative overflow-hidden"
                                : ""
                        }`}
                    >
                        {index === 1 && (
                            <span className="absolute top-0 left-0 bg-primary text-white text-xs font-bold px-2 py-1 rounded-br-lg">
                                {t("most_popular") || "Most Popular"}
                            </span>
                        )}
                        <h2 className="text-xl font-semibold mb-2 text-foreground">
                            {t(`${plan.key}_plan`)}
                        </h2>
                        <p className="text-gray-500 mb-4">
                            {t(plan.hoursKey)}
                        </p>
                        <p className="text-sm text-gray-600 mb-2">
                            {locale === "fa" ? "در یک ماه" : "for a month"}
                        </p>
                        <p className="text-2xl font-bold text-gray-800 mb-4">
                            {formatNumber(plan.price, locale)}{" "}
                            <span className="text-sm">{t("toman_per_hour")}</span>
                        </p>
                        <p className="text-sm text-gray-500">
                            {locale === "fa" ? "بعلاوه 10% مالیات ارزش افزوده" : "plus 10% VAT"}
                        </p>
                    </div>
                ))}
            </div>

            {/* Contact Message */}
            <div className="text-center mb-8 text-gray-600">
                {locale === 'fa' ? (
                    <p>
                        مشاوره و خرید سازمانی{' '}
                        <a href="tel:09335622293" className="text-primary hover:underline">
                            09335622293
                        </a>
                    </p>
                ) : (
                    <p>
                        for more questions call or WhatsApp{' '}
                        <a href="tel:09335622293" className="text-primary hover:underline">
                            09335622293
                        </a>
                    </p>
                )}
            </div>

            {/* Hours Input with Stepper */}
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4 text-foreground">
                    {t("select_hours")}
                </h2>
                <div className="flex items-center space-x-3 max-w-xs">
                    <button
                        onClick={handleDecrement}
                        className="px-3 py-1 bg-gray-200 rounded text-2xl"
                    >
                        -
                    </button>
                    <input
                        type="number"
                        className="border border-gray-300 rounded-md w-24 p-2 text-center"
                        value={hours}
                        onChange={handleHoursChange}
                        min="1"
                        aria-label={t("select_hours")}
                    />
                    <button
                        onClick={handleIncrement}
                        className="px-3 py-1 bg-gray-200 rounded text-2xl"
                    >
                        +
                    </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                    {t("type_any_hours") || "Enter any number of hours you need"}
                </p>
            </div>

            {/* Payment Summary Section */}
            <div className="bg-white shadow-md rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4">{t("payment_summary")}</h2>
                <div className="flex justify-between mb-2">
                    <span className="text-lg">{t("total_price")}:</span>
                    <span className="text-lg font-semibold text-gray-800">
                        {formatNumber(price, locale)} {t("toman")}
                    </span>
                </div>
                <div className="flex justify-between mb-2">
                    <span className="text-lg">{t("final_price") || "Final Price"}:</span>
                    <span className="text-lg font-semibold text-gray-800">
                        {formatNumber(finalPrice, locale)} {t("toman")}
                    </span>
                </div>
                {error && (
                    <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
                        {error}
                    </div>
                )}
                <button
                    onClick={handlePurchase}
                    disabled={loading}
                    className={`mt-4 w-full md:w-auto inline-block py-3 px-6 rounded-md text-white font-semibold 
                        ${
                            loading
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-primary hover:bg-secondary transition"
                        }`}
                >
                    {loading ? t("processing") : t("proceed_to_payment")}
                </button>
            </div>

            <div className="bg-gray-100 rounded-md p-4 text-sm text-gray-600">
                <p>
                    {t("disclaimer_text") ||
                        "Note: All prices subject to a 10% VAT. Payment is processed via Zarinpal gateway. If you have any questions, contact our support."}
                </p>
            </div>
        </div>
    );
}