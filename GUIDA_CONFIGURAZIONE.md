# Guida alla Configurazione, Pubblicazione e Utilizzo di FlatLoop 🚀

Questa guida fornisce le istruzioni passo-passo, adatte anche a un principiante, per configurare il database Supabase, verificare la persistenza in locale, effettuare i controlli di sicurezza, pubblicare l'applicazione su Vercel e iniziare a utilizzarla con i propri coinquilini.

---

## 1. Configurazione del Database su Supabase

[Supabase](https://supabase.com) offre un database PostgreSQL ospitato sul cloud con un piano gratuito ideale per l'applicazione.

### Passaggi:

1. **Crea un account o accedi:**

   - Vai su [supabase.com](https://supabase.com) e accedi (è possibile utilizzare anche il proprio account GitHub).
2. **Crea un nuovo progetto:**

   - Clicca su **«New Project»**.
   - Scegli un nome per il progetto (es. `flatloop`).
   - Imposta una password sicura per il database (conservala in un luogo sicuro).
   - Scegli la regione più vicina (es. *West Europe - Frankfurt* per l'Italia).
   - Mantieni selezionato il piano gratuito (**Free Tier**).
   - Clicca su **«Create new project»** e attendi circa 1-2 minuti per il completamento dell'inizializzazione.
3. **Esegui lo schema del database:**

   - Nel menu laterale sinistro della dashboard di Supabase, clicca su **«SQL Editor»**.
   - Clicca su **«New query»**.
   - Apri il file [`supabase/schema.sql`](./supabase/schema.sql) presente in questo repository, copia l'intero contenuto e incollalo nell'editor SQL di Supabase.
   - Clicca sul pulsante verde **«Run»** in basso a destra.
   - Tutte le tabelle (`house_config`, `roommates`, `weekly_absences`, `cleaning_tasks`, `trash_tasks`, `login_attempts`), i vincoli di unicità, la funzione atomica protetta `rpc_complete_trash` e le policy restrittive Row Level Security (RLS) verranno create istantaneamente.
4. **Recupera le credenziali API:**

   - Nel menu laterale sinistro, vai su **Project Settings** (icona ingranaggio) > **API** (o **API Keys**).
   - Troverai le credenziali necessarie:
     - **Project URL:** l'indirizzo del tuo progetto (es. `https://<tuo-progetto-id>.supabase.co`).
     - **Secret API Key (`SUPABASE_SECRET_KEY`):** copia la chiave contrassegnata come **Secret** (le nuove chiavi Supabase hanno il prefisso `sb_secret_...`; nei progetti con formato legacy compare come chiave `service_role`).
     - **Publishable / Anon key:** copia temporaneamente la chiave pubblica (`sb_pub_...` o `anon`); servirà unicamente per la verifica di sicurezza degli accessi anonimi al termine della guida.

> [!WARNING]
> La **Secret API Key** possiede privilegi amministrativi completi sul database. Non deve **mai** essere esposta nel browser, non deve avere il prefisso `NEXT_PUBLIC_` e deve essere impostata esclusivamente come variabile d'ambiente lato server.

---

## 2. Generazione dei Segreti di Sicurezza

FlatLoop non utilizza credenziali predefinite insicure: tutti i segreti devono essere impostati prima dell'avvio.

1. **`HOUSE_SECRET_CODE` (Codice di accesso della casa):**

   - È la parola d'ordine o codice condiviso che i tre coinquilini utilizzeranno per accedere all'app dal proprio smartphone.
   - Scegli una combinazione concordata, sicura e difficile da indovinare (es. 10-16 caratteri con lettere, numeri e simboli). Non usare codici banali come `123456` o nomi della via.
2. **`SESSION_SECRET` (Chiave di firma della sessione):**

   - Viene utilizzata dal server per firmare crittograficamente i cookie di sessione (HMAC-SHA256). Deve essere una stringa casuale di almeno 32 caratteri.
   - Puoi generarla rapidamente aprendo un terminale ed eseguendo questo comando:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

     *(In alternativa, su macOS o Linux puoi usare `openssl rand -hex 32`, oppure generare una sequenza casuale da un password manager).*

---

## 3. Test Locale e Verifica della Persistenza

Prima di pubblicare l'applicazione, è consigliabile eseguire un breve test in locale collegando il database Supabase appena creato per accertarsi che i dati vengano salvati correttamente.

1. **Prepara il file `.env.local`:**
   Nella cartella principale del progetto, copia il file di esempio:

   ```bash
   cp .env.example .env.local
   ```
2. **Configura i valori nel file `.env.local`:**
   Apri `.env.local` con un editor di testo e inserisci i parametri ottenuti nei passaggi precedenti:

   ```ini
   HOUSE_SECRET_CODE=<IL_TUO_CODICE_CASA_SCELTO>
   SESSION_SECRET=<LA_TUA_CHIAVE_CASUALE_GENERATA_DI_ALMENO_32_CARATTERI>
   NEXT_PUBLIC_SUPABASE_URL=https://<tuo-progetto-id>.supabase.co
   SUPABASE_SECRET_KEY=<LA_TUA_SECRET_KEY_sb_secret_OPPURE_service_role>
   ```
3. **Avvia il server di sviluppo:**

   ```bash
   npm run dev
   ```
4. **Verifica il funzionamento e la persistenza:**

   - Apri il browser all'indirizzo [http://localhost:3000](http://localhost:3000).
   - Inserisci il codice segreto impostato in `HOUSE_SECRET_CODE`.
   - Seleziona uno dei tre coinquilini per impostare il tuo profilo.
   - Effettua un'azione di prova: premi **«Ho pulito»** su una delle pulizie oppure premi **«Segnala spazzatura piena»**.
   - Ricarica la pagina o riavvia il comando `npm run dev`: l'azione eseguita deve rimanere visualizzata.
   - **Riscontro su Supabase:** entra nella dashboard di Supabase, clicca su **Table Editor** nel menu a sinistra e seleziona la tabella `cleaning_tasks` o `trash_tasks`: vedrai la riga salvata nel database remoto.

---

## 4. Verifica di Sicurezza degli Accessi Anonimi a Supabase

Prima di mettere l'app a disposizione dei coinquilini, è fondamentale verificare che le tabelle private non siano leggibili né modificabili da utenti esterni non autorizzati tramite la Data API pubblica di Supabase.

1. **Test di lettura anonima:**
   Apri un terminale ed esegui una richiesta di prova indirizzata alla tabella di configurazione, utilizzando la chiave pubblica anonima (`anon` o `sb_pub_...`):

   ```bash
   curl -i -H "apikey: <LA_TUA_CHIAVE_ANON_O_sb_pub>" "https://<tuo-progetto-id>.supabase.co/rest/v1/house_config"
   ```

   - **Risultato atteso:** la risposta deve restituire un array vuoto `[]` oppure un messaggio di permesso negato. **Nessun dato privato deve essere restituito**.
   - Questo conferma che le policy Row Level Security (RLS) impediscono l'accesso a utenti anonimi privi di autorizzazione.
2. **Test della funzione RPC:**
   Verifica che la funzione atomica di completamento spazzatura non sia invocabile anonimamente:

   ```bash
   curl -i -X POST -H "apikey: <LA_TUA_CHIAVE_ANON_O_sb_pub>" "https://<tuo-progetto-id>.supabase.co/rest/v1/rpc/rpc_complete_trash"
   ```

   - **Risultato atteso:** la richiesta viene respinta con errore di autorizzazione (`permission denied`).
3. **Conclusione:** Solo il server di FlatLoop (tramite la `SUPABASE_SECRET_KEY` configurata sul backend) può leggere e modificare i dati del database.

---

## 5. Pubblicazione su Vercel

[Vercel](https://vercel.com) ospita applicazioni Next.js gratuitamente, con dominio HTTPS e certificato SSL gestito in automatico.

### Passaggi:

1. **Aggiorna il codice su GitHub:**
   Il repository è già configurato con il remote `origin` (`alesarac/flatflow`). Assicurati che le tue modifiche locali siano committate e inviate a GitHub:

   ```bash
   git status
   git push origin main
   ```

   *(Non è necessario eseguire `git remote add origin`, poiché il remote è già presente).*
2. **Collega il progetto su Vercel:**

   - Accedi a [vercel.com](https://vercel.com) con il tuo account GitHub.
   - Clicca su **«Add New...»** > **«Project»**.
   - Seleziona il repository `flatflow` e clicca su **«Import»**.
3. **Configura le Variabili d'Ambiente su Vercel:**
   Nella schermata di importazione, prima di premere *Deploy*, espandi la sezione **«Environment Variables»** e aggiungi le 4 variabili:

   | Nome Variabile               | Descrizione                                                             |
   | :--------------------------- | :---------------------------------------------------------------------- |
   | `HOUSE_SECRET_CODE`        | Il codice segreto concordato per l'accesso dei coinquilini              |
   | `SESSION_SECRET`           | La stringa casuale di almeno 32 caratteri generata per la firma         |
   | `NEXT_PUBLIC_SUPABASE_URL` | L'URL del progetto Supabase (`https://<tuo-progetto-id>.supabase.co`) |
   | `SUPABASE_SECRET_KEY`      | La Secret API Key (`sb_secret_...` o chiave `service_role`)         |
4. **Avvia il Deployment:**

   - Clicca su **«Deploy»**.
   - Vercel compilerà l'applicazione in circa 45 secondi.
   - Al termine, riceverai un URL HTTPS pubblico (es. `https://flatloop-xyz.vercel.app`).

---

## 6. Limiti dei Piani Gratuiti (Free Tier)

I piani gratuiti di Supabase e Vercel sono più che sufficienti per l'utilizzo da parte di 3 coinquilini:

### Supabase (Free Tier):

- **Richieste API:** **Illimitate**.
- **Spazio Database:** fino a 500 MB di archiviazione PostgreSQL (l'intero storico di FlatLoop per diversi anni occupa meno di 5 MB).
- **Pausa per inattività e ripristino:** se un progetto gratuito non riceve traffico o query per oltre una settimana, Supabase può metterlo temporaneamente in pausa ("paused"). Per riattivarlo:
  1. Accedi alla dashboard su [supabase.com](https://supabase.com).
  2. Clicca sul pulsante **«Restore project»**.
  3. Il database torna pienamente operativo in circa 1-2 minuti senza alcuna perdita di dati.
- **Assenza di backup automatici:** il piano Free di Supabase **non include backup automatici programmati giornalieri (Point-in-time recovery)**. Se desideri fare una copia di salvataggio periodica dei dati, puoi esportare manualmente i contenuti dal menu Database della dashboard oppure tramite comando terminale con la CLI di Supabase (`supabase db dump`).

### Vercel (Hobby Tier):

- **Funzioni Serverless:** **1 milione di invocazioni al mese** (l'uso tipico di 3 coinquilini genera meno di 2.000 invocazioni mensili).
- **Larghezza di banda:** 100 GB al mese.
- **Certificato SSL / HTTPS:** gestito e rinnovato automaticamente a costo zero.

---

## 7. Come Utilizzare l'Applicazione tra Coinquilini

### Primo Accesso da Smartphone:

1. Condividi il link Vercel con i tuoi due coinquilini (es. tramite messaggio o chat di gruppo).
2. All'apertura della pagina, ciascuno inserisce il **codice segreto della casa** (`HOUSE_SECRET_CODE`) e seleziona il proprio nome dall'elenco dei tre profili coinquilini caricati dal database.
3. Il server verifica il codice e salva l'ID stabile del coinquilino (0, 1 o 2) nel cookie HTTP-only firmato (durata 1 anno). Il profilo resta fisso e vincolato al dispositivo: non è possibile scambiare profilo durante l'uso, garantendo che ogni coinquilino registri solo le proprie azioni.
4. Per cambiare dispositivo o profilo, è sufficiente premere **«Esci»** nelle Impostazioni e accedere nuovamente.

### Personalizzazione dei Nomi dei Coinquilini:

- **Dall'applicazione:** nelle **Impostazioni**, ciascun coinquilino visualizza tutti e tre i nomi, ma può modificare esclusivamente il proprio.
- **Da Supabase (consigliato per impostazione iniziale):** apri il file [`supabase/nomi-coinquilini.sql`](./supabase/nomi-coinquilini.sql), personalizza i tre nomi negli `UPDATE`, incollalo nel **SQL Editor** di Supabase e premi **«Run»**.

### Installazione come PWA (Icona su Schermata Home):

Per utilizzare l'app a schermo intero senza barre di navigazione del browser:

- **Su iPhone (Safari):**
  1. Apri il link dell'applicazione su Safari.
  2. Tocca l'icona **Condividi** (il quadrato con la freccia verso l'alto).
  3. Scorri e seleziona **«Aggiungi alla schermata Home»**.
  4. Premi **«Aggiungi»** in alto a destra.
- **Su Android (Chrome / Firefox / Brave):**
  1. Apri il link dell'applicazione nel browser.
  2. Tocca i tre puntini del menu in alto a destra.
  3. Seleziona **«Installa applicazione»** o **«Aggiungi a schermata Home»**.

### Flusso delle Attività:

- **Rotazione settimanale (Lunedì fuso orario italiano Europe/Rome):** Le pulizie delle tre aree (*Cucina*, *Bagno*, *Ingresso e corridoio*) ruotano automaticamente ogni lunedì a mezzanotte.
- **Durante la settimana per le pulizie:**
  - Dopo aver fatto la pulizia, apri l'app e premi **«Ho pulito»**.
  - Se non puoi farla, premi **«Non posso»**: il sistema riassegna automaticamente il compito al coinquilino successivo disponibile (seguendo la rotazione ciclica 0 → 1 → 2 → 0) che non abbia già rifiutato quell'attività.
  - Se tutti e tre i coinquilini rinunciano, l'attività passa allo stato **«Da coprire»**: chiunque può cambiare idea e offrirsi volontario premendo **«Me ne occupo io»**. Il compito viene riassegnato a chi si offre e risulterà completato solo premendo successivamente **«Ho pulito»**.
  - La rinuncia vale esclusivamente per quella specifica attività, senza alterare la disponibilità per gli altri compiti o per la settimana successiva.
- **Spazzatura:**
  - Quando il bidone è pieno, premi **«Segnala spazzatura piena»**.
  - Il sistema assegna il turno al coinquilino in testa alla coda equa a 3 posizioni.
  - Chi la getta preme **«Ho buttato»** e passa in fondo alla coda.
  - Chi non può preme **«Non posso»**: il turno passa al coinquilino successivo in coda, e chi ha rinunciato mantiene la priorità in testa alla coda per la prossima segnalazione.
  - Se tutti rinunciano, compare lo stato **«Da coprire»** e chiunque può prenderla in carico premendo **«Me ne occupo io»** prima di registrarla con **«Ho buttato»**.

---

## 8. Reset dei Dati di Prova (Ripristino allo Stato Iniziale)

Durante la fase di test potresti voler ripulire il database e riportare FlatLoop allo stato di partenza, come se l'app fosse appena stata installata.

### Dati eliminati e dati conservati:

- **Cosa viene eliminato:**
  - Tutte le pulizie registrate (completate e incomplete).
  - Tutte le segnalazioni aperte e lo storico della spazzatura.
  - I tentativi di accesso registrati (reset del rate limiting).
- **Cosa viene conservato:**
  - I tre profili coinquilini con i rispettivi nomi personalizzati.
  - L'intera struttura del database (tabelle, indici, vincoli di unicità).
  - La funzione atomica `rpc_complete_trash`, le policy di sicurezza RLS e i permessi.
  - La coda equa della spazzatura, ripristinata all'ordine iniziale `[0, 1, 2]`.

Alla prima apertura dell'applicazione dopo il reset, il sistema inizializzerà automaticamente la settimana corrente secondo il ciclo di rotazione previsto, con storico pulito e nessun compito in sospeso.

### Metodo 1 — Da terminale Windows (con script dedicato)

Se disponi di `psql` (PostgreSQL Client) installato nel sistema, puoi eseguire il reset con un unico comando dalla cartella principale del progetto:

```powershell
npm run db:reset
```

*(oppure `powershell -ExecutionPolicy Bypass -File .\scripts\reset-db.ps1`)*

**Come funziona:**

1. Lo script legge la stringa di connessione PostgreSQL da `DATABASE_URL` (in `.env.local` o variabile d'ambiente); se non è presente, te la chiederà a terminale in modo sicuro (con input oscurato a schermo).
2. Ti mostrerà i dettagli del database di destinazione (host, progetto Supabase, database, utente e porta, senza mai mostrare o esporre la password) e chiederà di digitare **`CONFERMA`** prima di procedere.
3. Eseguirà lo script transazionale `supabase/reset.sql` tramite `psql` con arresto immediato in caso di errore (`-v ON_ERROR_STOP=1`), gestendo la password in modo sicuro tramite variabile d'ambiente temporanea.

### Metodo 2 — Direttamente da Supabase SQL Editor (Alternativa senza strumenti locali)

Se non hai `psql` installato o preferisci operare dal browser:

1. Accedi alla dashboard di Supabase sul tuo progetto.
2. Nel menu laterale sinistro, clicca su **«SQL Editor»** > **«New query»**.
3. Apri il file [`supabase/reset.sql`](./supabase/reset.sql) di questo repository, copiane il contenuto e incollalo nell'editor.
4. Clicca sul pulsante **«Run»**.
5. I dati verranno azzerati istantaneamente in una singola transazione protetta.
