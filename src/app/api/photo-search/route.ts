import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

type BraveImageResult = {
    url?: string;          // direct image url
    thumbnail?: { src?: string };
    source?: string;       // page url where image appears
    title?: string;
    width?: number;
    height?: number;
};

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const token = authHeader.split("Bearer ")[1];

        let decoded;
        try {
            decoded = await adminAuth.verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
        }

        if (!decoded.admin && decoded.email !== "ostasz@mac.com") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { firstName, lastName, company, country = "PL", lang = "pl" } = await req.json();

        if (!firstName || !lastName || !company) {
            return NextResponse.json(
                { error: "firstName, lastName, company are required" },
                { status: 400 }
            );
        }

        const apiKey = process.env.BRAVE_SEARCH_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Missing BRAVE_SEARCH_API_KEY" }, { status: 500 });
        }

        // Helper to clean company name
        const cleanCompany = (name: string) => {
            return name
                .replace(/\s+(Sp\.|Spółka)\s+(z\s+o\.o\.|z\s+ograniczoną\s+odpowiedzialnością|komandytowa|akcyjna|jawna|j\.|k\.|a\.|z\.o\.o)/gi, '')
                .replace(/\s+(S\.A\.|GmbH|Inc\.|Ltd\.|LLC|S\.J\.)/gi, '')
                .trim();
        };

        const companySimple = cleanCompany(company);

        // zapytanie: "Imie Nazwisko" CompanySimple LinkedIn
        // Dodajemy "LinkedIn" bo tam zazwyczaj są zdjęcia profilowe, a Brave dobrze indeksuje LinkedIn.
        const q = `"${firstName} ${lastName}" ${companySimple} LinkedIn`;

        const url = new URL("https://api.search.brave.com/res/v1/images/search");
        url.searchParams.set("q", q);
        url.searchParams.set("count", "12");
        url.searchParams.set("country", country);        // np. PL
        url.searchParams.set("search_lang", lang);       // pl/en

        // Safe search off for better profile matching? Default is moderate. 
        // Let's explicitly set safe_search to generic strict/moderate if needed, but default usually ok.

        const res = await fetch(url.toString(), {
            headers: {
                "Accept": "application/json",
                "X-Subscription-Token": apiKey,
            },
        });

        const body = await res.json().catch(() => null);

        if (!res.ok) {
            console.error("Brave API Error:", body);
            return NextResponse.json(
                { error: "Brave API error", status: res.status, details: body },
                { status: 502 }
            );
        }

        const results: BraveImageResult[] = body?.results ?? [];

        // Minimalny filtr jakości
        const candidates = results
            .map((r) => ({
                imageUrl: r.url ?? null,
                thumbUrl: r.thumbnail?.src ?? null,
                sourcePage: r.source ?? null,
                title: r.title ?? null,
                width: r.width ?? null,
                height: r.height ?? null,
            }))
            .filter((c) => c.imageUrl && c.thumbUrl && c.sourcePage)
            .slice(0, 10);

        return NextResponse.json({ success: true, q, candidates });
    } catch (e: any) {
        console.error("Internal Error:", e);
        return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
    }
}
