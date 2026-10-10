# Guida alla Configurazione, Pubblicazione e Utilizzo di Flatflow 🚀

Questa guida fornisce le istruzioni complete per configurare il database Supabase, pubblicare l'applicazione su Vercel e iniziare a utilizzarla con i propri coinquilini.

---

## 1. Configurazione del Database su Supabase

[Supabase](https://supabase.com) offre un database PostgreSQL ospitato sul cloud con un generoso piano gratuito permanente.

### Passaggi:

1. **Crea un account o accedi:**
   - Vai su [supabase.com](https://supabase.com) e accedi (anche con account GitHub).

2. **Crea un nuovo progetto:**
   - Clicca su **«New Project»**.
   - Scegli un nome per il progetto (es. `flatflow`).
   - Imposta una password sicura per il database.
   - Scegli la regione più vicina (es. *West Europe - Frankfurt* per l'Italia).
   - Mantieni selezionato il piano gratuito (**Free Tier**).
   - Clicca su **«Create new project»** e attendi circa 1 minuto per il completamento dell'inizializzazione.

3. **Esegui lo schema del database:**
   - Nel menu laterale sinistro della dashboard di Supabase, clicca su **«SQL Editor»**.
   - Clicca su **«New query»**.
   - Apri il file [`supabase/schema.sql`](./supabase/schema.sql) presente in questo repository, copia l'intero contenuto e incollalo nell'editor SQL di Supabase.
   - Clicca sul pulsante **«Run»** (in basso a destra).
   - Tutte le tabelle (`house_config`, `roommates`, `weekly_absences`, `cleaning_tasks`, `trash_tasks`, `login_attempts`), i vincoli di unicità (un solo compito di spazzatura aperto e unicità per area/settimana), le funzioni transazionali RPC e le policy di sicurezza RLS restrittive verranno create istantaneamente.

4. **Recupera le credenziali API:**
   - Nel menu laterale sinistro, vai su **Project Settings** (icona ingranaggio) > **API**.
   - Troverai due informazioni essenziali da copiare:
     - **Project URL** (es. `https://xyzabc.supabase.co`)
     - **Project API Keys**:
       - `service_role` `secret`: la chiave segreta di servizio per il backend Next.js (da conservare rigorosamente segreta sul server e non esporre mai nel frontend).

---

## 2. Pubblicazione su Vercel

[Vercel](https://vercel.com) è la piattaforma ideale e nativa per ospitare applicazioni Next.js gratuitamente con dominio HTTPS e certificato SSL automatico.

### Passaggi:

1. **Carica il codice su GitHub:**
   - Crea un repository privato o pubblico su GitHub ed esegui il push del progetto Flatflow:
     ```bash
     git remote add origin https://github.com/tuo-username/flatflow.git
     git push -u origin main
     ```

2. **Collega il progetto su Vercel:**
   - Accedi a [vercel.com](https://vercel.com) con il tuo account GitHub.
   - Clicca su **«Add New...»** > **«Project»**.
   - Seleziona il repository `flatflow` e clicca su **«Import»**.

3. **Configura le Variabili d'Ambiente (Environment Variables):**
   Prima di cliccare su *Deploy*, espandi la sezione **«Environment Variables»** e aggiungi le seguenti variabili obbligatorie:

   | Nome Variabile | Valore / Descrizione | Esempio |
   | :--- | :--- | :--- |
   | `HOUSE_SECRET_CODE` | Il codice segreto che i coinquilini useranno per accedere | `casaNostra2026!` |
   | `SESSION_SECRET` | Stringa casuale sicura di almeno 32 caratteri per la firma dei cookie HMAC | `f83j2k9s8d7f6g5h4j3k2l1m9n8b7v6c5` |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del tuo progetto Supabase | `https://xyzabc.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | La chiave `service_role` segreta ottenuta da Supabase | `eyJhbGciOi...` |

4. **Avvia il Deployment:**
   - Clicca su **«Deploy»**.
   - Vercel compilerà ed eseguirà la build in circa 45 secondi.
   - Al termine, riceverai un URL HTTPS condivisibile (es. `https://flatflow-xyz.vercel.app`).

---

## 3. Limiti dei Piani Gratuiti (Free Tier)

Sia Supabase sia Vercel offrono piani gratuiti ideali per 3 coinquilini:

### Supabase (Free Tier):
- **Database:** fino a 500 MB di spazio (Flatflow occupa meno di 5 MB in diversi anni di utilizzo normale).
- **Richieste:** fino a 500.000 richieste API al mese (un uso tipico di 3 coinquilini genera meno di 1.000 richieste/mese).
- **Pausa progetti inattivi:** se un progetto Supabase gratuito non riceve alcuna query per oltre 7 giorni consecutivi, può essere sospeso temporaneamente. È sufficiente aprire l'app o accedere alla dashboard di Supabase per riattivarlo in 30 secondi.

### Vercel (Hobby Tier):
- **Banda:** 100 GB al mese (Flatflow consuma una frazione trascurabile di questo limite).
- **Funzioni Serverless:** 100.000 invocazioni giornaliere (ampiamente sufficienti).
- **SSL / HTTPS:** Certificato SSL LetsEncrypt gestito e rinnovato automaticamente a costo zero.

---

## 4. Come Utilizzare l'Applicazione tra Coinquilini

### Primo Accesso da Smartphone:
1. Condividi il link Vercel con i tuoi due coinquilini (es. tramite chat).
2. All'apertura della pagina, ciascuno inserisce il **codice segreto della casa** (`HOUSE_SECRET_CODE`).
3. Il server verifica il codice e memorizza la sessione sul browser del dispositivo per 1 anno tramite cookie sicuro HTTP-only, evitando di doverlo reinserire a ogni accesso.
4. L'app chiede: **«Chi sei?»**: ciascun coinquilino seleziona il proprio nome dalla lista dei tre profili.

### Installazione come PWA (Icona su Schermata Home):
Per avere la sensazione di un'applicazione nativa senza barra degli indirizzi:
- **Su iPhone (Safari):**
  1. Apri il link su Safari.
  2. Tocca l'icona **Condividi** (il quadrato con la freccia verso l'alto in basso al centro).
  3. Scorri e seleziona **«Aggiungi alla schermata Home»**.
  4. Premi **«Aggiungi»**.
- **Su Android (Chrome / Brave / Firefox):**
  1. Apri il link su Chrome.
  2. Tocca i tre puntini in alto a destra.
  3. Seleziona **«Installa applicazione»** o **«Aggiungi a schermata Home»**.

### Flusso Quotidiano delle Attività:
- **Lunedì mattina (fuso orario italiano Europe/Rome):** Le pulizie delle tre aree (*Cucina*, *Bagno*, *Ingresso e corridoio*) ruotano automaticamente a mezzanotte.
- **Durante la settimana:**
  - Quando fai la tua pulizia, apri l'app e premi **«Ho pulito»**.
  - Se non puoi farla, premi **«Non posso pulire»**: il sistema passerà l'incarico a un altro coinquilino disponibile seguendo l'ordine prestabilito (0 → 1 → 2 → 0).
  - Se sei via tutta la settimana, attiva **«Sono assente questa settimana»**: non riceverai alcun compito e le attività verranno distribuite tra chi è presente. Se avevi la spazzatura aperta, verrà riassegnata immediatamente a un coinquilino presente senza alterare la coda.
- **Spazzatura:**
  - Quando il bidone è pieno, premi **«Segnala spazzatura piena»**.
  - Il sistema assegna il compito al coinquilino in cima alla coda equa.
  - Chi la butta preme **«Ho buttato la spazzatura»** e passa in fondo alla coda.
  - Chi rinuncia preme **«Non posso»**: viene saltato per questa volta ma mantiene la priorità per il prossimo turno.
- **Modifica dei nomi:**
  - Nella schermata **Impostazioni**, puoi aggiornare in ogni momento i nomi dei tre coinquilini. I nomi registrati nelle pulizie già completate o incomplete nello storico rimarranno preservati fedelmente.
