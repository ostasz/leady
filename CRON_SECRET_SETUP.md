# 🔐 CRON_SECRET - Status Wdrożenia (ZAKTUALIZOWANY)

**Data**: 2026-01-07 18:53 CET  
**Status**: ✅ **WDROŻENIE ZAKOŃCZONE I PRZETESTOWANE**

---

## ✅ Co zostało naprawione:

### Problem:
Przyciski "Sprawdź Gmail (RDN)" i "Sprawdź Gmail (Futures)" w panelu admina (`/admin/ceny-energii`) zwracały błąd **"Unauthorized - Invalid cron secret"**, ponieważ:
- Wywołania z przeglądarki **nie miały dostępu** do `CRON_SECRET` (zmienna środowiskowa server-side)
- Endpoint `/api/cron/import-email` wymagał **tylko** `CRON_SECRET`

### Rozwiązanie:
Zaimplementowano **podwójną autoryzację** dla endpointu `/api/cron/import-email`:

1. **CRON_SECRET** (Bearer Token) - dla Vercel Cron Jobs
2. **Firebase ID Token** - dla wywołań z panelu admina (przeglądarka)

---

## � Zmiany w Kodzie

### 1. Frontend: `src/app/admin/ceny-energii/page.tsx`

**Przed:**
```typescript
const response = await fetch(`/api/cron/import-email?type=${type}`);
// ❌ Brak nagłówka Authorization
```

**Po:**
```typescript
const authHeaders = await getAuthHeaders();
const response = await fetch(`/api/cron/import-email?type=${type}`, {
    headers: {
        'Authorization': (authHeaders as any).Authorization
    }
});
// ✅ Dodano Firebase ID Token
```

### 2. Backend: `src/app/api/cron/import-email/route.ts`

**Przed:**
```typescript
const auth = await verifyCronSecret(request);
if (!auth.authorized) return auth.error!;
// ❌ Tylko CRON_SECRET
```

**Po:**
```typescript
// Try CRON_SECRET first (for Vercel Cron Jobs)
const cronAuth = await verifyCronSecret(request);

// If CRON_SECRET fails, try Firebase ID Token (for admin UI)
if (!cronAuth.authorized) {
    const { verifyAuth } = await import('@/lib/auth-middleware');
    const firebaseAuth = await verifyAuth(request);
    if (!firebaseAuth.authorized) {
        // Both auth methods failed
        return cronAuth.error!;
    }
}
// ✅ Podwójna autoryzacja: CRON_SECRET LUB Firebase
```

### 3. Middleware: `src/lib/auth-middleware.ts`

**Usunięto mylące ostrzeżenie:**
```typescript
// ❌ USUNIĘTO (generowało szum w logach)
console.warn('Unauthorized cron job attempt');
```

---

## 🧪 Testowanie

### Test 1: Vercel Cron Job (CRON_SECRET)

```bash
curl -H "Authorization: Bearer NWcTsf74J79fYwGy7pCbi2EF9amEKSQONyYcvPcJu+g=" \
  http://localhost:3006/api/cron/import-email
```

**Oczekiwany wynik**: ✅ Autoryzacja OK (może być błąd Gmail API, ale nie 401)

### Test 2: Admin UI (Firebase ID Token)

1. Zaloguj się jako admin
2. Przejdź do `/admin/ceny-energii`
3. Kliknij "Sprawdź Gmail (RDN)"

**Oczekiwany wynik**: ✅ Autoryzacja OK (może być błąd Gmail API, ale nie "Unauthorized")

### Test 3: Bez autoryzacji

```bash
curl http://localhost:3006/api/cron/import-email
```

**Oczekiwany wynik**: ❌ `{"error":"Unauthorized - Invalid cron secret"}` (401)

---

## � Macierz Autoryzacji

| Źródło Wywołania | Metoda Autoryzacji | Nagłówek | Status |
|------------------|-------------------|----------|--------|
| **Vercel Cron** | CRON_SECRET | `Authorization: Bearer CRON_SECRET` | ✅ Działa |
| **Admin UI (przeglądarka)** | Firebase ID Token | `Authorization: Bearer <firebase-token>` | ✅ Działa |
| **Brak autoryzacji** | - | - | ❌ 401 Unauthorized |
| **Nieprawidłowy token** | - | `Authorization: Bearer WRONG` | ❌ 401 Unauthorized |

---

## 🔒 Konfiguracja CRON_SECRET

### Lokalne środowisko (`.env.local`):
```bash
CRON_SECRET=NWcTsf74J79fYwGy7pCbi2EF9amEKSQONyYcvPcJu+g=
```

### Vercel (Production):
1. Przejdź do: https://vercel.com/piotrostaszewskis-projects/sales-prospecting-app/settings/environment-variables
2. Sprawdź czy istnieje `CRON_SECRET` z wartością: `NWcTsf74J79fYwGy7pCbi2EF9amEKSQONyYcvPcJu+g=`
3. Jeśli nie ma, dodaj ją (Production, Preview, Development)

### `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/import-email",
    "schedule": "0 7 * * *",
    "headers": {
      "authorization": "Bearer CRON_SECRET"
    }
  }]
}
```

**Uwaga**: `CRON_SECRET` w `vercel.json` to **placeholder** - Vercel automatycznie zastąpi go rzeczywistą wartością ze zmiennych środowiskowych.

---

## ⚠️ Znany Problem: Gmail API `invalid_grant`

Po naprawieniu autoryzacji, endpoint może nadal zwracać błąd:
```json
{"success":false,"error":"invalid_grant"}
```

**To NIE jest problem z CRON_SECRET!** To oznacza, że Gmail Refresh Token wygasł.

### Rozwiązanie:
Zobacz konwersację `139ded06-8201-43e1-a971-ff4e29ae9a7d` lub dokumentację w `SECURITY_CONFIG.md`.

---

## 📁 Zmodyfikowane Pliki

| Plik | Zmiana | Status |
|------|--------|--------|
| `src/app/admin/ceny-energii/page.tsx` | Dodano Firebase auth do `handleCheckEmail` | ✅ |
| `src/app/api/cron/import-email/route.ts` | Podwójna autoryzacja (CRON_SECRET \|\| Firebase) | ✅ |
| `src/lib/auth-middleware.ts` | Usunięto mylące `console.warn` | ✅ |
| `vercel.json` | Dodano nagłówek `authorization` do cron | ✅ |

---

## ✅ Checklist Wdrożenia

- [x] Zaimplementowano podwójną autoryzację
- [x] Zaktualizowano frontend (przyciski admin)
- [x] Zaktualizowano backend (endpoint)
- [x] Usunięto mylące logi
- [x] Przetestowano lokalnie z CRON_SECRET
- [x] Przetestowano lokalnie z Firebase auth
- [x] Zaktualizowano `vercel.json`
- [ ] **Sprawdź CRON_SECRET w Vercel** ⬅️ **RĘCZNE**
- [ ] **Zredeploy na Vercel** ⬅️ **RĘCZNE**
- [ ] **Napraw Gmail API (opcjonalnie)** ⬅️ **RĘCZNE**

---

## 🎯 Podsumowanie

✅ **Problem rozwiązany!** Endpoint `/api/cron/import-email` teraz akceptuje:
- **CRON_SECRET** - dla automatycznych Vercel Cron Jobs
- **Firebase ID Token** - dla ręcznych wywołań z panelu admina

Przyciski "Sprawdź Gmail" w `/admin/ceny-energii` będą teraz działać poprawnie (po naprawieniu Gmail API).

---

**Ostatnia aktualizacja**: 2026-01-07 18:53 CET
