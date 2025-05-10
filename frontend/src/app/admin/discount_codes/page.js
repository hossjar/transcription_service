/* frontend/src/app/admin/discount_codes/page.js */
'use client';

import { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import LanguageContext from '../../../context/LanguageContext';

export default function DiscountCodes() {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [discountCodes, setDiscountCodes] = useState([]);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentCode, setCurrentCode] = useState(null); // For editing
    const [formData, setFormData] = useState({
        code: '',
        discount_percent: 0,
        max_discount_amount: 0,
        total_usage_limit: 0,
        expiration_date: '',
        is_active: true,
    });

    const router = useRouter();
    const { t, locale } = useContext(LanguageContext);
    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch(`${API_URL}/me`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data);
                    if (data.is_admin) {
                        setIsAdmin(true);
                        fetchDiscountCodes();
                    } else {
                        setError(t('not_authorized'));
                    }
                } else {
                    setError(t('login_required'));
                }
            } catch (err) {
                console.error('Error fetching user:', err);
                setError(t('error_fetching_user'));
            }
        };
        fetchUser();
    }, []);

    const fetchDiscountCodes = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/discount_codes`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setDiscountCodes(data);
            } else {
                throw new Error('Failed to fetch discount codes.');
            }
        } catch (err) {
            console.error('Error fetching discount codes:', err);
            setError(t('error_fetching_discount_codes'));
        }
    };

    const openModal = (code = null) => {
        setCurrentCode(code);
        if (code) {
            setFormData({
                code: code.code,
                discount_percent: code.discount_percent,
                max_discount_amount: code.max_discount_amount,
                total_usage_limit: code.total_usage_limit,
                expiration_date: code.expiration_date.split('T')[0], // Format for input type="date"
                is_active: code.is_active,
            });
        } else {
            setFormData({
                code: '',
                discount_percent: 0,
                max_discount_amount: 0,
                total_usage_limit: 0,
                expiration_date: '',
                is_active: true,
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentCode(null);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = currentCode
                ? `${API_URL}/admin/discount_codes/${currentCode.id}`
                : `${API_URL}/admin/discount_codes`;
            const method = currentCode ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                fetchDiscountCodes();
                closeModal();
            } else {
                const errData = await res.json();
                setError(errData.detail || t('error_saving_discount_code'));
            }
        } catch (err) {
            console.error('Error saving discount code:', err);
            setError(t('error_saving_discount_code'));
        }
    };

    const deleteDiscountCode = async (codeId) => {
        if (confirm(t('confirm_delete'))) {
            try {
                const res = await fetch(`${API_URL}/admin/discount_codes/${codeId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });
                if (res.ok) {
                    fetchDiscountCodes();
                } else {
                    const errData = await res.json();
                    setError(errData.detail || t('error_deleting_discount_code'));
                }
            } catch (err) {
                console.error('Error deleting discount code:', err);
                setError(t('error_deleting_discount_code'));
            }
        }
    };

    if (error) {
        return <div className="text-red-500 p-4">{error}</div>;
    }

    if (!user || !isAdmin) {
        return <div className="p-4">{t('loading')}</div>;
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">{t('discount_codes')}</h1>
            <button
                onClick={() => openModal()}
                className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
            >
                {t('create_new_code')}
            </button>
            <table className="table-auto w-full mb-4">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="px-4 py-2">{t('code')}</th>
                        <th className="px-4 py-2">{t('discount_percent')}</th>
                        <th className="px-4 py-2">{t('max_discount_amount')}</th>
                        <th className="px-4 py-2">{t('total_usage_limit')}</th>
                        <th className="px-4 py-2">{t('expiration_date')}</th>
                        <th className="px-4 py-2">{t('is_active')}</th>
                        <th className="px-4 py-2">{t('actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {discountCodes.map((code) => (
                        <tr key={code.id} className="border-b">
                            <td className="px-4 py-2">{code.code}</td>
                            <td className="px-4 py-2">{code.discount_percent}%</td>
                            <td className="px-4 py-2">{code.max_discount_amount} {t('toman')}</td>
                            <td className="px-4 py-2">{code.total_usage_limit}</td>
                            <td className="px-4 py-2">{new Date(code.expiration_date).toLocaleDateString()}</td>
                            <td className="px-4 py-2">{code.is_active ? t('yes') : t('no')}</td>
                            <td className="px-4 py-2">
                                <button
                                    onClick={() => openModal(code)}
                                    className="bg-yellow-500 text-white px-2 py-1 rounded mr-2"
                                >
                                    {t('edit')}
                                </button>
                                <button
                                    onClick={() => deleteDiscountCode(code.id)}
                                    className="bg-red-500 text-white px-2 py-1 rounded"
                                >
                                    {t('delete')}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {isModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
                    <div className="bg-white p-6 rounded shadow-lg w-1/2">
                        <h2 className="text-xl font-bold mb-4">
                            {currentCode ? t('edit_code') : t('create_new_code')}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700">{t('code')}</label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                    className="border border-gray-300 rounded-md w-full p-2"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700">{t('discount_percent')}</label>
                                <input
                                    type="number"
                                    name="discount_percent"
                                    value={formData.discount_percent}
                                    onChange={handleInputChange}
                                    className="border border-gray-300 rounded-md w-full p-2"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700">{t('max_discount_amount')}</label>
                                <input
                                    type="number"
                                    name="max_discount_amount"
                                    value={formData.max_discount_amount}
                                    onChange={handleInputChange}
                                    className="border border-gray-300 rounded-md w-full p-2"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700">{t('total_usage_limit')}</label>
                                <input
                                    type="number"
                                    name="total_usage_limit"
                                    value={formData.total_usage_limit}
                                    onChange={handleInputChange}
                                    className="border border-gray-300 rounded-md w-full p-2"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700">{t('expiration_date')}</label>
                                <input
                                    type="date"
                                    name="expiration_date"
                                    value={formData.expiration_date}
                                    onChange={handleInputChange}
                                    className="border border-gray-300 rounded-md w-full p-2"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700">{t('is_active')}</label>
                                <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={handleInputChange}
                                    className="mr-2"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="bg-gray-500 text-white px-4 py-2 rounded mr-2"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="bg-blue-500 text-white px-4 py-2 rounded"
                                >
                                    {t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}