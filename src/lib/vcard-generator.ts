import { ParsedCardData } from './card-parser';

export function generateVCard(data: ParsedCardData): string {
    const parts = [
        'BEGIN:VCARD',
        'VERSION:3.0'
    ];

    // Name
    if (data.name) {
        const nameParts = data.name.split(' ');
        const firstName = nameParts.length > 0 ? nameParts[0] : '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        parts.push(`N:${lastName};${firstName};;;`);
        parts.push(`FN:${data.name}`);
    } else if (data.company) {
        parts.push(`FN:${data.company}`);
    }

    // Company & Job
    if (data.company) parts.push(`ORG:${data.company}`);
    if (data.jobTitle) parts.push(`TITLE:${data.jobTitle}`);

    // Contact
    if (data.phone) parts.push(`TEL;TYPE=CELL:${data.phone}`);
    if (data.email) parts.push(`EMAIL;TYPE=WORK:${data.email}`);
    if (data.website) parts.push(`URL:${data.website}`);

    // Note (Source)
    parts.push(`NOTE:Zeskanowano przez SalesApp`);

    parts.push('END:VCARD');

    return parts.join('\n');
}

export function downloadVCard(data: ParsedCardData, filename = 'contact.vcf') {
    const vcard = generateVCard(data);
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}
