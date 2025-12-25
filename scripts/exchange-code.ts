import { google } from 'googleapis';
import * as readline from 'readline';
import dotenv from 'dotenv';
dotenv.config();

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

    const code = await ask('Enter the code: ');

    const { tokens } = await oAuth2Client.getToken(code);

    console.log('REFRESH_TOKEN:', tokens.refresh_token);
    rl.close();
}

main().catch(console.error);
