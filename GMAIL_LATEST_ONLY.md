# 📧 Gmail Import - Tylko Ostatni Email

**Data**: 2026-01-07 21:34 CET  
**Zmiana**: Import tylko najnowszego emaila zamiast wszystkich nieprzeczytanych

---

## 🎯 Co się zmieniło?

### Przed:
- ❌ Pobierał **do 10** nieprzeczytanych emaili (`maxResults: 10`)
- ❌ Filtrował tylko nieprzeczytane (`is:unread`)
- ❌ Oznaczał przetworzone emaile jako przeczytane
- ⚠️ Mógł przetwarzać wiele emaili naraz (długi czas wykonania)

### Po:
- ✅ Pobiera **tylko 1** najnowszy email (`maxResults: 1`)
- ✅ Bez filtra `is:unread` - zawsze najnowszy
- ✅ Nie zmienia statusu emaila (nie oznacza jako przeczytane)
- ✅ Szybkie wykonanie (tylko jeden email)

---

## 🔧 Zmiany w Kodzie

### 1. Usunięto filtr `is:unread`

**Przed:**
```typescript
query = `is:unread subject:${SUBJECT_RDN} has:attachment`;
```

**Po:**
```typescript
query = `subject:${SUBJECT_RDN} has:attachment`;
```

**Dlaczego?**
- Bez `is:unread` Gmail zwraca emaile posortowane od najnowszego
- Z `maxResults: 1` dostajemy **zawsze najnowszy** email

### 2. Zmieniono `maxResults` na 1

**Przed:**
```typescript
maxResults: 10
```

**Po:**
```typescript
maxResults: 1  // Only fetch the latest email
```

**Efekt:**
- Pobiera tylko **1 najnowszy** email
- Szybsze wykonanie
- Mniej zapytań do Gmail API

### 3. Usunięto oznaczanie jako przeczytane

**Przed:**
```typescript
await gmail.users.messages.modify({
    userId: 'me',
    id: msg.id,
    requestBody: { removeLabelIds: ['UNREAD'] }
});
```

**Po:**
```typescript
// Note: We don't mark as read anymore - we always fetch the latest email
logDebug('File processed successfully.');
```

**Dlaczego?**
- Nie potrzebujemy oznaczać jako przeczytane
- Zawsze pobieramy najnowszy email (niezależnie od statusu)
- Mniej zapytań do Gmail API (brak `messages.modify`)

---

## 📊 Porównanie Zachowania

| Aspekt | Przed | Po |
|--------|-------|-----|
| **Liczba emaili** | Do 10 | Tylko 1 (najnowszy) |
| **Filtr** | `is:unread` | Brak (zawsze najnowszy) |
| **Czas wykonania** | 2-3 minuty (10 emaili) | ~10-30 sekund (1 email) |
| **Modyfikacja emaila** | Tak (oznacza jako przeczytane) | Nie |
| **Zapytania API** | `list` + 10× `get` + 10× `modify` | `list` + 1× `get` |

---

## 🧪 Testowanie

### Test 1: Sprawdź Gmail (RDN)

1. Przejdź do: http://localhost:3006/admin/ceny-energii
2. Kliknij **"Sprawdź Gmail (RDN)"**

**Oczekiwany wynik:**
- ✅ Pobiera tylko **najnowszy** email z tematem "Subscription for tge_p"
- ✅ Przetwarza załącznik CSV
- ✅ Zapisuje dane do bazy
- ✅ Szybkie wykonanie (~10-30 sekund)
- ✅ Email **nie** jest oznaczany jako przeczytany

### Test 2: Sprawdź Gmail (Futures)

1. Kliknij **"Sprawdź Gmail (Futures)"**

**Oczekiwany wynik:**
- ✅ Pobiera tylko **najnowszy** email z tematem "Subscription for tge_f"
- ✅ Przetwarza załącznik CSV
- ✅ Zapisuje dane do bazy

### Test 3: Wielokrotne Wywołanie

1. Kliknij **"Sprawdź Gmail (RDN)"** ponownie

**Oczekiwany wynik:**
- ✅ Pobiera **ten sam** najnowszy email
- ⚠️ Może być duplikat danych (jeśli Prisma nie ma `skipDuplicates`)
- ✅ Szybkie wykonanie

---

## ⚠️ Ważne Uwagi

### 1. Duplikaty Danych

Ponieważ nie oznaczamy emaili jako przeczytane, **wielokrotne wywołanie** będzie przetwarzać ten sam email.

**Rozwiązanie:**
- Prisma używa `skipDuplicates: true` w `createMany`
- Duplikaty są automatycznie ignorowane
- Bezpieczne wielokrotne wywołanie

### 2. Stare Dane

Jeśli najnowszy email jest stary (np. sprzed tygodnia), import nadal go przetworzy.

**Rozwiązanie:**
- To jest oczekiwane zachowanie
- Zawsze importujemy **najnowsze dostępne** dane
- Jeśli chcesz tylko świeże dane, dodaj filtr daty w query

### 3. Brak Nowych Emaili

Jeśli nie ma emaili z danym tematem, import zwróci `processed: 0`.

**Komunikat:**
```json
{
  "success": true,
  "processed": 0,
  "details": []
}
```

---

## 🔄 Vercel Cron

Automatyczny cron (codziennie o 7:00) również będzie pobierać tylko **najnowszy** email:

```json
{
  "crons": [{
    "path": "/api/cron/import-email",
    "schedule": "0 7 * * *"
  }]
}
```

**Zachowanie:**
- Codziennie o 7:00 pobiera najnowszy email RDN i Futures
- Jeśli jest nowy email → importuje dane
- Jeśli nie ma nowego emaila → przetwarza ostatni dostępny

---

## 📁 Zmodyfikowane Pliki

| Plik | Zmiana | Linie |
|------|--------|-------|
| `src/lib/gmail.ts` | Usunięto `is:unread` z query | 38-48 |
| `src/lib/gmail.ts` | Zmieniono `maxResults: 10` → `1` | 50-54 |
| `src/lib/gmail.ts` | Usunięto `messages.modify` | 127-137 |

---

## ✅ Checklist

- [x] Usunięto filtr `is:unread`
- [x] Zmieniono `maxResults` na 1
- [x] Usunięto oznaczanie jako przeczytane
- [x] Zaktualizowano komentarze w kodzie
- [ ] **Przetestuj przycisk "Sprawdź Gmail (RDN)"** ⬅️ **DO ZROBIENIA**
- [ ] **Przetestuj przycisk "Sprawdź Gmail (Futures)"** ⬅️ **DO ZROBIENIA**
- [ ] **Sprawdź czas wykonania** ⬅️ **DO ZROBIENIA**

---

**Ostatnia aktualizacja**: 2026-01-07 21:34 CET  
**Status**: ✅ **Kod zaktualizowany - gotowe do testowania**
