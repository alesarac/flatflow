# FlatLoop 🏠

**FlatLoop** è una moderna web application mobile-first (PWA) progettata per organizzare le pulizie settimanali, lo smaltimento della spazzatura e la lista della spesa condivisa in una casa di **tre coinquilini**.

Sostituisce messaggi WhatsApp, note cartacee e accordi verbali con una semplice lavagna digitale: chiunque apre l'applicazione dal telefono vede immediatamente **a chi tocca fare cosa, cosa è già stato fatto, chi deve buttare la spazzatura e cosa c'è da comprare**.

---

## 🎯 Caratteristiche principali

### 🧹 Pulizie settimanali

- La casa è organizzata in tre aree:
  1. **Cucina**
  2. **Bagno**
  3. **Ingresso e corridoio**
- Le assegnazioni ruotano automaticamente **ogni lunedì** su un ciclo fisso di 3 settimane.
- Ciascun coinquilino può premere **«Ho pulito»** per registrare il completamento.
- Nessun recupero o penalità per le attività non svolte entro domenica: rimangono semplicemente registrate come incomplete nello storico e la settimana successiva prosegue regolarmente con la nuova rotazione.

### 🔄 Rinunce e presa in carico («Non posso» e «Me ne occupo io»)

- Tutti i coinquilini sono **sempre potenzialmente disponibili** (non è presente una gestione globale di presenza/assenza settimanale).
- **«Non posso»**: consente a chi è attualmente assegnato a un compito di rinunciare a quella specifica attività.
- Alla rinuncia, il compito passa automaticamente al coinquilino successivo secondo la rotazione ciclica (0 → 1 → 2 → 0) che non abbia già rifiutato quella stessa attività.
- **«Da coprire»**: se tutti i coinquilini rinunciano a un compito, l'attività rimane visibile nello stato «Da coprire».
- **«Me ne occupo io»**: chiunque può offrirsi volontario per un'attività senza incaricato («Da coprire»), anche se vi aveva precedentemente rinunciato.
- Chi si offre volontario viene assegnato come incaricato, ma l'attività **non risulta completata** finché non viene effettivamente registrata con **«Ho pulito»** o **«Ho buttato»**.
- Le rinunce hanno effetto **esclusivamente sulla specifica attività** e non influiscono sugli altri compiti della settimana né sulla rotazione generale.

### 🗑️ Gestione equa della spazzatura

- Chiunque può premere **«Segnala spazzatura piena»** (può esserci una sola segnalazione aperta alla volta).
- Assegnazione automatica tramite una **coda equa a 3 posizioni**:
  - Il primo disponibile in coda riceve il compito.
  - Può premere **«Ho buttato»** (completando il compito) oppure **«Non posso»**.
  - **Chi completa passa in fondo alla coda**.
  - **Chi rinuncia viene saltato solo per quella volta e mantiene la priorità in testa alla coda** per la segnalazione successiva.
  - Se tutti i coinquilini rinunciano, compare lo stato **«Da coprire»** e chiunque può prenderla in carico premendo **«Me ne occupo io»**.
  - Un incarico di spazzatura aperto non scade al cambio di settimana.

### 📜 Storico essenziale

- Elenco cronologico chiaro e sintetico di:
  - Pulizie completate con data, ora e autore.
  - Pulizie passate rimaste incomplete con settimana di riferimento.
  - Conferimenti della spazzatura registrati.

### 🔒 Accesso condiviso e Profilo Univoco

- **Nessuna registrazione o password individuale:** accesso rapido basato sul codice segreto condiviso della casa (`HOUSE_SECRET_CODE`) e selezione dell'identità dai 3 profili letti dal database.
- **Profilo vincolato alla sessione:** l'ID stabile del coinquilino (0, 1 o 2) viene salvato all'accesso nel cookie HTTP-only firmato (durata annuale). Non è possibile cambiare profilo durante l'utilizzo; per cambiare identità occorre effettuare il logout da «Esci».
- **Sicurezza server-side:** tutte le API derivano l'identità del richiedente direttamente dalla sessione autenticata. Qualsiasi tentativo di impersonificare o rinominare altri coinquilini viene respinto con HTTP 403 Forbidden.
- **Personalizzazione nomi:** dalle Impostazioni ciascun coinquilino può modificare esclusivamente il proprio nome; i nomi possono essere personalizzati anche via SQL su Supabase tramite lo script `supabase/nomi-coinquilini.sql`.

---

## 🛠️ Stack Tecnologico

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling & UX:** [Tailwind CSS](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL con RLS) con fallback locale integrato per sviluppo e test offline (`LocalHouseRepository`)
- **Hosting consigliato:** [Vercel](https://vercel.com/)
- **Mobile:** Progressive Web App (PWA) con web manifest, touch styling e safe area insets per iPhone e Android

---

## 🚀 Avvio Rapido in Locale

1. **Clona il repository:**

   ```bash
   git clone https://github.com/alesarac/flatloop.git
   cd flatloop
   ```

2. **Installa le dipendenze:**

   ```bash
   npm install
   ```

3. **Crea il file delle variabili d'ambiente:**
   Copia `.env.example` in `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   Configura i valori obbligatori in `.env.local`:
   - `HOUSE_SECRET_CODE`: il codice segreto concordato per la casa.
   - `SESSION_SECRET`: stringa casuale di almeno 32 caratteri per la firma delle sessioni (es. generabile con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY`: le credenziali del database Supabase (per test o sviluppo locale offline senza Supabase, imposta `USE_LOCAL_DB=true`).
4. **Avvia il server di sviluppo:**

   ```bash
   npm run dev
   ```

   L'app sarà disponibile su [http://localhost:3000](http://localhost:3000). Accedi inserendo il codice della casa definito in `HOUSE_SECRET_CODE`.
5. **Esegui i test automatizzati:**

   ```bash
   npm test
   ```

6. **Compila la build di produzione:**

   ```bash
   npm run build
   ```

---

## 📖 Documentazione e Pubblicazione

Per le istruzioni dettagliate passo-passo su come creare il database Supabase, configurare le variabili d'ambiente, pubblicare l'app gratuitamente su Vercel e installarla su smartphone (iOS e Android), consulta:

👉 **[GUIDA_CONFIGURAZIONE.md](./GUIDA_CONFIGURAZIONE.md)**
