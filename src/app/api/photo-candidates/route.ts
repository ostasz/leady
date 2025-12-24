import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

function toAbs(base: string, u: string) {
    try { return new URL(u, base).toString(); } catch { return null; }
}

function normalizeUrl(u: string): string {
    const s = u.trim();
    if (!s) throw new Error("Empty URL");
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
}

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const token = authHeader.split("Bearer ")[1];

        // Auth Check
        let decoded;
        try {
            decoded = await adminAuth.verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
        }

        // Admin Check
        const isAdmin = decoded.admin === true || decoded.role === 'admin' || decoded.email === 'ostasz@mac.com';
        if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        let { pageUrl } = await req.json();
        if (!pageUrl || typeof pageUrl !== "string") return NextResponse.json({ error: "pageUrl required" }, { status: 400 });

        pageUrl = normalizeUrl(pageUrl);

        const res = await fetch(pageUrl, {
            redirect: "follow",
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!res.ok) return NextResponse.json({ error: `Fetch failed ${res.status}` }, { status: 400 });
        const html = await res.text();

        // Extract og:image
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i);
        const ogImage = ogMatch?.[1] ? toAbs(pageUrl, ogMatch[1]) : null;

        // Extract <img> src
        const imgSrcs = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi))
            .map(m => m[1])
            .map(u => toAbs(pageUrl, u))
            .filter(Boolean) as string[];

        // Filter out probable icons/logos/svgs
        const filtered = imgSrcs
            .filter(u => !u.includes("logo") && !u.includes("icon") && !u.endsWith(".svg") && !u.includes("sprite"))
            .slice(0, 20);

        const candidates = Array.from(new Set([ogImage, ...filtered].filter(Boolean))) as string[];

        return NextResponse.json({ success: true, candidates });
    } catch (e: any) {
        console.error('[PhotoCandidates] Error:', e);
        return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
    }
}
