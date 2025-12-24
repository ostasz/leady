import { NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { adminAuth } from "@/lib/firebase-admin";
import { logInfo, logError, logWarn } from "@/lib/logger";
import { callWithRetry } from "@/lib/retry";
import { logUsage } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60; // Increased duration for scraping + AI

// Initialize Vertex AI
const vertexAI = new VertexAI({
    project: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || 'ekovoltis-portal',
    location: "europe-central2",
    googleAuthOptions: {
        credentials: {
            client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL,
            private_key: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, "\n"),
        },
    },
});

function cleanText(html: string) {
    // Ultra-simple cleaning for "About Us" content
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 15000); // Token limit protection
}

async function fetchPageText(url: string) {
    logInfo(`[Enrich] Fetching: ${url}`);
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(8000) // 8s timeout
        });
        if (!res.ok) throw new Error(`Fetch status: ${res.status}`);
        const html = await res.text();
        return cleanText(html);
    } catch (error: any) {
        logWarn(`[Enrich] Web fetch failed for ${url}: ${error.message}`);
        return ""; // Soft fail, proceed with just AI knowledge if web fails
    }
}

async function summarizeCompany(input: { company?: string; website?: string; rawText?: string; pageText?: string }) {
    const model = vertexAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
        },
    });

    const prompt = `
Zadanie: Jako analityk biznesowy, uzupełnij notatkę o firmie (B2B).
Wejście: nazwa firmy, strona WWW (opcjonalnie), OCR z wizytówki (opcjonalnie), tekst ze strony (opcjonalnie).

Zwróć CZYSTY JSON:
{
  "companySummary": string,         // 3-6 krótkich, konkretnych zdań o działalności firmy po polsku. Skup się na tym co robią.
  "industry": string|null,          // np. "Fotowoltaika", "Produkcja mebli", "Logistyka"
  "hqOrLocation": string|null,      // Siedziba główna lub miasto
  "keyLinks": { 
      "website": string|null, 
      "linkedin": string|null 
  }
}

Dane wejściowe:
- Firma: ${input.company ?? "Nieznana"}
- Website: ${input.website ?? "Brak"}
- OCR Wizytówki: """${(input.rawText ?? "").slice(0, 2000)}"""
- Treść strony WWW: """${(input.pageText ?? "").slice(0, 12000)}"""
`;

    // Use retry logic for robustness
    const result: any = await callWithRetry(() => model.generateContent(prompt));

    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: any) => (p as any).text ?? "").join("").trim();

    if (!text) throw new Error("Empty LLM response");

    try {
        return JSON.parse(text);
    } catch (e) {
        // Sometimes models wrap json in markdown backticks despite mime type
        const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleanJson);
    }
}

export async function POST(req: Request) {
    try {
        // 1. Auth Check (Admin Only)
        const authHeader = req.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const token = authHeader.split("Bearer ")[1];
        let uid = '';
        let isAdmin = false;

        try {
            const decoded = await adminAuth.verifyIdToken(token);
            uid = decoded.uid;
            isAdmin = decoded.admin === true || decoded.role === 'admin' || decoded.email === 'ostasz@mac.com';
        } catch (e) {
            return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
        }

        if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        // 2. Process Request
        const { company, website, rawText } = await req.json();
        const requestId = crypto.randomUUID();

        logInfo(`[Enrich] Start request ${requestId}`, { company, website, uid });

        let pageText = "";
        if (website && typeof website === "string" && website.includes('.')) {
            let url = website.trim();
            if (!url.startsWith('http')) url = 'https://' + url;
            pageText = await fetchPageText(url);
        }

        const enrichment = await summarizeCompany({ company, website, rawText, pageText });

        // 3. Log Usage (Vertex AI)
        await logUsage(uid, 'vertex-gemini', 'enrich_company', 1, { company });

        logInfo(`[Enrich] Success ${requestId}`);
        return NextResponse.json({ success: true, enrichment });

    } catch (e: any) {
        logError(`[Enrich] Error: ${e.message}`, { stack: e.stack });
        return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
    }
}
