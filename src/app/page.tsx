'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { APIProvider } from '@vis.gl/react-google-maps';
import Map from '@/components/Map';
import { Search, MapPin, Navigation, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function Home() {
  const [mode, setMode] = useState<'radius' | 'route' | 'ai'>('radius');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [center, setCenter] = useState({ lat: 52.2297, lng: 21.0122 }); // Warsaw default
  const [routePath, setRoutePath] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [aiReport, setAiReport] = useState('');
  const { data: session } = useSession();

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
        url = `/api/search-radius?address=${encodeURIComponent(address1)}`;
      } else if (mode === 'route') {
        url = `/api/search-route?origin=${encodeURIComponent(address1)}&destination=${encodeURIComponent(address2)}`;
      } else if (mode === 'ai') {
        url = '/api/ai-search';
        method = 'POST';
        body = { address: address1 };
      }

      const options: RequestInit = { method };
      if (method === 'POST') {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      if (mode === 'ai') {
        setAiReport(data.report);
        // If the API returns structured places from grounding metadata, use them for markers and list
        if (data.places && data.places.length > 0) {
          setResults(data.places);
          // Calculate center from the first result if available
          if (data.places[0]?.location) {
            setCenter(data.places[0].location);
          }
        }
        // Process grounding metadata if available to show markers
        // For now, we rely on the text report, but if metadata has locations, we could parse them.
        // The current Map component expects { id, location: { lat, lng }, name, ... }
        // If Gemini returns grounding chunks with location data, we can map it here.
        // This is a placeholder for metadata processing:
        if (data.groundingMetadata?.groundingChunks) {
          // console.log('Grounding Metadata:', data.groundingMetadata);
          // Implementation depends on exact structure of grounding chunks for Maps
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

  return (
    <APIProvider apiKey={API_KEY}>
      <div className="flex h-screen flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-1/3 bg-white p-6 shadow-xl z-10 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Sales Prospecting</h1>
            {session?.user && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500">Zalogowany jako:</span>
                <span className="text-sm font-semibold text-gray-700">{session.user.name || session.user.email}</span>
                <button
                  onClick={() => signOut()}
                  className="text-xs text-red-500 hover:text-red-700 mt-1 underline"
                >
                  Wyloguj
                </button>
              </div>
            )}
          </div>

          {/* Mode Toggle */}
          <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setMode('radius')}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${mode === 'radius' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center justify-center gap-1">
                <MapPin size={14} />
                Wokół Punktu
              </div>
            </button>
            <button
              onClick={() => setMode('route')}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${mode === 'route' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center justify-center gap-1">
                <Navigation size={14} />
                Wzdłuż Trasy
              </div>
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition-colors ${mode === 'ai' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-purple-700'
                }`}
            >
              <div className="flex items-center justify-center gap-1">
                <Sparkles size={14} />
                AI Assistant
              </div>
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === 'route' ? 'Punkt Startowy' : 'Adres / Obszar'}
              </label>
              <input
                type="text"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                placeholder={mode === 'ai' ? "np. Warszawa, duże fabryki" : "np. Warszawa, Marszałkowska 1"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'ai' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
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
          {mode !== 'ai' && (
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
                  <h3 className="font-bold text-gray-900 text-lg">{place.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{place.address}</p>

                  {place.summary && (
                    <p className="text-xs text-gray-500 mt-2 italic border-l-2 border-gray-300 pl-2">
                      {place.summary}
                    </p>
                  )}

                  <div className="flex items-center mt-2 gap-2 mb-3">
                    <span className="text-yellow-500 text-sm font-medium">★ {place.rating || 'N/A'}</span>
                    <span className="text-gray-400 text-xs">({place.user_ratings_total || 0} opinii)</span>
                  </div>

                  <div className="flex gap-2 mt-3 border-t pt-3">
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
                        className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 py-2 px-3 rounded text-xs font-semibold text-center transition-colors border border-blue-200"
                      >
                        🌐 Strona WWW
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="flex-1 relative h-[50vh] md:h-auto bg-gray-200">
          <Map center={center} markers={results} routePath={routePath} />
        </div>
      </div>
    </APIProvider>
  );
}
