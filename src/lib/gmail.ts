import { google } from 'googleapis';
import { simpleParser } from 'mailparser';
import Papa from 'papaparse';
import { processEnergyPriceData } from './energy-prices';
import { processFuturesData } from './futures-import';
import fs from 'fs';
import path from 'path';

// Configuration
const SUBJECT_RDN = process.env.GMAIL_IMPORT_SUBJECT || 'Subscription for tge_p';
const SUBJECT_FUTURES = 'Subscription for tge_f';

const logDebug = (msg: string) => {
    try {
        const logPath = path.join(process.cwd(), 'public', 'debug_import.txt');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    } catch (e) {
        console.error('Failed to write debug log', e);
    }
};

export async function checkEmailsAndImport(targetType?: 'RDN' | 'FUTURES') {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        logDebug('Missing GMAIL configuration');
        throw new Error('Missing GMAIL configuration (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)');
    }

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    // 1. List messages with specific subjects (latest only)
    let query = '';
    if (targetType === 'RDN') {
        query = `subject:${SUBJECT_RDN} has:attachment`;
    } else if (targetType === 'FUTURES') {
        query = `subject:"${SUBJECT_FUTURES}" has:attachment`;
    } else {
        query = `(subject:${SUBJECT_RDN} OR subject:"${SUBJECT_FUTURES}") has:attachment`;
    }

    logDebug(`Searching Gmail with query: ${query} (Target: ${targetType || 'ALL'})`);

    const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 1  // Only fetch the latest email
    });

    const messages = listRes.data.messages || [];
    const results = [];

    logDebug(`Found ${messages.length} messages.`);
    console.log(`[Gmail Import] Found ${messages.length} messages matching query: "${query}"`);

    for (const msg of messages) {
        if (!msg.id) continue;

        try {
            // 2. Fetch full message
            const messageRes = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'raw'
            });

            const rawContent = messageRes.data.raw;
            if (!rawContent) continue;

            const decodedBuffer = Buffer.from(rawContent, 'base64url');
            const parsed = await simpleParser(decodedBuffer);
            const subject = parsed.subject || '';

            logDebug(`Processing email: "${subject}" from ${parsed.from?.text}`);
            console.log(`[Gmail Import] Processing email: "${subject}" from ${parsed.from?.text}`);

            let processedFile = false;
            let importType = 'unknown';

            const lowerSubject = subject.toLowerCase();

            if (lowerSubject.includes(SUBJECT_RDN.toLowerCase())) {
                importType = 'RDN';
            } else if (lowerSubject.includes('tge_f')) {
                importType = 'FUTURES';
            } else {
                logDebug(`Unknown subject pattern: ${subject}`);
            }

            // 3. Process Attachments
            for (const attachment of parsed.attachments) {
                if (attachment.contentType === 'text/csv' || attachment.filename?.endsWith('.csv')) {
                    const csvContent = attachment.content.toString('utf-8');
                    logDebug(`Found CSV: ${attachment.filename}, Type: ${importType}, Length: ${csvContent.length}`);
                    logDebug(`CSV Snippet: ${csvContent.substring(0, 200).replace(/\n/g, '\\n')}`);

                    if (importType === 'RDN') {
                        const parseResult = Papa.parse(csvContent, {
                            header: true,
                            skipEmptyLines: true,
                            dynamicTyping: false,
                            delimitersToGuess: [',', ';', '\t', '|']
                        });

                        if (parseResult.data.length > 0) {
                            const importResult = await processEnergyPriceData(parseResult.data, `gmail-import:${parsed.from?.text || 'unknown'}`);
                            results.push({ messageId: msg.id, type: 'RDN', filename: attachment.filename, ...importResult });
                            processedFile = true;
                            logDebug(`RDN Processed: ${JSON.stringify(importResult)}`);
                        }

                    } else if (importType === 'FUTURES') {
                        const importResult = await processFuturesData(csvContent);
                        results.push({ messageId: msg.id, type: 'FUTURES', filename: attachment.filename, ...importResult });
                        processedFile = true;
                        logDebug(`FUTURES Processed: ${JSON.stringify(importResult)}`);
                    }
                }
            }

            // Note: We don't mark as read anymore - we always fetch the latest email
            if (processedFile) {
                logDebug('File processed successfully.');
            } else {
                logDebug('No file processed, NOT marking as read.');
            }

        } catch (err: any) {
            console.error(`[Gmail Import] Error processing message ${msg.id}:`, err);
            results.push({ messageId: msg.id, error: err });
            logDebug(`Error processing message ${msg.id}: ${err.message}`);
        }
    }

    return results;
}
