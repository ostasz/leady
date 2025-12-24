import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

import sharp from "sharp";

function sniffImageType(buf: Buffer): "jpeg" | "png" | "webp" | null {
    if (buf.length < 12) return null;
    // JPEG FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
    // PNG 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
    // WEBP: "RIFF....WEBP"
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
    return null;
}


function normalizeUrl(u: string) {
    const s = u.trim();
    if (!/^https?:\/\//i.test(s)) return `https://${s}`;
    return s;
}

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

        const url = normalizeUrl(imageUrl);

        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SalesProspectingApp/1.0)',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                ...(referer ? { 'Referer': referer } : {})
            },
        });

        if (!res.ok) return NextResponse.json({ error: `Fetch failed ${res.status}` }, { status: 400 });

        const ct = (res.headers.get("content-type") || "").toLowerCase();
        const arr = await res.arrayBuffer();
        const buf = Buffer.from(arr);

        const sniffed = sniffImageType(buf);
        const isImageHeader = ct.startsWith("image/");

        if (!isImageHeader && !sniffed) {
            const head = buf.toString("utf8", 0, 200);
            console.error(`[FetchPhoto] Invalid Content-Type: ${ct}, Sniff failed. Head: ${head.substring(0, 50)}...`);
            return NextResponse.json({
                error: "URL is not an image",
                details: { contentType: ct, status: res.status, sample: head }
            }, { status: 415 });
        }

        // Konwersja + resize + kompresja
        const compressed = await sharp(buf)
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
