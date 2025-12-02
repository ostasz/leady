import { GusClient } from '../src/lib/gus-client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testGus() {
    console.log('Testing GUS Client...');

    if (!process.env.GUS_API_KEY) {
        console.error('Error: GUS_API_KEY not found in environment');
        process.exit(1);
    }

    process.env.GUS_API_URL = 'https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';
    process.env.GUS_API_KEY = 'abcde12345abcde12345';

    try {
        const client = new GusClient();
        // Test with Google Poland NIP
        const nip = '5261040828';
        console.log(`Searching for NIP: ${nip}`);

        const data = await client.searchByNip(nip);

        if (data) {
            console.log('Success! Data retrieved:');
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log('No data found (this might be valid if the NIP is wrong, but unexpected for Google Poland)');
        }
    } catch (error: any) {
        console.error('Test failed:', error.message);
    }
}

testGus();
