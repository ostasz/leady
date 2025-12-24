import { ParsedCardData } from './card-parser';

const esc = (v: string) =>
    v
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');

const normalizePhone = (raw?: string | null) => {
    if (!raw) return null;
    let p = raw.trim();

    // 00 -> +
    if (p.startsWith('00')) p = '+' + p.slice(2);

    // keep digits and +
    p = p.replace(/[^\d+]/g, '');

    // allow + only at start
    p = p.replace(/\+/g, (m, offset) => (offset === 0 ? '+' : ''));

    return p || null;
};

function safeNormalize(data: ParsedCardData): ParsedCardData {
    const firstName = data.firstName?.trim() || null;
    const lastName = data.lastName?.trim() || null;

    const name =
        (firstName || lastName)
            ? [firstName, lastName].filter(Boolean).join(' ')
            : (data.name?.trim() || null);

    return {
        ...data,
        firstName,
        lastName,
        name: name || 'Imported Contact',
        email: data.email?.toLowerCase().trim() || null,
        phone: normalizePhone(data.phone),
        company: data.company?.trim() || null,
        jobTitle: data.jobTitle?.trim() || null,
        website: data.website?.trim() || null,
        address: data.address?.trim() || null,
    };
}

export function generateVCard(input: ParsedCardData): string {
    const data = safeNormalize(input);

    const parts: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

    // Name
    const fn = esc(data.name || 'Imported Contact');
    const nLast = esc(data.lastName || '');
    const nFirst = esc(data.firstName || '');

    parts.push(`N:${nLast};${nFirst};;;`);
    parts.push(`FN:${fn}`);

    // Company & Job
    if (data.company) parts.push(`ORG:${esc(data.company)}`);
    if (data.jobTitle) parts.push(`TITLE:${esc(data.jobTitle)}`);

    // Contact
    if (data.phone) parts.push(`TEL;TYPE=CELL:${data.phone}`);
    if (data.email) parts.push(`EMAIL;TYPE=WORK:${esc(data.email)}`);
    if (data.website) parts.push(`URL:${esc(data.website)}`);

    // Address (opcjonalnie, ale masz pole)
    if (data.address) parts.push(`ADR;TYPE=WORK:;;${esc(data.address)};;;;`);

    // Note
    parts.push(`NOTE:${esc('Zeskanowano przez SalesApp')}`);

    parts.push('END:VCARD');

    // vCard prefers CRLF; większość importerów ogarnie \n, ale CRLF jest pewniejsze.
    return parts.join('\r\n');
}

export function downloadVCard(data: ParsedCardData, filename = 'contact.vcf') {
    const vcard = generateVCard(data);
    const blob = new Blob([vcard], { type: 'text/vcard; charset=utf-8' });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}
