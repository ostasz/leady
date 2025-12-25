import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify'];

async function main() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be in .env');
        process.exit(1);
    }

    const oAuth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'http://localhost'
    );

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log(authUrl);
}

main().catch(console.error);
