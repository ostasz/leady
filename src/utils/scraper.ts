
/**
 * Utility to extract business data (NIP, Phone, Email) from a given URL.
 */
export async function scrapeCompanyData(url: string | null) {
    if (!url) return { nip: null, phone: null, email: null };

    // Ensure URL has protocol
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        clearTimeout(timeoutId);

        if (!res.ok) return { nip: null, phone: null, email: null };

        const html = await res.text();

        let nip = extractNip(html);
        let phone = extractPhone(html);
        let email = extractEmail(html);

        // If NIP is missing, try to find a "Contact" page link and scrape it
        if (!nip) {
            const contactLink = findContactLink(html, url);
            if (contactLink) {
                try {
                    const contactRes = await fetch(contactLink, {
                        signal: AbortSignal.timeout(5000),
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        }
                    });

                    if (contactRes.ok) {
                        const contactHtml = await contactRes.text();
                        const contactNip = extractNip(contactHtml);
                        const contactPhone = extractPhone(contactHtml);
                        const contactEmail = extractEmail(contactHtml);

                        if (contactNip) nip = contactNip;
                        if (contactPhone && !phone) phone = contactPhone;
                        if (contactEmail && !email) email = contactEmail;
                    }
                } catch (e) {
                    console.warn('Failed to scrape contact page:', contactLink);
                }
            }
        }

        return { nip, phone, email };

    } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return { nip: null, phone: null, email: null };
    }
}

function findContactLink(html: string, baseUrl: string): string | null {
    // Look for links containing "kontakt", "contact"
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        const text = match[2].toLowerCase();

        if (text.includes('kontakt') || text.includes('contact') || href.includes('kontakt') || href.includes('contact')) {
            // Resolve relative URLs
            try {
                return new URL(href, baseUrl).toString();
            } catch (e) {
                return null;
            }
        }
    }
    return null;
}

function extractNip(html: string): string | null {
    // Pattern 1: Explicit "NIP" label with various separators
    // Matches: NIP: 123-456-78-90, NIP 1234567890, NIP: 123 456 78 90
    const nipLabelRegex = /NIP\s*:?\s*(\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2})/i;
    const match = html.match(nipLabelRegex);

    if (match) {
        const raw = match[1].replace(/\D/g, '');
        if (isValidNip(raw)) return formatNip(raw);
    }

    // Pattern 2: Just 10 digits (riskier, so we validate strictly)
    // We look for 10 digits surrounded by non-digits to avoid phone numbers or longer IDs
    const genericRegex = /(?<!\d)(\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2})(?!\d)/g;
    let m;
    while ((m = genericRegex.exec(html)) !== null) {
        const raw = m[1].replace(/\D/g, '');
        if (isValidNip(raw)) return formatNip(raw);
    }

    return null;
}

function extractPhone(html: string): string | null {
    // Look for tel: links first as they are most reliable
    const telLinkRegex = /href=["']tel:([+0-9\s-]+)["']/i;
    const linkMatch = html.match(telLinkRegex);
    if (linkMatch) return linkMatch[1].trim();

    // Look for common Polish phone patterns
    // +48 123 456 789, 123-456-789, (22) 123 45 67
    const phoneRegex = /(?:\+48\s?)?\(?\d{2,3}\)?[-\s]?\d{3}[-\s]?\d{2,3}[-\s]?\d{2,3}/;
    const match = html.match(phoneRegex);

    return match ? match[0].trim() : null;
}

function extractEmail(html: string): string | null {
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/;
    const match = html.match(emailRegex);
    return match ? match[0] : null;
}

function isValidNip(nip: string): boolean {
    if (nip.length !== 10) return false;

    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let sum = 0;

    for (let i = 0; i < 9; i++) {
        sum += parseInt(nip[i]) * weights[i];
    }

    const control = sum % 11;
    const lastDigit = parseInt(nip[9]);

    return control === lastDigit;
}

function formatNip(nip: string): string {
    // Format as XXX-XXX-XX-XX
    return `${nip.slice(0, 3)}-${nip.slice(3, 6)}-${nip.slice(6, 8)}-${nip.slice(8, 10)}`;
}
