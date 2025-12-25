import { google } from 'googleapis';
import { simpleParser } from 'mailparser';
import Papa from 'papaparse';
import { processEnergyPriceData } from './energy-prices';

// Configuration
const REQUIRED_SUBJECT = process.env.GMAIL_IMPORT_SUBJECT || 'tge_p'; // Customize or defaulting
// If we want to be strict, we can filter by sender too.

export async function checkEmailsAndImport() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing GMAIL configuration (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)');
    }

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // 1. List unread messages with specific subject
    // q: 'is:unread subject:RAPORT_CEN_RDN has:attachment'
    const query = `is:unread subject:${REQUIRED_SUBJECT} has:attachment`;
    const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 5 // Process max 5 emails at a time to check
    });

    const messages = listRes.data.messages || [];
    const results = [];

    console.log(`[Gmail Import] Found ${messages.length} messages matching query: "${query}"`);

    for (const msg of messages) {
        if (!msg.id) continue;

        try {
            // 2. Fetch full message
            const messageRes = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'raw' // raw format works best with mailparser
            });

            const rawContent = messageRes.data.raw;
            if (!rawContent) continue;

            // Decode base64url to string (googleapis returns base64url)
            // But mailparser expects a Buffer or stream
            const decodedBuffer = Buffer.from(rawContent, 'base64url');

            // 3. Parse Email
            const parsed = await simpleParser(decodedBuffer);

            console.log(`[Gmail Import] Processing email: "${parsed.subject}" from ${parsed.from?.text}`);

            let processedFile = false;

            // 4. Find CSV/XLSX attachments
            for (const attachment of parsed.attachments) {
                if (attachment.contentType === 'text/csv' || attachment.filename?.endsWith('.csv')) {
                    const csvContent = attachment.content.toString('utf-8');

                    // Parse CSV
                    const parseResult = Papa.parse(csvContent, {
                        header: true,
                        skipEmptyLines: true,
                        dynamicTyping: false // Keep as strings to safely parse Polish numbers later
                    });

                    if (parseResult.errors.length > 0) {
                        console.warn(`[Gmail Import] CSV Parsing errors in file ${attachment.filename}:`, parseResult.errors);
                    }

                    if (parseResult.data.length > 0) {
                        // 5. Process Data
                        const importResult = await processEnergyPriceData(parseResult.data, `gmail-import:${parsed.from?.text || 'unknown'}`);
                        results.push({
                            messageId: msg.id,
                            filename: attachment.filename,
                            ...importResult
                        });
                        processedFile = true;
                    }
                }
            }

            // 6. Mark as read (remove UNREAD label)
            // Only if we actually processed something or if we want to acknowledge we saw it.
            // Usually we mark as read to avoid loop.
            await gmail.users.messages.modify({
                userId: 'me',
                id: msg.id,
                requestBody: {
                    removeLabelIds: ['UNREAD']
                }
            });

        } catch (err) {
            console.error(`[Gmail Import] Error processing message ${msg.id}:`, err);
            results.push({ messageId: msg.id, error: err });
        }
    }

    return results;
}
