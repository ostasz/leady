import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex AI with explicit credentials for local/admin usage
const vertexAI = new VertexAI({
    project: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || 'ekovoltis-portal',
    location: 'europe-central2',
    googleAuthOptions: {
        credentials: {
            client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL,
            private_key: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
        }
    }
});

// EU-first models: Gemini 2.5 Flash / Flash-Lite / Pro
// EU-first models: Gemini 2.5 Flash / Flash-Lite / Pro
const EU_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

export interface ParsedCardData {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    address?: string | null;
    fullText: string;
    source?: 'ai' | 'regex';
    modelName?: string;
}

export async function parseBusinessCard(text: string, languageHints: string[] = []): Promise<ParsedCardData> {

    // Helper to try a specific model
    const tryModel = async (modelName: string): Promise<ParsedCardData> => {
        // console.log(`[VertexAI] Trying model: ${modelName}`); // Debug only
        const model = vertexAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
            }
        });

        const langContext = languageHints.includes('pl') ? 'Priorytet: Polski.' : 'Priorytet: Angielski.';
        const prompt = `
            Jesteś ekspertem OCR i asystentem wprowadzania danych.
            Twoim zadaniem jest przeanalizowanie surowego tekstu z wizytówki i wyodrębnienie danych strukturalnych.
            ${langContext}
            
            Zasady:
            1. Popraw oczywiste błędy OCR (np. "Emall" -> "Email", "VVarszawa" -> "Warszawa").
            2. Dla numerów telefonu dodaj prefiks kraju (np. +48) jeśli go brakuje i jest to numer polski. Sformatuj jako +XX XXX XXX XXX.
            3. Rozdziel Imię od Nazwiska jeśli to możliwe.
            4. Nazwa firmy: ignoruj "NIP" i "REGON", szukaj nazw podmiotów. 
            5. Jeśli czegoś nie ma, zwróć null.
            
            Oto tekst z wizytówki:
            """
            ${text}
            """
            
            Zwróć kompletny JSON (bez markdown) w formacie:
            {
                "firstName": string | null,
                "lastName": string | null,
                "company": string | null,
                "jobTitle": string | null,
                "email": string | null,
                "phone": string | null,
                "website": string | null,
                "address": string | null
            }
        `;

        // console.log('[VertexAI] Input text length:', text.length); 
        const result = await model.generateContent(prompt);

        // Safer response extraction
        const candidates = result.response.candidates;
        const parts = candidates?.[0]?.content?.parts ?? [];
        let responseText = parts.map(p => (p as any).text ?? '').join('').trim();

        // debug log (careful with PII in prod)
        // console.log('[VertexAI] Raw response length:', responseText.length);

        if (!responseText) {
            throw new Error('Gemini zwróciło pustą odpowiedź');
        }

        // Clean Markdown code blocks if present (just in case, even with responseMimeType)
        responseText = responseText.replace(/```json\n?|\n?```/g, '').trim();

        let aiData: any;
        try {
            aiData = JSON.parse(responseText);
        } catch (e) {
            console.error("JSON Parse Error", e);
            throw new Error("Failed to parse AI response as JSON");
        }

        // Sanitization & Normalization function
        const norm = (v: any) => (typeof v === 'string' ? v.trim() || null : null);

        const data: ParsedCardData = {
            firstName: norm(aiData.firstName),
            lastName: norm(aiData.lastName),
            company: norm(aiData.company),
            jobTitle: norm(aiData.jobTitle),
            email: norm(aiData.email),
            phone: norm(aiData.phone),
            website: norm(aiData.website),
            address: norm(aiData.address),
            name: [norm(aiData.firstName), norm(aiData.lastName)].filter(Boolean).join(' ') || null,
            fullText: text,
            source: 'ai',
            modelName: modelName,
        };

        // console.log(`[VertexAI] Success with ${modelName}`);
        return data;
    };

    // Main Logic: Try Models in Sequence (EU)
    // We try the first model, if it fails (e.g. overload), we try the next.
    for (const modelName of EU_MODELS) {
        try {
            return await tryModel(modelName);
        } catch (error) {
            console.warn(`[VertexAI] Model ${modelName} failed:`, error instanceof Error ? error.message : error);
            // Continue to next model
        }
    }

    // If all AI models fail, fall back to Regex
    console.error('[VertexAI] All AI models failed, using regex fallback.');
    return parseBusinessCardRegex(text);
}

