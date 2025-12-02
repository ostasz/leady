'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { GoogleMap, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api';
import { APIProvider } from '@vis.gl/react-google-maps';
import { LEAD_PROFILES, ProfileKey } from '@/config/lead-profiles';
import Link from 'next/link';
import Map from '@/components/Map';
import { Search, MapPin, Navigation, Sparkles, Locate, Save, BookmarkPlus, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function Home() {
  const { user, userData, loading: authLoading, signOut, getAuthHeaders } = useAuth();
  const [mode, setMode] = useState<'radius' | 'route' | 'ai'>('ai');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [center, setCenter] = useState({ lat: 52.2297, lng: 21.0122 }); // Warsaw default
  const [routePath, setRoutePath] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [aiReport, setAiReport] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [deepSearchResults, setDeepSearchResults] = useState<Record<string, any>>({});
  const [deepSearchLoading, setDeepSearchLoading] = useState<Record<string, boolean>>({});
  const [savingLead, setSavingLead] = useState<Record<string, boolean>>({});
  const [selectedProfiles, setSelectedProfiles] = useState<ProfileKey[]>(['heavy_industry', 'logistics']);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const router = useRouter();

  // Authentication guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user && !user.emailVerified) {
      router.push('/verify-email');
    }
  }, [user, authLoading, router]);

  const handleSaveLead = async (place: any) => {
    setSavingLead(prev => ({ ...prev, [place.id]: true }));
    try {
      // First, run Deep Search if not already done
      let deepData = deepSearchResults[place.id];
      if (!deepData || deepData.error) {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/deep-search', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: place.name,
            address: place.address,
            website: place.website
          })
        });
        const searchData = await res.json();
        if (searchData.data) {
          deepData = searchData.data;
          setDeepSearchResults(prev => ({ ...prev, [place.id]: deepData }));
        }
      }

      // Now save to leads
      const leadData = {
        companyName: place.name,
        address: place.address,
        phone: place.phone,
        website: place.website,
        nip: deepData?.nip,
        regon: deepData?.gus?.regon,
        pkd: deepData?.gus?.pkd,
        keyPeople: deepData?.keyPeople || [],
        revenue: deepData?.revenue,
        employees: deepData?.employees,
        socials: deepData?.socials,
        description: deepData?.description || place.summary,
        technologies: deepData?.technologies || []
      };

      const headers = await getAuthHeaders();
      const saveRes = await fetch('/api/leads', {
        method: 'POST',
        headers,
        body: JSON.stringify(leadData)
      });

      if (saveRes.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        const error = await saveRes.json();
        alert(`Błąd: ${error.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Błąd podczas zapisywania leada.');
    } finally {
      setSavingLead(prev => ({ ...prev, [place.id]: false }));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);
    setRoutePath([]);
    setAiReport('');

    try {
      let url = '';
      let body = {};
      let method = 'GET';

      if (mode === 'radius') {
        const profilesParam = selectedProfiles.join(',');
        url = `/api/search-radius?address=${encodeURIComponent(address1)}&profiles=${profilesParam}`;
      } else if (mode === 'route') {
        url = `/api/search-route?origin=${encodeURIComponent(address1)}&destination=${encodeURIComponent(address2)}`;
      } else if (mode === 'ai') {
        url = '/api/ai-search';
        method = 'POST';
        body = { address: address1 };
      }

      // Get Firebase Auth headers
      const headers = await getAuthHeaders();

      const options: RequestInit = {
        method,
        headers
      };
      if (method === 'POST') {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      if (mode === 'ai') {
        setAiReport(data.report || '');
        // Backend now returns 'results' instead of 'places'
        if (data.results && data.results.length > 0) {
          setResults(data.results);
          // Calculate center from the first result if available
          if (data.results[0]?.location) {
            setCenter(data.results[0].location);
          }
        }
      } else {
        setResults(data.results);
        if (data.center) setCenter(data.center);
        if (data.route) setRoutePath(data.route);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    setGettingLocation(true);
    if (!navigator.geolocation) {
      alert('Geolokalizacja nie jest wspierana przez Twoją przeglądarkę');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocode to get address
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${API_KEY}`
          );
          const data = await response.json();
          if (data.results && data.results[0]) {
            const address = data.results[0].formatted_address;
            setAddress1(address);
            setCenter({ lat: latitude, lng: longitude });
          }
        } catch (error) {
          console.error('Error getting address:', error);
          setAddress1(`${latitude}, ${longitude}`);
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Nie udało się pobrać lokalizacji. Sprawdź uprawnienia przeglądarki.');
        setGettingLocation(false);
      }
    );
  };

  // Helper to parse AI report
  const parseAIReport = (report: string) => {
    const lines = report.split('\n');
    const parsedData: any[] = [];
    let currentCompany: any = {};

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check for details first
      if (trimmed.match(/Telefon:/i)) {
        currentCompany.Phone = trimmed.split(/Telefon:/i)[1].trim();
      } else if (trimmed.match(/NIP:/i)) {
        currentCompany.NIP = trimmed.split(/NIP:/i)[1].trim();
      } else if (trimmed.match(/WWW:/i)) {
        currentCompany.Website = trimmed.split(/WWW:/i)[1].trim();
      }
      // Check for Company Name (starts with list marker, not a detail)
      else if (trimmed.match(/^[\*\-1-9\.]+/)) {
        // If we already have a company with a name, push it
        if (currentCompany.Name) {
          parsedData.push(currentCompany);
          currentCompany = {}; // Reset for next company, keeping phone/nip/www empty initially
        }

        // Extract name: remove markers (*, -, 1.), remove bolding (**), remove links
        let name = trimmed.replace(/^[\*\-1-9\.]+\s*/, '') // Remove list marker
          .replace(/\*\*/g, '')             // Remove bold
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
          .trim();

        // Only treat as company if it looks like a name (not "Podsumowanie" or empty)
        if (name && !name.startsWith('Podsumowanie') && !name.startsWith('Oto')) {
          currentCompany.Name = name;
        }
      }
    });
    // Push the last one
    if (currentCompany.Name) parsedData.push(currentCompany);
    return parsedData;
  };

  const handleDeepSearch = async (id: string, name: string, address: string, website: string) => {
    setDeepSearchLoading(prev => ({ ...prev, [id]: true }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/deep-search', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, address, website })
      });
      const data = await res.json();
      if (data.data) {
        setDeepSearchResults(prev => ({ ...prev, [id]: data.data }));
      } else {
        setDeepSearchResults(prev => ({ ...prev, [id]: { error: 'Nie udało się pobrać danych.' } }));
      }
    } catch (e) {
      console.error(e);
      setDeepSearchResults(prev => ({ ...prev, [id]: { error: 'Błąd połączenia.' } }));
    } finally {
      setDeepSearchLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
  }

  if (!user || !user.emailVerified) {
    return null; // Will redirect in useEffect
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <div className="flex h-screen flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-1/3 bg-white p-6 shadow-xl z-10 overflow-y-auto relative">
          {/* Success Toast - Fixed position */}
          {saveSuccess && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-fade-in-out">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">Zapisano</span>
            </div>
          )}

          <div className="flex flex-col mb-6">
            <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm font-medium transition-colors">
              <ArrowLeft size={16} />
              Wróć do Portalu
            </Link>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-800">Wyszukiwanie leadów</h1>
              {user && (
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-700 font-medium">Zalogowany jako:</span>
                  <span className="text-sm font-semibold text-gray-900">{user.displayName || user.email}</span>
                  {userData?.role === 'admin' && (
                    <Link href="/admin" className="text-xs text-primary hover:text-primary-dark mt-1 font-bold">
                      Panel Administratora
                    </Link>
                  )}
                  <button
                    onClick={() => signOut()}
                    className="text-xs text-red-500 hover:text-red-700 mt-1 underline"
                  >
                    Wyloguj
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setMode('radius')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all ${mode === 'radius' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              <div className="flex items-center justify-center gap-1">
                <MapPin size={14} />
                Wokół Punktu
              </div>
            </button>
            <button
              onClick={() => setMode('route')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all ${mode === 'route' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              <div className="flex items-center justify-center gap-1">
                <Navigation size={14} />
                Wzdłuż Trasy
              </div>
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all ${mode === 'ai'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 text-white shadow-lg shadow-purple-500/50 animate-pulse-glow'
                : 'bg-gray-100 text-gray-800 hover:bg-gradient-to-r hover:from-purple-50 hover:to-cyan-50 hover:shadow-md'
                }`}
            >
              <div className="flex items-center justify-center gap-1">
                <Sparkles size={14} />
                AI Assistant
              </div>
            </button>
          </div>

          {/* My Leads Button */}
          <Link
            href="/my-leads"
            className="block w-full mb-6 bg-primary text-white py-3 px-4 rounded-lg text-center font-semibold hover:bg-primary-dark transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <BookmarkPlus size={18} />
            Moje Leady
          </Link>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4 mb-8">

            {/* Profile Selection (Only for Radius Mode) */}
            {mode === 'radius' && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">Wybierz profile firm:</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.values(LEAD_PROFILES).map((profile) => (
                    <label key={profile.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedProfiles.includes(profile.id as ProfileKey)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProfiles([...selectedProfiles, profile.id as ProfileKey]);
                          } else {
                            setSelectedProfiles(selectedProfiles.filter(id => id !== profile.id));
                          }
                        }}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{profile.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === 'route' ? 'Punkt Startowy' : 'Adres / Obszar'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  placeholder={mode === 'ai' ? "np. Warszawa, duże fabryki" : "np. Warszawa, Marszałkowska 1"}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-gray-900"
                  required
                />
                <button
                  type="button"
                  onClick={getUserLocation}
                  disabled={gettingLocation}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Użyj mojej lokalizacji"
                >
                  <Locate size={20} className={gettingLocation ? 'animate-pulse' : ''} />
                </button>
              </div>
            </div>

            {mode === 'route' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Punkt Końcowy
                </label>
                <input
                  type="text"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  placeholder="np. Łódź, Piotrkowska"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-gray-900"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'ai' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-primary hover:bg-primary-dark'}`}
            >
              {loading ? (
                'Szukanie...'
              ) : (
                <>
                  {mode === 'ai' ? <Sparkles size={18} /> : <Search size={18} />}
                  {mode === 'ai' ? 'Analiza AI' : 'Szukaj Firm'}
                </>
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* AI Report */}
          {mode === 'ai' && aiReport && (
            <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-100">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                  <Sparkles size={20} />
                  Raport AI
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const XLSX = await import('xlsx');

                        // Parse AI Report for structured data using helper
                        const parsedData = parseAIReport(aiReport);

                        const ws = XLSX.utils.json_to_sheet(parsedData);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "AI Prospects");
                        XLSX.writeFile(wb, "ai_prospects.xlsx");
                      } catch (e) {
                        alert("Błąd: Biblioteka xlsx nie jest zainstalowana. Uruchom w terminalu: npm install xlsx");
                        console.error(e);
                      }
                    }}
                    className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                    title="Eksportuj do Excel"
                  >
                    Excel
                  </button>
                  <button
                    onClick={() => {
                      const element = document.createElement("a");
                      const file = new Blob([aiReport], { type: 'text/plain' });
                      element.href = URL.createObjectURL(file);
                      element.download = "raport_ai.txt";
                      document.body.appendChild(element); // Required for this to work in FireFox
                      element.click();
                      document.body.removeChild(element);
                    }}
                    className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                    title="Pobierz raport jako tekst"
                  >
                    TXT
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const jsPDF = (await import('jspdf')).default;
                        const autoTable = (await import('jspdf-autotable')).default;

                        const doc = new jsPDF();

                        // Load custom font for Polish characters
                        const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
                        const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());

                        // Browser compatible base64 conversion
                        const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
                          let binary = '';
                          const bytes = new Uint8Array(buffer);
                          const len = bytes.byteLength;
                          for (let i = 0; i < len; i++) {
                            binary += String.fromCharCode(bytes[i]);
                          }
                          return window.btoa(binary);
                        };

                        const base64String = arrayBufferToBase64(fontBytes);

                        doc.addFileToVFS('Roboto-Regular.ttf', base64String);
                        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
                        doc.setFont('Roboto');

                        // Add Title
                        doc.setFontSize(18);
                        doc.setTextColor(40, 40, 40);
                        doc.text("Raport AI Potencjalnych Klientów", 14, 22);

                        doc.setFontSize(10);
                        doc.setTextColor(100, 100, 100);
                        doc.text(`Data generowania: ${new Date().toLocaleDateString('pl-PL')}`, 14, 30);

                        // Sanitize and Process Text
                        const cleanText = aiReport
                          .replace(/\*\*/g, '') // Remove bold
                          .replace(/\*/g, '-')  // Replace bullets
                          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links [text](url) -> text
                          .replace(/<[^>]*>/g, ''); // Remove HTML tags if any

                        doc.setFontSize(11);
                        doc.setTextColor(60, 60, 60);

                        const splitText = doc.splitTextToSize(cleanText, 180);
                        let y = 40;
                        const pageHeight = doc.internal.pageSize.height;
                        const margin = 14;
                        const lineHeight = 5;

                        // Pagination Loop
                        for (let i = 0; i < splitText.length; i++) {
                          if (y > pageHeight - 20) {
                            doc.addPage();
                            y = 20; // Reset Y for new page
                          }
                          doc.text(splitText[i], margin, y);
                          y += lineHeight;
                        }

                        // Add some spacing before table
                        y += 10;

                        // Check if table needs new page
                        if (y > pageHeight - 40) {
                          doc.addPage();
                          y = 20;
                        }

                        // Parse AI Report using helper
                        const parsedData = parseAIReport(aiReport);

                        const tableData = parsedData.map(r => [
                          r.Name || '-',
                          r.NIP || '-',
                          r.Phone || '-',
                          r.Website || '-'
                        ]);

                        autoTable(doc, {
                          startY: y,
                          head: [['Firma', 'NIP', 'Telefon', 'WWW']],
                          body: tableData,
                          styles: {
                            font: 'Roboto',
                            fontSize: 10,
                            cellPadding: 3,
                          },
                          headStyles: {
                            fillColor: [142, 68, 173], // Purple for AI
                            textColor: 255,
                            fontStyle: 'bold',
                          },
                          alternateRowStyles: {
                            fillColor: [245, 245, 245],
                          },
                          columnStyles: {
                            0: { cellWidth: 50 },
                            1: { cellWidth: 30 },
                            2: { cellWidth: 30 },
                            3: { cellWidth: 'auto' },
                          },
                        });

                        doc.save("ai_prospects.pdf");
                      } catch (e) {
                        alert("Błąd: Biblioteki PDF nie są zainstalowane. Uruchom w terminalu: npm install jspdf jspdf-autotable");
                        console.error(e);
                      }
                    }}
                    className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                    title="Eksportuj do PDF"
                  >
                    PDF
                  </button>
                </div>
              </div>
              <div className="prose prose-sm prose-purple max-w-none text-gray-800">
                <ReactMarkdown>{aiReport}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-lg font-semibold text-gray-800">
                Wyniki ({results.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (results.length === 0) return;
                    try {
                      const XLSX = await import('xlsx');
                      const ws = XLSX.utils.json_to_sheet(results.map(r => ({
                        Name: r.name,
                        Address: r.address,
                        Phone: r.phone || '',
                        Website: r.website || '',
                        Rating: r.rating || '',
                        Reviews: r.user_ratings_total || ''
                      })));
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Prospects");
                      XLSX.writeFile(wb, "prospects.xlsx");
                    } catch (e) {
                      alert("Błąd: Biblioteka xlsx nie jest zainstalowana. Uruchom w terminalu: npm install xlsx");
                      console.error(e);
                    }
                  }}
                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                  title="Eksportuj do Excel"
                >
                  Excel
                </button>
                <button
                  onClick={async () => {
                    if (results.length === 0) return;
                    try {
                      const jsPDF = (await import('jspdf')).default;
                      const autoTable = (await import('jspdf-autotable')).default;

                      const doc = new jsPDF();

                      // Load custom font for Polish characters
                      const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
                      const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
                      const fontBase64 = Buffer.from(fontBytes).toString('base64'); // Requires Buffer polyfill or browser equivalent

                      // Browser compatible base64 conversion
                      const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
                        let binary = '';
                        const bytes = new Uint8Array(buffer);
                        const len = bytes.byteLength;
                        for (let i = 0; i < len; i++) {
                          binary += String.fromCharCode(bytes[i]);
                        }
                        return window.btoa(binary);
                      };

                      const base64String = arrayBufferToBase64(fontBytes);

                      doc.addFileToVFS('Roboto-Regular.ttf', base64String);
                      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
                      doc.setFont('Roboto');

                      // Add Title
                      doc.setFontSize(18);
                      doc.setTextColor(40, 40, 40);
                      doc.text("Raport Potencjalnych Klientów", 14, 22);

                      doc.setFontSize(10);
                      doc.setTextColor(100, 100, 100);
                      doc.text(`Data generowania: ${new Date().toLocaleDateString('pl-PL')}`, 14, 30);

                      const tableData = results.map(r => [
                        r.name,
                        r.address,
                        r.phone || '-',
                        r.website || '-'
                      ]);

                      autoTable(doc, {
                        startY: 40,
                        head: [['Nazwa Firmy', 'Adres', 'Telefon', 'Strona WWW']],
                        body: tableData,
                        styles: {
                          font: 'Roboto',
                          fontSize: 10,
                          cellPadding: 3,
                        },
                        headStyles: {
                          fillColor: [41, 128, 185], // Blue
                          textColor: 255,
                          fontStyle: 'bold',
                        },
                        alternateRowStyles: {
                          fillColor: [245, 245, 245],
                        },
                        columnStyles: {
                          0: { cellWidth: 50 }, // Name
                          1: { cellWidth: 60 }, // Address
                          2: { cellWidth: 30 }, // Phone
                          3: { cellWidth: 'auto' }, // Website
                        },
                      });

                      doc.save("prospects.pdf");
                    } catch (e) {
                      alert("Błąd: Biblioteki PDF nie są zainstalowane lub wystąpił błąd generowania. Uruchom w terminalu: npm install jspdf jspdf-autotable");
                      console.error(e);
                    }
                  }}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                  title="Eksportuj do PDF"
                >
                  PDF
                </button>
              </div>
            </div>

            {results.length === 0 && !loading && (
              <p className="text-gray-500 text-sm italic">Brak wyników. Wpisz adres i kliknij szukaj.</p>
            )}
            {results.map((place) => (
              <div key={place.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <h3 className="font-bold text-gray-900 text-lg">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(place.name + " " + (place.address || ""))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary hover:underline"
                  >
                    {place.name}
                  </a>
                </h3>
                <p className="text-sm text-gray-600 mt-1">{place.address}</p>

                {/* @ts-ignore */}
                {place.nip && (
                  <div className="flex items-center gap-1 mt-2 text-xs font-mono text-purple-700 bg-purple-50 px-2 py-1 rounded w-fit border border-purple-100">
                    <span className="font-bold">NIP:</span>
                    {/* @ts-ignore */}
                    {place.nip}
                  </div>
                )}

                {place.summary && (
                  <p className="text-xs text-gray-500 mt-2 italic border-l-2 border-gray-300 pl-2">
                    {place.summary}
                  </p>
                )}

                <div className="flex items-center mt-2 gap-2 mb-3">
                  <span className="text-yellow-500 text-sm font-medium">★ {place.rating || 'N/A'}</span>
                  <span className="text-gray-400 text-xs">({place.user_ratings_total || 0} opinii)</span>
                </div>

                <div className="flex gap-2 mt-3 border-t pt-3 flex-wrap">
                  {place.phone && (
                    <a
                      href={`tel:${place.phone}`}
                      className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 py-2 px-3 rounded text-xs font-semibold text-center transition-colors border border-green-200"
                    >
                      📞 Zadzwoń
                    </a>
                  )}
                  {place.website && (
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-primary-lighter text-primary-dark hover:bg-primary-light py-2 px-3 rounded text-xs font-semibold text-center transition-colors border border-primary-light"
                    >
                      🌐 Strona WWW
                    </a>
                  )}
                  <button
                    onClick={() => handleDeepSearch(place.id, place.name, place.address, place.website)}
                    disabled={deepSearchLoading[place.id]}
                    className="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-2 px-3 rounded text-xs font-semibold text-center transition-colors border border-indigo-200 flex items-center justify-center gap-1"
                  >
                    {deepSearchLoading[place.id] ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <Sparkles size={12} />
                    )}
                    {deepSearchResults[place.id] ? 'Odśwież Info' : 'Deep Search'}
                  </button>
                  <button
                    onClick={() => handleSaveLead(place)}
                    disabled={savingLead[place.id]}
                    className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 py-2 px-3 rounded text-xs font-semibold text-center transition-colors border border-green-200 flex items-center justify-center gap-1"
                    title="Zapisz do mojej bazy leadów"
                  >
                    {savingLead[place.id] ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <BookmarkPlus size={12} />
                    )}
                    Zapisz Lead
                  </button>
                </div>

                {/* Deep Search Results */}
                {deepSearchResults[place.id] && (
                  <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-sm animate-in fade-in slide-in-from-top-2">
                    <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                      <Sparkles size={14} />
                      Analiza AI
                    </h4>

                    {deepSearchResults[place.id].error ? (
                      <p className="text-red-600">{deepSearchResults[place.id].error}</p>
                    ) : (
                      <div className="space-y-2">
                        {deepSearchResults[place.id].description && (
                          <p className="text-gray-700 italic">{deepSearchResults[place.id].description}</p>
                        )}

                        {deepSearchResults[place.id].nip && (
                          <div className="mt-2 bg-purple-50 p-2 rounded border border-purple-100 inline-block">
                            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">NIP: </span>
                            <span className="font-mono font-medium text-purple-900">{deepSearchResults[place.id].nip}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {deepSearchResults[place.id].revenue && (
                            <div className="bg-white p-2 rounded border border-indigo-100">
                              <span className="block text-xs text-gray-500">Przychody</span>
                              <span className="font-medium text-indigo-800">{deepSearchResults[place.id].revenue}</span>
                            </div>
                          )}
                          {deepSearchResults[place.id].employees && (
                            <div className="bg-white p-2 rounded border border-indigo-100">
                              <span className="block text-xs text-gray-500">Pracownicy</span>
                              <span className="font-medium text-indigo-800">{deepSearchResults[place.id].employees}</span>
                            </div>
                          )}
                        </div>

                        {deepSearchResults[place.id].keyPeople && deepSearchResults[place.id].keyPeople.length > 0 && (
                          <div className="mt-2">
                            <span className="block text-xs text-gray-500 mb-1">Kluczowe Osoby:</span>
                            <ul className="list-disc list-inside text-gray-800">
                              {deepSearchResults[place.id].keyPeople.map((person: string, idx: number) => (
                                <li key={idx}>{person}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {deepSearchResults[place.id].socials && Object.values(deepSearchResults[place.id].socials).some(v => v) && (
                          <div className="mt-2 flex gap-2">
                            {/* @ts-ignore */}
                            {deepSearchResults[place.id].socials.linkedin && (
                              <a href={deepSearchResults[place.id].socials.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">LinkedIn</a>
                            )}
                            {/* @ts-ignore */}
                            {deepSearchResults[place.id].socials.facebook && (
                              <a href={deepSearchResults[place.id].socials.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Facebook</a>
                            )}
                            {/* @ts-ignore */}
                            {deepSearchResults[place.id].socials.instagram && (
                              <a href={deepSearchResults[place.id].socials.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline">Instagram</a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* GUS Data Section */}
                    {/* @ts-ignore */}
                    {deepSearchResults[place.id].gus && (
                      <div className="mt-3 pt-3 border-t border-indigo-200">
                        <h5 className="font-bold text-indigo-800 text-xs uppercase mb-2">Dane Rejestrowe (GUS/CEIDG)</h5>
                        <div className="grid grid-cols-1 gap-2 text-xs">
                          {/* @ts-ignore */}
                          {deepSearchResults[place.id].gus.regon && (
                            <div><span className="text-gray-500">REGON:</span> <span className="font-mono">{deepSearchResults[place.id].gus.regon}</span></div>
                          )}
                          {/* @ts-ignore */}
                          {deepSearchResults[place.id].gus.pkd && deepSearchResults[place.id].gus.pkd.length > 0 && (
                            <div className="mt-1">
                              <span className="text-gray-500 block mb-1">PKD:</span>
                              <ul className="list-disc list-inside pl-1 text-gray-700 space-y-0.5">
                                {/* @ts-ignore */}
                                {deepSearchResults[place.id].gus.pkd.slice(0, 3).map((code: string, i: number) => (
                                  <li key={i} className="truncate">{code}</li>
                                ))}
                                {/* @ts-ignore */}
                                {deepSearchResults[place.id].gus.pkd.length > 3 && <li>...</li>}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative h-[50vh] md:h-auto bg-gray-200">
          <Map center={center} markers={results} routePath={routePath} />
        </div>
      </div>
    </APIProvider>
  );
}
