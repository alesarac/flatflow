<#
.SYNOPSIS
    Azzera i dati operativi di prova di Flatflow su Supabase eseguendo supabase/reset.sql.

.DESCRIPTION
    Richiede una conferma esplicita prima di procedere.
    Utilizza la stringa di connessione PostgreSQL da:
    1. Variabile d'ambiente DATABASE_URL
    2. File .env.local (parametro DATABASE_URL)
    3. Richiesta interattiva all'utente (non memorizzata né pubblicata)
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# 1. Verifica dipendenza: psql
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERRORE: Il comando 'psql' (PostgreSQL CLI) non e' presente nel PATH di sistema." -ForegroundColor Red
    Write-Host ""
    Write-Host "Per eseguire il reset da terminale:" -ForegroundColor Yellow
    Write-Host "  1. Assicurati che PostgreSQL per Windows sia installato e che la cartella 'bin' sia nel PATH." -ForegroundColor Yellow
    Write-Host "  OPPURE" -ForegroundColor Yellow
    Write-Host "  2. Apri la dashboard di Supabase -> SQL Editor, incolla ed esegui il file 'supabase/reset.sql'." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# 2. Verifica percorso script SQL
$sqlScriptPath = Join-Path $PSScriptRoot "..\supabase\reset.sql"
if (-not (Test-Path $sqlScriptPath)) {
    Write-Host "ERRORE: File SQL non trovato nel percorso atteso: $sqlScriptPath" -ForegroundColor Red
    exit 1
}

# 3. Recupero credenziale di connessione (sicura e mai salvata nel repo)
$dbUrl = $env:DATABASE_URL

if (-not $dbUrl) {
    $envLocalPath = Join-Path $PSScriptRoot "..\.env.local"
    if (Test-Path $envLocalPath) {
        $line = Get-Content $envLocalPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=\s*(.+)$' } | Select-Object -First 1
        if ($line) {
            $dbUrl = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim()
            # Rimuovi eventuali apici singoli o doppi
            $dbUrl = $dbUrl.Trim('"').Trim("'")
        }
    }
}

if (-not $dbUrl) {
    Write-Host ""
    Write-Host "Nessuna variabile DATABASE_URL rilevata in ambiente o in .env.local." -ForegroundColor Yellow
    Write-Host "Reperibile su Supabase -> Project Settings -> Database -> Connection string (URI)." -ForegroundColor Yellow
    Write-Host ""
    $dbUrl = Read-Host "Inserisci la Connection String PostgreSQL (postgresql://...)"
}

if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    Write-Host "ERRORE: Connection string non fornita. Operazione annullata." -ForegroundColor Red
    exit 1
}

# 4. Richiesta conferma esplicita
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "  ATTENZIONE: RESET DATI DI PROVA FLATFLOW                " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "Questa operazione:" -ForegroundColor Yellow
Write-Host "  - Eliminera' tutte le pulizie registrate (completate e incomplete)" -ForegroundColor Yellow
Write-Host "  - Eliminera' tutte le assenze settimanali registrate" -ForegroundColor Yellow
Write-Host "  - Eliminera' tutte le segnalazioni e lo storico della spazzatura" -ForegroundColor Yellow
Write-Host "  - Eliminera' lo storico dei tentativi di accesso" -ForegroundColor Yellow
Write-Host "  - Ripristinera' la coda della spazzatura a [0, 1, 2]" -ForegroundColor Yellow
Write-Host ""
Write-Host "Verranno CONSERVATI:" -ForegroundColor Green
Write-Host "  - I 3 coinquilini e i rispettivi nomi" -ForegroundColor Green
Write-Host "  - Tutte le tabelle, funzioni RPC, indici e policy RLS" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host ""

$conferma = Read-Host "Digita 'CONFERMA' in maiuscolo per procedere"

if ($conferma -ne "CONFERMA") {
    Write-Host "Operazione annullata. Nessun dato e' stato modificato." -ForegroundColor Cyan
    exit 0
}

# 5. Esecuzione tramite psql
Write-Host ""
Write-Host "Esecuzione dello script di reset in corso..." -ForegroundColor Cyan

try {
    & psql "$dbUrl" -f "$sqlScriptPath"
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "SUCCESSO: Reset completato! Il database e' tornato allo stato iniziale." -ForegroundColor Green
        Write-Host "Alla prossima apertura dell'app verra' inizializzata la settimana corrente." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "ERRORE: psql ha terminato con codice di uscita $exitCode." -ForegroundColor Red
        exit $exitCode
    }
} catch {
    Write-Host "ERRORE durante l'esecuzione di psql: $_" -ForegroundColor Red
    exit 1
}
