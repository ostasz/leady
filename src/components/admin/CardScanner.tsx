'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, ScanLine, Save, RotateCw, Image as ImageIcon, Contact } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { resizeImage } from '@/lib/image-utils';
import { downloadVCard } from '@/lib/vcard-generator';

import type { ParsedCardData } from '@/lib/card-parser';

interface CardScannerProps {
    onSaveSuccess?: () => void;
    customTrigger?: React.ReactNode;
}

export default function CardScanner({ onSaveSuccess, customTrigger }: CardScannerProps) {
    const { getAuthHeaders } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<'upload' | 'scanning' | 'verify'>('upload');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<ParsedCardData>>({});
    const [loading, setLoading] = useState(false);
    const [base64Image, setBase64Image] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState('pl');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                // Resize image to max 1600px width/height and 0.8 quality
                const resizedBase64 = await resizeImage(file, 1600, 0.8);
                setImagePreview(resizedBase64);
                setBase64Image(resizedBase64);
            } catch (error) {
                console.error("Error resizing image:", error);
                alert("Błąd przetwarzania zdjęcia.");
            }
        }
    };

    const handleScan = async () => {
        if (!base64Image) return;
        setLoading(true);
        setStep('scanning');

        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/scan-card', {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: base64Image,
                    language: selectedLanguage
                })
            });

            const result = await res.json();

            if (!res.ok) {
                console.error("Scan API Error:", result);
                throw new Error(result.error || result.details || 'Scan failed');
            }

            setFormData(result.data);
            setStep('verify');
        } catch (error: any) {
            console.error("Scan Error:", error);
            alert(`Błąd skanowania: ${error.message || 'Spróbuj ponownie.'}\nJeśli problem się powtarza, sprawdź konfigurację API.`);
            setStep('upload');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: keyof ParsedCardData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const headers = await getAuthHeaders();
            const leadData = {
                companyName: formData.company || formData.name || 'Nowy Kontakt',
                address: formData.address || null,
                phone: formData.phone,
                website: formData.website,
                description: `Zeskanowano z wizytówki.\nStanowisko: ${formData.jobTitle || '-'}\nOsoba: ${formData.name || '-'}`,
                notes: `Email: ${formData.email || '-'}\nPełny tekst OCR:\n${formData.fullText || ''}`, // Store email in notes or custom field if available
                status: 'new',
                priority: 'medium',
                leadSource: 'business_card'
            };

            const res = await fetch('/api/leads', {
                method: 'POST',
                headers,
                body: JSON.stringify(leadData)
            });

            if (!res.ok) throw new Error('Failed to save lead');

            alert('Kontakt zapisany!');
            setIsOpen(false);
            resetState();
            if (onSaveSuccess) onSaveSuccess();

        } catch (error) {
            console.error(error);
            alert('Błąd zapisu.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToContacts = () => {
        // Safe cast or check because formData is Partial<ParsedCardData> but generator might handle partials gracefully
        // Actually generateVCard expects ParsedCardData (required fullText).
        // We guarantee fullText usually, but let's default it.
        const safeData: ParsedCardData = {
            ...formData,
            fullText: formData.fullText || ''
        };
        const filename = formData.name ? `${formData.name.replace(/\s+/g, '_')}.vcf` : 'contact.vcf';
        downloadVCard(safeData, filename);
    };

    const resetState = () => {
        setStep('upload');
        setImagePreview(null);
        setBase64Image(null);
        setFormData({});
    };

    const close = () => {
        setIsOpen(false);
        resetState();
    }

    return (
        <>
            {customTrigger ? (
                <div onClick={() => setIsOpen(true)}>
                    {customTrigger}
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-white border border-gray-300 text-gray-700 hover:text-primary hover:border-primary px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                    <ScanLine size={18} />
                    Skanuj wizytówkę
                </button>
            )}

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <ScanLine className="text-primary" size={20} />
                                Skaner Wizytówek
                            </h3>
                            <button onClick={close} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {step === 'upload' && (
                                <div className="space-y-6 text-center">
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                        {imagePreview ? (
                                            <div className="relative">
                                                <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-md object-contain" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors rounded-lg">
                                                    <RotateCw className="text-white opacity-0 group-hover:opacity-100" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3 text-gray-500">
                                                <div className="w-16 h-16 bg-blue-100 text-primary rounded-full flex items-center justify-center mb-2">
                                                    <Camera size={32} />
                                                </div>
                                                <p className="font-medium text-gray-700">Dotknij aby zrobić zdjęcie lub wybrać plik</p>
                                                <p className="text-xs text-gray-400">JPG, PNG (Max 5MB)</p>
                                            </div>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                    </div>

                                    {imagePreview && (
                                        <div className="flex flex-col gap-4 text-left">
                                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                                    Język wizytówki
                                                </label>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors flex-1 border border-transparent hover:border-gray-200">
                                                        <input
                                                            type="radio"
                                                            name="language"
                                                            value="pl"
                                                            checked={selectedLanguage === 'pl'}
                                                            onChange={(e) => setSelectedLanguage(e.target.value)}
                                                            className="text-primary focus:ring-primary w-4 h-4"
                                                        />
                                                        <span className="text-sm">🇵🇱 Polski (PL)</span>
                                                    </label>

                                                    <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors flex-1 border border-transparent hover:border-gray-200">
                                                        <input
                                                            type="radio"
                                                            name="language"
                                                            value="en"
                                                            checked={selectedLanguage === 'en'}
                                                            onChange={(e) => setSelectedLanguage(e.target.value)}
                                                            className="text-primary focus:ring-primary w-4 h-4"
                                                        />
                                                        <span className="text-sm">🇬🇧 Angielski (EN)</span>
                                                    </label>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-2">
                                                    Polski tryb lepiej rozpoznaje znaki diakrytyczne (ą, ę, ś).
                                                </p>
                                            </div>

                                            <button
                                                onClick={handleScan}
                                                className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                                            >
                                                <ScanLine size={20} />
                                                Analizuj Obraz
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 'scanning' && (
                                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                    <div className="relative">
                                        <div className="w-20 h-20 border-4 border-gray-100 border-t-primary rounded-full animate-spin"></div>
                                        <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800">Przetwarzanie w chmurze...</h4>
                                        <p className="text-sm text-gray-500">Wysyłanie do Google Vision API</p>
                                    </div>
                                </div>
                            )}

                            {step === 'verify' && (
                                <form onSubmit={handleSave} className="space-y-4">
                                    <div className="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-100 flex justify-between items-start">
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-800 mb-1">Sukces! Sprawdź dane.</h4>
                                            <p className="text-xs text-blue-600">Możesz teraz edytować rozpoznane dane.</p>
                                        </div>
                                        {formData.source && (
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border ${formData.source === 'ai'
                                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                                : 'bg-orange-100 text-orange-700 border-orange-200'
                                                }`}>
                                                {formData.source === 'ai'
                                                    ? `Vertex AI ✨ ${formData.modelName ? `(${formData.modelName})` : ''}`
                                                    : 'Regex (Fallback) ⚠️'}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Nazwa Firmy</label>
                                            <input
                                                type="text"
                                                value={formData.company || ''}
                                                onChange={e => handleInputChange('company', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none font-medium text-gray-900 placeholder:text-gray-400"
                                                placeholder="Brak nazwy firmy"
                                            />
                                        </div>

                                        <div className="col-span-1">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Imię i Nazwisko</label>
                                            <input
                                                type="text"
                                                value={formData.name || ''}
                                                onChange={e => handleInputChange('name', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 placeholder:text-gray-400"
                                                placeholder="Imię"
                                            />
                                        </div>

                                        <div className="col-span-1">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Stanowisko</label>
                                            <input
                                                type="text"
                                                value={formData.jobTitle || ''}
                                                onChange={e => handleInputChange('jobTitle', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 placeholder:text-gray-400"
                                                placeholder="Stanowisko"
                                            />
                                        </div>

                                        <div className="col-span-1">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Telefon</label>
                                            <input
                                                type="text"
                                                value={formData.phone || ''}
                                                onChange={e => handleInputChange('phone', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 placeholder:text-gray-400"
                                                placeholder="Telefon"
                                            />
                                        </div>

                                        <div className="col-span-1">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                                            <input
                                                type="email"
                                                value={formData.email || ''}
                                                onChange={e => handleInputChange('email', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 placeholder:text-gray-400"
                                                placeholder="Email"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Adres</label>
                                            <input
                                                type="text"
                                                value={formData.address || ''}
                                                onChange={e => handleInputChange('address', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 placeholder:text-gray-400"
                                                placeholder="Ulica, Miasto, Kod pocztowy"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Strona WWW</label>
                                            <div className="flex items-center gap-2">
                                                <Globe size={16} className="text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={formData.website || ''}
                                                    onChange={e => handleInputChange('website', e.target.value)}
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none text-gray-900 placeholder:text-gray-400"
                                                    placeholder="www.firma.pl"
                                                />
                                            </div>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Pełny tekst OCR (do weryfikacji)</label>
                                            <textarea
                                                value={formData.fullText || ''}
                                                onChange={e => handleInputChange('fullText', e.target.value)}
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none min-h-[100px] text-gray-900 placeholder:text-gray-400"
                                                placeholder="Tutaj pojawi się surowy tekst z wizytówki..."
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4 border-t mt-4">
                                        <button
                                            type="button"
                                            onClick={() => setStep('upload')}
                                            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex-1"
                                        >
                                            Wstecz
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveToContacts}
                                            className="px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex-[2] flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                                        >
                                            <Contact size={18} />
                                            Zapisz w Telefonie (vCard)
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Helper icons
import { Globe } from 'lucide-react';
