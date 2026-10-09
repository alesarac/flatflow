# Flatflow 🏠

**Flatflow** è una moderna web application mobile-first (PWA) progettata per organizzare le pulizie settimanali e lo smaltimento della spazzatura in una casa condivisa da **tre coinquilini**.

Sostituisce messaggi WhatsApp, note cartacee e accordi verbali con una semplice lavagna digitale: chiunque apre l'applicazione dal telefono vede immediatamente **a chi tocca fare cosa, cosa è già stato fatto e chi deve buttare la spazzatura**.

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

### ✈️ Assenze e impossibilità di pulire
- **«Sono assente questa settimana»**: il coinquilino non riceve incarichi per quella settimana.
- **«Non posso pulire»**: rinuncia a una specifica pulizia.
- Il sistema riassegna automaticamente il compito al primo coinquilino disponibile seguendo l'ordine fisso (0 → 1 → 2 → 0), saltando gli assenti e chi ha già rifiutato quell'attività. Se nessuno è disponibile, l'attività rimane senza incaricato.
- La revoca di un'assenza prima della fine della settimana non modifica le assegnazioni già trasferite.

### 🗑️ Gestione equa della spazzatura
- Chiunque può premere **«Segnala spazzatura piena»** (può esserci una sola segnalazione aperta alla volta).
- Assegnazione automatica tramite una **coda equa a 3 posizioni**:
  - Il primo disponibile in coda riceve il compito.
  - Può premere **«Ho buttato la spazzatura»** (completando il compito) oppure **«Non posso»**.
  - **Chi completa passa in fondo alla coda**.
  - **Chi rinuncia o è assente viene saltato solo per quella volta e mantiene la priorità in testa alla coda** per la segnalazione successiva.
  - Un incarico di spazzatura aperto non scade al cambio di settimana.

### 📜 Storico essenziale
- Elenco cronologico chiaro e sintetico di:
  - Pulizie completate con data, ora e autore.
  - Pulizie passate rimaste incomplete con settimana di riferimento.
  - Conferimenti della spazzatura registrati.

### 🔒 Accesso condiviso e Privacy
- **Nessuna registrazione, nessun account personale, nessun amministratore.**
- Un **unico codice segreto condiviso per la casa**, verificato rigorosamente sul server e protetto da rate-limiting su tentativi ripetuti.
- Memorizzazione sicura della sessione (cookie HTTP-only con durata annuale) per non richiedere continuamente il codice.
- Selezione locale del proprio nome salvata sul dispositivo, con possibilità di cambiare coinquilino attivo in qualsiasi momento.
- I nomi dei 3 coinquilini sono facilmente modificabili dalle impostazioni senza alterare lo storico passato.

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
   git clone https://github.com/tuo-username/flatflow.git
   cd flatflow
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
   *(I valori predefiniti consentono di avviare l'app immediatamente in locale utilizzando il database locale su file).*

4. **Avvia il server di sviluppo:**
   ```bash
   npm run dev
   ```
   L'app sarà disponibile su [http://localhost:3000](http://localhost:3000). Il codice predefinito della casa è `flatflow2026`.

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

Per le istruzioni dettagliate passo-passo su come creare il database Supabase, pubblicare l'app gratuitamente su Vercel e installarla su smartphone (iOS e Android), consulta:

👉 **[GUIDA_CONFIGURAZIONE.md](./GUIDA_CONFIGURAZIONE.md)**
