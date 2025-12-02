import axios from 'axios';
import { parseStringPromise } from 'xml2js';

export interface GusCompanyData {
  name: string;
  nip: string;
  regon: string;
  address: string;
  city: string;
  zipCode: string;
  province: string;
  email?: string;
  phone?: string;
  pkd?: string[];
  management?: string[];
}

export class GusClient {
  private sessionKey: string | null = null;

  private extractXmlFromMultipart(data: string): string {
    // Check if it's a multipart response
    if (data.includes('--uuid:')) {
      // Find the start of the SOAP Envelope
      const soapStart = data.indexOf('<s:Envelope');
      if (soapStart !== -1) {
        // Find the end of the SOAP Envelope
        const soapEnd = data.indexOf('</s:Envelope>', soapStart);
        if (soapEnd !== -1) {
          return data.substring(soapStart, soapEnd + 13); // +13 for length of </s:Envelope>
        }
      }
    }
    return data;
  }

  private async login(): Promise<string> {
    if (this.sessionKey) return this.sessionKey;

    const url = process.env.GUS_API_URL || 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';
    const key = process.env.GUS_API_KEY;

    const soapBody = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07">
        <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
          <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj</wsa:Action>
          <wsa:To>${url}</wsa:To>
        </soap:Header>
        <soap:Body>
          <ns:Zaloguj>
            <ns:pKluczUzytkownika>${key}</ns:pKluczUzytkownika>
          </ns:Zaloguj>
        </soap:Body>
      </soap:Envelope>
    `;

    try {
      const response = await axios.post(url, soapBody, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/Zaloguj"',
        },
      });

      const cleanXml = this.extractXmlFromMultipart(response.data);
      const result = await parseStringPromise(cleanXml);
      // Navigate the XML structure to find the session key
      // Structure: Envelope -> Body -> ZalogujResponse -> ZalogujResult
      const loginResult = result['s:Envelope']['s:Body'][0]['ZalogujResponse'][0]['ZalogujResult'][0];

      if (!loginResult) {
        throw new Error('Failed to retrieve session key from GUS');
      }

      this.sessionKey = loginResult;
      return this.sessionKey as string;
    } catch (error) {
      console.error('GUS Login Error:', error);
      throw new Error('Failed to login to GUS API');
    }
  }

  private async getFullReport(regon: string, reportName: string): Promise<any> {
    const session = await this.login();
    const url = process.env.GUS_API_URL || 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';

    const soapBody = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
        <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
          <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DanePobierzPelnyRaport</wsa:Action>
          <wsa:To>${url}</wsa:To>
        </soap:Header>
        <soap:Body>
          <ns:DanePobierzPelnyRaport>
            <ns:pRegon>${regon}</ns:pRegon>
            <ns:pNazwaRaportu>${reportName}</ns:pNazwaRaportu>
          </ns:DanePobierzPelnyRaport>
        </soap:Body>
      </soap:Envelope>
    `;

    try {
      const response = await axios.post(url, soapBody, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DanePobierzPelnyRaport"',
          'sid': session,
        },
      });

      const cleanXml = this.extractXmlFromMultipart(response.data);
      const result = await parseStringPromise(cleanXml);

      const reportResultXml = result['s:Envelope']['s:Body'][0]['DanePobierzPelnyRaportResponse'][0]['DanePobierzPelnyRaportResult'][0];

      if (!reportResultXml) return null;

      const reportResult = await parseStringPromise(reportResultXml);

      // Check for API error response
      if (reportResult.root.dane && reportResult.root.dane[0] && reportResult.root.dane[0].ErrorCode) {
        return null;
      }

