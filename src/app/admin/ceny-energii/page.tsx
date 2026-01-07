/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Upload, FileText, CheckCircle, XCircle, ArrowLeft, Mail } from 'lucide-react';
import Link from 'next/link';

interface UploadStatus {
    status: 'idle' | 'uploading' | 'success' | 'error';
    message?: string;
    count?: number;
}

export default function EnergyPricesAdminPage() {
    const { user, userData, loading: authLoading, getAuthHeaders } = useAuth();
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: 'idle' });
    const [emailStatus, setEmailStatus] = useState<UploadStatus>({ status: 'idle' });

    // Auth guard
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user || userData?.role !== 'admin') {
        router.push('/');
        return null;
    }

    const handleCheckEmail = async (type: 'RDN' | 'FUTURES') => {
        setEmailStatus({ status: 'uploading', message: `Sprawdzanie poczty (${type})...` });
        try {
            const authHeaders = await getAuthHeaders();
            const response = await fetch(`/api/cron/import-email?type=${type}`, {
                headers: {
                    'Authorization': (authHeaders as any).Authorization
                }
            });
            const data = await response.json();

            if (!data.success) throw new Error(data.error || 'Failed to check email');

            const count = data.processed;
            if (count > 0) {
                setEmailStatus({
                    status: 'success',
                    message: `Przetworzono ${count} wiadomości (${type}).`,
                    count: data.details[0]?.processedCount
                });
            } else {
                setEmailStatus({ status: 'success', message: `Brak nowych wiadomości ${type} (CSV).` });
            }
        } catch (error: any) {
            setEmailStatus({ status: 'error', message: error.message });
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setUploadStatus({ status: 'idle' });
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploadStatus({ status: 'uploading', message: 'Uploading...' });

        try {
            const authHeaders = await getAuthHeaders();
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/energy-prices/upload', {
                method: 'POST',
                headers: {
                    'Authorization': (authHeaders as any).Authorization
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setUploadStatus({
                status: 'success',
                message: data.message,
                count: data.count
            });

            // Reset file input
            setFile(null);
        } catch (error: any) {
            setUploadStatus({
                status: 'error',
                message: error.message || 'Upload failed'
            });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
                    <Link
                        href="/admin"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-semibold text-gray-900">
                        Ceny Energii - Panel Admina
                    </h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Upload cen energii
                        </h2>
                        <p className="text-gray-600">
                            Wgraj plik CSV z cenami energii na rynku dnia następnego
                        </p>
                    </div>

                    {/* Format Guide */}
                    <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <FileText size={18} />
                            Format pliku CSV
                        </h3>
                        <div className="text-sm text-blue-800 space-y-1">
                            <p>Wymagane kolumny:</p>
                            <ul className="list-disc list-inside ml-2">
                                <li><code className="bg-blue-100 px-1 rounded">Data</code> - format <strong>YYYY-MM-DD</strong> lub <strong>DD.MM.YYYY</strong></li>
                                <li><code className="bg-blue-100 px-1 rounded">h_num</code> - godzina (1-24)</li>
                                <li><code className="bg-blue-100 px-1 rounded">Average of Cena</code> - cena w PLN/MWh</li>
                                <li><code className="bg-blue-100 px-1 rounded">Wolumen</code> - wolumen (opcjonalne, domyślnie 0)</li>
                            </ul>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Wybierz plik CSV
                        </label>
                        <div className="flex gap-4">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                            <button
                                onClick={handleUpload}
                                disabled={!file || uploadStatus.status === 'uploading'}
                                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Upload size={18} />
                                {uploadStatus.status === 'uploading' ? 'Wysyłanie...' : 'Upload'}
                            </button>
                        </div>
                        {file && (
                            <p className="mt-2 text-sm text-gray-600">
                                Wybrany plik: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                            </p>
                        )}
                    </div>

                    {/* Status Messages */}
                    {uploadStatus.status === 'success' && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                            <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-green-900">Sukces!</p>
                                <p className="text-sm text-green-800">
                                    {uploadStatus.message} ({uploadStatus.count} wpisów)
                                </p>
                            </div>
                        </div>
                    )}

                    {uploadStatus.status === 'error' && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-red-900">Błąd</p>
                                <p className="text-sm text-red-800">{uploadStatus.message}</p>
                            </div>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="mb-8 pt-8 border-t border-gray-200">
                        <h3 className="font-semibold text-gray-900 mb-4">Szybkie akcje</h3>
                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => handleCheckEmail('RDN')}
                                disabled={emailStatus.status === 'uploading'}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <Mail size={18} />
                                Sprawdź Gmail (RDN)
                            </button>

                            <button
                                onClick={() => handleCheckEmail('FUTURES')}
                                disabled={emailStatus.status === 'uploading'}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <Mail size={18} />
                                Sprawdź Gmail (Futures)
                            </button>

                            <button
                                onClick={async () => {
                                    if (!confirm('Czy na pewno chcesz usunąć WSZYSTKIE dane cenowe RDN? Ta operacja jest nieodwracalna!')) return;
                                    try {
                                        const headers = await getAuthHeaders();
                                        const response = await fetch('/api/energy-prices/clear', {
                                            method: 'DELETE',
                                            headers: { 'Authorization': (headers as any).Authorization }
                                        });
                                        const data = await response.json();
                                        if (response.ok) {
                                            alert(`Usunięto ${data.deleted} rekordów`);
                                            setUploadStatus({ status: 'idle' });
                                        } else {
                                            alert('Błąd: ' + data.error);
                                        }
                                    } catch (e: any) {
                                        alert('Błąd: ' + e.message);
                                    }
                                }}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                                <XCircle size={18} />
                                Wyczyść bazę RDN
                            </button>
                        </div>

                        {/* Email Status */}
                        {emailStatus.status !== 'idle' && (
                            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${emailStatus.status === 'success' ? 'bg-green-50 text-green-800' :
                                emailStatus.status === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'
                                }`}>
                                {emailStatus.status === 'uploading' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>}
                                {emailStatus.status === 'success' && <CheckCircle size={16} />}
                                {emailStatus.status === 'error' && <XCircle size={16} />}
                                <span>{emailStatus.message}</span>
                            </div>
                        )}
                    </div>

                    {/* Futures Upload Section */}
                    <div className="mt-12 pt-8 border-t-2 border-gray-100">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                Upload Notowań Terminowych (Futures)
                            </h2>
                            <p className="text-gray-600">
                                Wgraj plik CSV z notowaniami kontraktów terminowych (BASE Y+1, Y+2)
                            </p>
                        </div>

                        {/* Format Guide Futures */}
                        <div className="mb-8 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                                <FileText size={18} />
                                Format pliku CSV (Futures)
                            </h3>
                            <div className="text-sm text-purple-800 space-y-1">
                                <p>Wymagane kolumny:</p>
                                <ul className="list-disc list-inside ml-2">
                                    <li><code className="bg-purple-100 px-1 rounded">DataNotowania</code> - format <strong>DD.MM.YYYY</strong></li>
                                    <li><code className="bg-purple-100 px-1 rounded">KursRozliczeniowy</code> - cena (PLN/MWh)</li>
                                    <li><code className="bg-purple-100 px-1 rounded">Typ kontraktu</code> - musi być <strong>BASE</strong></li>
                                    <li><code className="bg-purple-100 px-1 rounded">Rok dostawy</code> - np. 2026, 2027</li>
                                </ul>
                            </div>
                        </div>

                        {/* File Upload Futures */}
                        <div className="mb-6">
                            <FuturesUploadSection />
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}

function FuturesUploadSection() {
    const { getAuthHeaders } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<UploadStatus>({ status: 'idle' });

    const handleUpload = async () => {
        if (!file) return;
        setStatus({ status: 'uploading', message: 'Wysyłanie...' });

        try {
            const authHeaders = await getAuthHeaders();
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/energy-prices/futures/upload', {
                method: 'POST',
                headers: { 'Authorization': (authHeaders as any).Authorization },
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Upload failed');

            setStatus({ status: 'success', message: data.message, count: data.count });
            setFile(null);
        } catch (error: any) {
            setStatus({ status: 'error', message: error.message || 'Upload failed' });
        }
    };

    return (
        <div>
            <div className="flex gap-4">
                <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                            setFile(f);
                            setStatus({ status: 'idle' });
                        }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <button
                    onClick={handleUpload}
                    disabled={!file || status.status === 'uploading'}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <Upload size={18} />
                    {status.status === 'uploading' ? 'Wysyłanie...' : 'Upload Futures'}
                </button>
            </div>
            {file && (
                <p className="mt-2 text-sm text-gray-600">
                    Wybrany plik: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
            )}

            {/* Status Messages */}
            {status.status === 'success' && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                    <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-green-900">Sukces!</p>
                        <p className="text-sm text-green-800">{status.message}</p>
                    </div>
                </div>
            )}
            {status.status === 'error' && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-red-900">Błąd</p>
                        <p className="text-sm text-red-800">{status.message}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
