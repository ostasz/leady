import { google } from 'googleapis';
import * as readline from 'readline';

// Instructions:
// 1. Run this script: npx tsx scripts/get-gmail-token.ts
// 2. Paste your Client ID and Client Secret when prompted.
// 3. Open the generated link in your browser.
// 4. Log in with your Gmail account and allow access.
// 5. Copy the code from the redirected page and paste it here.
// 6. Copy the REFRESH TOKEN to your .env file.

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function ask(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}

async function main() {
    console.log('--- Gmail OAuth2 Token Generator ---');
    console.log('This script will help you get a Refresh Token for the application.\n');

    const clientId = await ask('Enter your Client ID: ');
    const clientSecret = await ask('Enter your Client Secret: ');

    if (!clientId || !clientSecret) {
        console.error('Error: Client ID and Client Secret are required.');
        process.exit(1);
    }

    const oAuth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost' // Redirect URI for Desktop App
    );

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial for getting a Refresh Token
        scope: SCOPES,
    });

    console.log('\nAuthorize this app by visiting this url:\n');
    console.log(authUrl);
    console.log('\n');

    const code = await ask('Enter the code from that page here: ');

    try {
        const { tokens } = await oAuth2Client.getToken(code);

        console.log('\n--- SUCCESS! ---\n');
        console.log('Add these lines to your .env file:\n');
        console.log(`GMAIL_CLIENT_ID="${clientId}"`);
        console.log(`GMAIL_CLIENT_SECRET="${clientSecret}"`);
        console.log(`GMAIL_REFRESH_TOKEN="${tokens.refresh_token}"`);

        if (!tokens.refresh_token) {
            console.warn('\nWARNING: No refresh token returned. Did you already authorize this app? You might need to revoke access in Google Account permissions and try again to see the refresh token.');
        }

    } catch (error: any) {
        console.error('\nError retrieving access token:', error.message);
    } finally {
        rl.close();
    }
}

main().catch(console.error);