      return reportResult.root.dane;
    } catch (error) {
      console.error(`GUS Report Error (${reportName}):`, error);
      return null;
    }
  }

  public async searchByNip(nip: string): Promise<GusCompanyData | null> {
    const session = await this.login();
    const url = process.env.GUS_API_URL || 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';

    const soapBody = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
        <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
          <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty</wsa:Action>
          <wsa:To>${url}</wsa:To>
        </soap:Header>
        <soap:Body>
          <ns:DaneSzukajPodmioty>
            <ns:pParametryWyszukiwania>
              <dat:Nip>${nip}</dat:Nip>
            </ns:pParametryWyszukiwania>
          </ns:DaneSzukajPodmioty>
        </soap:Body>
      </soap:Envelope>
    `;

    try {
      const response = await axios.post(url, soapBody, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty"',
          'sid': session,
        },
      });

      const cleanXml = this.extractXmlFromMultipart(response.data);
      const result = await parseStringPromise(cleanXml);

      // Structure: Envelope -> Body -> DaneSzukajPodmiotyResponse -> DaneSzukajPodmiotyResult
      const searchResultXml = result['s:Envelope']['s:Body'][0]['DaneSzukajPodmiotyResponse'][0]['DaneSzukajPodmiotyResult'][0];

      if (!searchResultXml) return null;

      // The result inside is another XML string, we need to parse it again
      const searchResult = await parseStringPromise(searchResultXml);

      if (!searchResult.root || !searchResult.root.dane) return null;

      const company = searchResult.root.dane[0];
      const regon = company.Regon ? company.Regon[0] : '';
      const type = company.Typ ? company.Typ[0] : ''; // P - legal entity, F - natural person

      let pkd: string[] = [];
      let management: string[] = [];

      let email: string | undefined;
      let phone: string | undefined;

      if (regon) {
        if (type === 'P') {
          // --- Legal Entity (Osoba Prawna) ---

          // Fetch Basic Legal Report for Email/Phone
          const legalData = await this.getFullReport(regon, 'BIR11OsPrawna');
          if (legalData && legalData[0]) {
            email = legalData[0].praw_adresEmail ? legalData[0].praw_adresEmail[0] : undefined;
            phone = legalData[0].praw_numerTelefonu ? legalData[0].praw_numerTelefonu[0] : undefined;
          }

          // Fetch PKD
          const pkdData = await this.getFullReport(regon, 'BIR11OsPrawnaPkd');
          if (pkdData) {
            pkd = pkdData.map((item: any) => `${item.praw_pkdKod ? item.praw_pkdKod[0] : ''} - ${item.praw_pkdNazwa ? item.praw_pkdNazwa[0] : ''}`);
          }

          // Fetch Management
          const mgmtData = await this.getFullReport(regon, 'BIR11OsPrawnaOsobyDoReprezentacji');
          if (mgmtData) {
            management = mgmtData.map((item: any) => {
              const name = `${item.praw_imie1 ? item.praw_imie1[0] : ''} ${item.praw_nazwisko ? item.praw_nazwisko[0] : ''}`.trim();
              const role = item.praw_funkcja ? item.praw_funkcja[0] : '';
              return role ? `${name} (${role})` : name;
            }).filter((s: string) => s.length > 0);
          }

        } else if (type === 'F') {
          // --- Natural Person (Osoba Fizyczna) ---

          // Fetch General Data for Name (Owner)
          const fizData = await this.getFullReport(regon, 'BIR11OsFizycznaDaneOgolne');
          if (fizData && fizData[0]) {
            const ownerName = `${fizData[0].fiz_imie1 ? fizData[0].fiz_imie1[0] : ''} ${fizData[0].fiz_nazwisko ? fizData[0].fiz_nazwisko[0] : ''}`.trim();
            if (ownerName) {
              management.push(`${ownerName} (Właściciel)`);
            }
          }

          // Fetch PKD
          const pkdData = await this.getFullReport(regon, 'BIR11OsFizycznaPkd');
          if (pkdData) {
            pkd = pkdData.map((item: any) => `${item.fiz_pkd_Kod ? item.fiz_pkd_Kod[0] : ''} - ${item.fiz_pkd_Nazwa ? item.fiz_pkd_Nazwa[0] : ''}`);
          }

          // Fetch CEIDG Data for Contact Info (Email/Phone often here)
          const ceidgData = await this.getFullReport(regon, 'BIR11OsFizycznaDzialalnoscCeidg');
          if (ceidgData && ceidgData[0]) {
            // Note: GUS often hides contact info for natural persons, but we try anyway
            // Field names might vary, usually not exposed in public BIR1.1 for privacy
          }
        }
      }

      return {
        name: company.Nazwa ? company.Nazwa[0] : '',
        nip: company.Nip ? company.Nip[0] : '',
        regon: regon,
        address: `${company.Ulica ? company.Ulica[0] : ''} ${company.NrNieruchomosci ? company.NrNieruchomosci[0] : ''}`,
        city: company.Miejscowosc ? company.Miejscowosc[0] : '',
        zipCode: company.KodPocztowy ? company.KodPocztowy[0] : '',
        province: company.Wojewodztwo ? company.Wojewodztwo[0] : '',
        email,
        phone,
        pkd,
        management,
      };

    } catch (error) {
      console.error('GUS Search Error:', error);
      throw new Error('Failed to search GUS API');
    }
  }
  public async searchByName(name: string, city?: string): Promise<GusCompanyData | null> {
    const session = await this.login();
    const url = process.env.GUS_API_URL || 'https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc';

    // Clean up name for search (remove Sp. z o.o. etc to improve matching)
    // Actually, GUS search is "contains", so full name is usually fine, but cleaner is better.
    // Let's use the raw name provided for now.

    const soapBody = `
      <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://CIS/BIR/PUBL/2014/07" xmlns:dat="http://CIS/BIR/PUBL/2014/07/DataContract">
        <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
          <wsa:Action>http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty</wsa:Action>
          <wsa:To>${url}</wsa:To>
        </soap:Header>
        <soap:Body>
          <ns:DaneSzukajPodmioty>
            <ns:pParametryWyszukiwania>
              <dat:Nazwa>${name}</dat:Nazwa>
              ${city ? `<dat:Miejscowosc>${city}</dat:Miejscowosc>` : ''}
            </ns:pParametryWyszukiwania>
          </ns:DaneSzukajPodmioty>
        </soap:Body>
      </soap:Envelope>
    `;

    try {
      const response = await axios.post(url, soapBody, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://CIS/BIR/PUBL/2014/07/IUslugaBIRzewnPubl/DaneSzukajPodmioty"',
          'sid': session,
        },
      });

      const cleanXml = this.extractXmlFromMultipart(response.data);
      const result = await parseStringPromise(cleanXml);

      const searchResultXml = result['s:Envelope']['s:Body'][0]['DaneSzukajPodmiotyResponse'][0]['DaneSzukajPodmiotyResult'][0];

      if (!searchResultXml) return null;

      const searchResult = await parseStringPromise(searchResultXml);

      if (!searchResult.root || !searchResult.root.dane) return null;

      // GUS might return multiple results. We'll take the first one that looks active or matches best.
      // For now, just take the first one.
      const company = searchResult.root.dane[0];

      // Reuse the logic to fetch details (this should be refactored into a helper, but for now copy-paste/adapt)
      // Actually, let's just call a private helper to process the company object
      return this.processCompanyData(company);

    } catch (error) {
      console.error('GUS Search By Name Error:', error);
      return null; // Don't throw, just return null if not found
    }
  }

  private async processCompanyData(company: any): Promise<GusCompanyData> {
    const regon = company.Regon ? company.Regon[0] : '';
    const type = company.Typ ? company.Typ[0] : ''; // P - legal entity, F - natural person

    let pkd: string[] = [];
    let management: string[] = [];
    let email: string | undefined;
    let phone: string | undefined;

    if (regon) {
      if (type === 'P') {
        const legalData = await this.getFullReport(regon, 'BIR11OsPrawna');
        if (legalData && legalData[0]) {
          email = legalData[0].praw_adresEmail ? legalData[0].praw_adresEmail[0] : undefined;
          phone = legalData[0].praw_numerTelefonu ? legalData[0].praw_numerTelefonu[0] : undefined;
        }
        const pkdData = await this.getFullReport(regon, 'BIR11OsPrawnaPkd');
        if (pkdData) {
          pkd = pkdData.map((item: any) => `${item.praw_pkdKod ? item.praw_pkdKod[0] : ''} - ${item.praw_pkdNazwa ? item.praw_pkdNazwa[0] : ''}`);
        }
        const mgmtData = await this.getFullReport(regon, 'BIR11OsPrawnaOsobyDoReprezentacji');
        if (mgmtData) {
          management = mgmtData.map((item: any) => {
            const name = `${item.praw_imie1 ? item.praw_imie1[0] : ''} ${item.praw_nazwisko ? item.praw_nazwisko[0] : ''}`.trim();
            const role = item.praw_funkcja ? item.praw_funkcja[0] : '';
            return role ? `${name} (${role})` : name;
          }).filter((s: string) => s.length > 0);
        }
      } else if (type === 'F') {
        const fizData = await this.getFullReport(regon, 'BIR11OsFizycznaDaneOgolne');
        if (fizData && fizData[0]) {
          const ownerName = `${fizData[0].fiz_imie1 ? fizData[0].fiz_imie1[0] : ''} ${fizData[0].fiz_nazwisko ? fizData[0].fiz_nazwisko[0] : ''}`.trim();
          if (ownerName) {
            management.push(`${ownerName} (Właściciel)`);
          }
        }
        const pkdData = await this.getFullReport(regon, 'BIR11OsFizycznaPkd');
        if (pkdData) {
          pkd = pkdData.map((item: any) => `${item.fiz_pkd_Kod ? item.fiz_pkd_Kod[0] : ''} - ${item.fiz_pkd_Nazwa ? item.fiz_pkd_Nazwa[0] : ''}`);
        }
      }
    }

    return {
      name: company.Nazwa ? company.Nazwa[0] : '',
      nip: company.Nip ? company.Nip[0] : '',
      regon: regon,
      address: `${company.Ulica ? company.Ulica[0] : ''} ${company.NrNieruchomosci ? company.NrNieruchomosci[0] : ''}`,
      city: company.Miejscowosc ? company.Miejscowosc[0] : '',
      zipCode: company.KodPocztowy ? company.KodPocztowy[0] : '',
      province: company.Wojewodztwo ? company.Wojewodztwo[0] : '',
      email,
      phone,
      pkd,
      management,
    };
  }
}
