import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

import sharp from "sharp";

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const token = authHeader.split("Bearer ")[1];

        let decoded;
        try {
            decoded = await adminAuth.verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
        }

        const isAdmin = decoded.admin === true || decoded.role === 'admin' || decoded.email === 'ostasz@mac.com';
        if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const { imageUrl, referer } = await req.json();
        if (!imageUrl || typeof imageUrl !== "string") return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

        const res = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                ...(referer ? { 'Referer': referer } : {})
            },
            redirect: "follow",
        });

        if (!res.ok) return NextResponse.json({ error: `Fetch failed ${res.status}` }, { status: 400 });

        const ct = res.headers.get("content-type") || "";
        if (!ct.startsWith("image/")) {
            console.error(`[FetchPhoto] Invalid Content-Type: ${ct} for URL: ${imageUrl}`);
            return NextResponse.json({ error: "URL is not an image" }, { status: 415 });
        }

        const original = Buffer.from(await res.arrayBuffer());

        // Konwersja + resize + kompresja
        const compressed = await sharp(original)
            .resize({
                width: 320,
                height: 320,
                fit: "inside",
                withoutEnlargement: true,
            })
            .jpeg({
                quality: 70,
                mozjpeg: true,
            })
            .toBuffer();

        // Twardy limit bezpieczeństwa
        if (compressed.length > 250_000) {
            throw new Error("Compressed image still too large");
        }

        const base64 = compressed.toString("base64");

        return NextResponse.json({
            success: true,
            contentType: "image/jpeg",
            base64,
            size: compressed.length,
        });
    } catch (e: any) {
        console.error('[FetchPhoto] Error:', e);
        return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
    }
}
