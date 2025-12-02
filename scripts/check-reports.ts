import { GusClient } from '../src/lib/gus-client';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkReports() {
    console.log('Checking GUS Reports (Test Env)...');
    const client = new GusClient();

    // Override env vars for testing
    process.env.GUS_API_URL = 'https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';
    process.env.GUS_API_KEY = 'abcde12345abcde12345';
    const regon = '000331501'; // GUS (Test Env)

    const reports = [
        'BIR11OsPrawnaOsobyDoReprezentacji',
        'BIR11OsPrawnaOrganWladzy',
        'BIR11OsPrawnaWspolnicy',
        'PublDaneRaportPrawna',
        'PublDaneRaportDzialalnoscPrawnej',
        'BIR11OsPrawnaReprezentacja',
        'BIR11OsPrawna'
    ];

    for (const report of reports) {
        console.log(`\nTesting report: ${report}`);
        // @ts-ignore - accessing private method for testing
        const data = await client.getFullReport(regon, report);
        if (data) {
            console.log(`SUCCESS: ${report} returned data.`);
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(`FAILED: ${report} returned no data.`);
        }
    }
}

checkReports();
