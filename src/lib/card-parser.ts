/**
 * Parses raw text from Google Vision API into structured contact data.
 * Heuristic-based approach (Regex + Keyword Matching).
 */

export interface ParsedCardData {
    name?: string;
    email?: string;
    phone?: string;
    website?: string;
    company?: string;
    jobTitle?: string;
    fullText: string;
}

export function parseBusinessCard(text: string): ParsedCardData {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const data: ParsedCardData = { fullText: text };

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
        // Email
        if (!data.email) {
            const emailMatch = line.match(emailRegex);
            if (emailMatch) {
                data.email = emailMatch[0];
            }
        }

        // Phone
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
            const isCompany = companySuffixes.some(suffix => line.includes(suffix));
            if (isCompany) {
                data.company = line;
            }
        }

        // Job Title
        if (!data.jobTitle) {
            const isTitle = jobTitles.some(title => line.toLowerCase().includes(title.toLowerCase()));
            if (isTitle) {
                data.jobTitle = line;
            }
        }
    }

    // 4. Heuristics for Name
    if (!data.name) {
        const potentialName = potentialInfoLines.find(line => {
            const notCompany = line !== data.company;
            const notTitle = line !== data.jobTitle;
            const notAddress = !line.match(addressRegex);
            const properLength = line.split(' ').length >= 2 && line.split(' ').length <= 4;
            const startsCap = /^[A-Z]/.test(line);

            return notCompany && notTitle && notAddress && properLength && startsCap;
        });

        if (potentialName) {
            data.name = potentialName;
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
