import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) return new NextResponse("Missing url", { status: 400 });

    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; SalesProspectingApp/1.0)",
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            },
        });

        if (!res.ok) return new NextResponse("Upstream error", { status: 502 });

        const ct = res.headers.get("content-type") || "image/jpeg";
        const buf = Buffer.from(await res.arrayBuffer());

        return new NextResponse(buf, {
            status: 200,
            headers: {
                "Content-Type": ct,
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (e) {
        console.error("[ImageProxy] Error fetching url:", url, e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