/**
 * Fallback Heuristic Parser (Regex + Keyword Matching)
 */
function parseBusinessCardRegex(text: string): ParsedCardData {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // Initialize with nulls to match strict interface
    const data: ParsedCardData = {
        fullText: text,
        source: 'regex',
        firstName: null,
        lastName: null,
        company: null,
        jobTitle: null,
        email: null,
        phone: null,
        website: null,
        address: null,
        name: null
    };

    // Regex Patterns
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
    const phoneRegex = /(?:\+?48)?\s?(\d{3}[-\s]?\d{3}[-\s]?\d{3})/;
    const urlRegex = /((https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,})(\/.*)?/i;
    const addressRegex = /(ul\.|al\.|pl\.|os\.|aleja|ulica|plac|osiedle|\d{2}-\d{3})/i;

    // Keywords
    const jobTitles = ['Manager', 'Dyrektor', 'Prezes', 'Specjalista', 'Handlowiec', 'Doradca', 'Director', 'CEO', 'CTO', 'Sales', 'Account', 'Board', 'Zarząd', 'Wiceprezes'];
    const companySuffixes = ['Sp. z o.o.', 'S.A.', 'GmbH', 'Inc.', 'Ltd.', 'Sp.k.', 'S.J.'];

    // 1. First Pass: Contact details Extraction
    for (const line of lines) {
        // Email - First match
        if (!data.email) {
            const emailMatch = line.match(emailRegex);
            if (emailMatch) data.email = emailMatch[0];
        }

        // Phone - First match not being NIP/REGON
        if (!data.phone) {
            const isNotTaxId = !line.toLowerCase().includes('nip') && !line.toLowerCase().includes('regon');
            if (isNotTaxId) {
                const phoneMatch = line.match(phoneRegex);
                if (phoneMatch) {
                    let p = phoneMatch[0].replace(/\s/g, '').replace(/-/g, '');
                    if (p.length === 9) p = '+48' + p;
                    data.phone = p;
                }
            }
        }

        // Website
        if (!data.website) {
            const isNotEmail = !line.includes('@');
            if (isNotEmail) {
                const urlMatch = line.match(urlRegex);
                if (urlMatch) {
                    data.website = urlMatch[0];
                    if (!data.website.startsWith('http')) {
                        data.website = 'https://' + data.website;
                    }
                }
            }
        }

        // Address (Simple heuristic)
        if (!data.address) {
            if (addressRegex.test(line)) {
                data.address = line;
            }
        }
    }

    // 2. Filter lines used for name/company detection
    const potentialInfoLines = lines.filter(line => {
        const isEmail = line.match(emailRegex);
        const isPhone = line.match(phoneRegex);
        const isUrl = line.match(urlRegex) && !line.includes('@');
        return !isEmail && !isPhone && !isUrl;
    });

    // 3. Heuristics for Company and Job Title
    for (const line of potentialInfoLines) {
        // Company
        if (!data.company) {
            if (companySuffixes.some(suffix => line.includes(suffix))) {
                data.company = line;
            }
        }
        // Job Title
        if (!data.jobTitle) {
            if (jobTitles.some(title => line.toLowerCase().includes(title.toLowerCase()))) {
                data.jobTitle = line;
            }
        }
    }

    // 4. Heuristics for Name
    if (!data.name) {
        const potentialName = potentialInfoLines.find(line => {
            const notCompany = line !== data.company;
            const notTitle = line !== data.jobTitle;
            const notAddress = line !== data.address; // simple quality check
            const properLength = line.split(' ').length >= 2 && line.split(' ').length <= 4;
            const startsCap = /^[A-Z]/.test(line);

            return notCompany && notTitle && notAddress && properLength && startsCap;
        });

        if (potentialName) {
            data.name = potentialName;
            // Best effort split
            const parts = potentialName.split(' ');
            if (parts.length >= 2) {
                data.lastName = parts.pop() || null;
                data.firstName = parts.join(' ') || null;
            }
        } else if (data.email) {
            // Fallback from email
            const localPart = data.email.split('@')[0];
            if (localPart.includes('.')) {
                data.name = localPart.split('.')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');
            }
        }
    }

    return data;
}
