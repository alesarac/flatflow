# FlatLoop

Web app mobile-first (PWA) per la gestione condivisa di pulizie, turni della spazzatura e spesa per coinquilini.

---

## Caratteristiche principali

- **Rotazione pulizie**: Assegnazione settimanale a turni ciclici con possibilità di scambio o presa in carico volontaria.
- **Turni spazzatura**: Coda equa per la gestione e lo smaltimento dei rifiuti.
- **Lista della spesa**: Spesa condivisa e sincronizzata in tempo reale.
- **Storico attività**: Registro delle pulizie e dei conferimenti passati.
- **PWA Ready**: Ottimizzata per smartphone e installabile come app web progressiva.
- **Accesso rapido**: Login tramite codice casa e selezione profilo, senza registrazione o password individuali.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 15 (App Router, React 19)
- **Linguaggio**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL con fallback locale per sviluppo offline)
- **Testing**: [Vitest](https://vitest.dev/)

---

## Installazione e avvio

### Prerequisiti

- Node.js 20 o versione successiva e npm.
- Per un'installazione persistente o un deployment: un progetto [Supabase](https://supabase.com/) con database PostgreSQL.

### 1. Clona e installa

```bash
git clone https://github.com/alesarac/flatloop.git
cd flatloop
npm ci
```

### 2. Prepara le variabili d'ambiente

Crea `.env.local` a partire dal file di esempio (PowerShell su Windows):

```powershell
Copy-Item .env.example .env.local
```

Su macOS o Linux: `cp .env.example .env.local`.

Apri `.env.local` e sostituisci i segnaposto. `HOUSE_SECRET_CODE` è il codice condiviso per accedere alla casa; `SESSION_SECRET` è una chiave casuale di almeno 32 caratteri, diversa dal codice casa. **Non pubblicare mai le chiavi reali**: `.env.local` è escluso da Git.

### 3A. Sviluppo locale senza Supabase

Imposta anche `USE_LOCAL_DB=true` in `.env.local`; mantieni comunque configurati `HOUSE_SECRET_CODE` e `SESSION_SECRET`. Puoi lasciare vuote o commentate le variabili Supabase d'esempio: in assenza di URL e chiave effettivi l'app userà il database locale `data/local-db.json` (ignorato da Git).

Avvia il server:

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000). Questo metodo è solo per sviluppo o test sul tuo PC, non per il deployment su Vercel.

### 3B. Nuova installazione con Supabase

1. Crea un **nuovo** progetto su Supabase.
2. Apri **SQL Editor**, inserisci il contenuto di [`supabase/schema.sql`](./supabase/schema.sql) ed eseguilo sul database nuovo. Il file crea tabelle, indici, profili iniziali, policy RLS e funzione RPC richiesti dall'app.
3. In `.env.local` configura `NEXT_PUBLIC_SUPABASE_URL` con l'URL del progetto e `SUPABASE_SECRET_KEY` con una chiave server-side Secret API Key (oppure la chiave legacy `service_role`). Configura anche `HOUSE_SECRET_CODE` e `SESSION_SECRET`.
4. Non impostare `USE_LOCAL_DB=true` quando vuoi usare Supabase. Esegui `npm run dev` e accedi usando il codice casa.

**Sicurezza:** `SUPABASE_SECRET_KEY` è privilegiata e deve essere usata solo sul server; non rinominarla con prefisso `NEXT_PUBLIC_` e non inserirla mai nel codice frontend. Le policy dello schema negano l'accesso diretto ai ruoli pubblici.

**Database già esistente:** non trattare la procedura per una nuova installazione come una migrazione. Gli script in [`supabase/migrations/`](./supabase/migrations/) servono ad aggiornare versioni precedenti; controlla quali modifiche sono già applicate prima di eseguirli.

### 4. Deployment su Vercel

1. Collega il repository a [Vercel](https://vercel.com/) e imposta `main` come branch di produzione.
2. In **Project Settings → Environment Variables**, configura `HOUSE_SECRET_CODE`, `SESSION_SECRET`, `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY` con i valori del **tuo** progetto Supabase. Non usare i segnaposto di `.env.example`.
3. Assicurati che `USE_LOCAL_DB` non sia impostato a `true` in produzione; esegui il deployment e verifica l'accesso.

Lo schema Supabase deve essere inizializzato prima del primo utilizzo. `DATABASE_URL` non è richiesta per eseguire l'app: è opzionale ed è usata dallo script PowerShell di reset del database.

---

## Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia l'ambiente di sviluppo locale |
| `npm run build` | Esegue la build di produzione |
| `npm run start` | Avvia l'applicazione compilata |
| `npm test` | Esegue i test automatizzati |
| `npm run test:watch` | Avvia i test in modalità watch |
| `npm run db:reset` | **Distruttivo:** reset di dati operativi su PostgreSQL tramite PowerShell; verificare sempre il database di destinazione |
