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

## Installazione e Avvio

### 1. Clona il repository

```bash
git clone https://github.com/alesarac/flatloop.git
cd flatloop
```

### 2. Installa le dipendenze

```bash
npm install
```

### 3. Configura le variabili d'ambiente

Crea un file `.env.local` partendo dall'esempio:

```bash
cp .env.example .env.local
```

Configura i parametri richiesti (`HOUSE_SECRET_CODE`, `SESSION_SECRET`, ecc.). Per lo sviluppo offline senza Supabase, puoi impostare:

```env
USE_LOCAL_DB=true
```

### 4. Avvia l'applicazione

```bash
npm run dev
```

L'app sarà disponibile all'indirizzo [http://localhost:3000](http://localhost:3000).

---

## Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia l'ambiente di sviluppo locale |
| `npm run build` | Esegue la build di produzione |
| `npm run start` | Avvia l'applicazione compilata |
| `npm test` | Esegue i test automatizzati |
| `npm run test:watch` | Avvia i test in modalità watch |
