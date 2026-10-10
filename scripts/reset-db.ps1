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
$rawDbUrl = $env:DATABASE_URL

if (-not $rawDbUrl) {
    $envLocalPath = Join-Path $PSScriptRoot "..\.env.local"
    if (Test-Path $envLocalPath) {
        $line = Get-Content $envLocalPath | Where-Object { $_ -match '^\s*DATABASE_URL\s*=\s*(.+)$' } | Select-Object -First 1
        if ($line) {
            $rawDbUrl = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim()
            $rawDbUrl = $rawDbUrl.Trim('"').Trim("'")
        }
    }
}

if (-not $rawDbUrl) {
    Write-Host ""
    Write-Host "Nessuna variabile DATABASE_URL rilevata in ambiente o in .env.local." -ForegroundColor Yellow
    Write-Host "Reperibile su Supabase -> Project Settings -> Database -> Connection string (URI)." -ForegroundColor Yellow
    Write-Host ""
    $secInput = Read-Host -AsSecureString "Inserisci la Connection String PostgreSQL (l'input sara' oscurato a schermo)"
    if ($secInput) {
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secInput)
        $rawDbUrl = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if ([string]::IsNullOrWhiteSpace($rawDbUrl)) {
    Write-Host "ERRORE: Connection string non fornita. Operazione annullata." -ForegroundColor Red
    exit 1
}

# 4. Parsing sicuro della connection string per isolare la password e identificare il database
$cleanUri = $rawDbUrl
$hostName = ""
$port = 5432
$user = ""
$dbName = ""
$password = ""
$projectRef = "N/D"

try {
    $uri = [System.Uri]$rawDbUrl
    if ($uri.UserInfo) {
        $parts = $uri.UserInfo -split ':', 2
        $user = [System.Uri]::UnescapeDataString($parts[0])
        if ($parts.Length -gt 1) {
            $password = [System.Uri]::UnescapeDataString($parts[1])
        }
    }
    $hostName = $uri.Host
    $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    $dbName = $uri.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "postgres" }

    # Rilevamento riferimento del progetto Supabase
    if ($user -match '^postgres\.(.+)$') {
        $projectRef = $matches[1]
    } elseif ($hostName -match '^db\.(.+?)\.supabase\.co$') {
        $projectRef = $matches[1]
    }

    # Ricostruzione della URI sanificata priva di password
    $query = $uri.Query
    if ([string]::IsNullOrWhiteSpace($user)) {
        $cleanUri = "$($uri.Scheme)://$hostName`:$port/$dbName$query"
    } else {
        $cleanUri = "$($uri.Scheme)://$user@$hostName`:$port/$dbName$query"
    }
} catch {
    # Fallback per stringhe formato chiave-valore
    if ($rawDbUrl -match 'password=([^ ]+)') {
        $password = $matches[1]
        $cleanUri = $rawDbUrl -replace 'password=[^ ]+', ''
    }
    if ($rawDbUrl -match 'host=([^ ]+)') { $hostName = $matches[1] }
    if ($rawDbUrl -match 'dbname=([^ ]+)') { $dbName = $matches[1] }
    if ($rawDbUrl -match 'user=([^ ]+)') { $user = $matches[1] }
    if ($rawDbUrl -match 'port=([^ ]+)') { $port = $matches[1] }
    if ($hostName -match '^db\.(.+?)\.supabase\.co$') { $projectRef = $matches[1] }
}

# Se la password non era presente nella stringa ma è in PGPASSWORD
if (-not $password -and $env:PGPASSWORD) {
    $password = $env:PGPASSWORD
}

# Se ancora assente, richiedila in modo sicuro senza mostrarla nel terminale
if (-not $password) {
    $secPass = Read-Host -AsSecureString "Password del database (l'input sara' oscurato a schermo)"
    if ($secPass) {
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
        $password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

# 5. Visualizzazione chiara del target prima della conferma esplicita
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "  ATTENZIONE: RESET DATI DI PROVA FLATFLOW                " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "DATABASE DI DESTINAZIONE:" -ForegroundColor Cyan
Write-Host "  - Host / Endpoint:   $hostName" -ForegroundColor Cyan
if ($projectRef -ne "N/D") {
    Write-Host "  - Progetto Supabase: $projectRef" -ForegroundColor Cyan
}
Write-Host "  - Database:          $dbName" -ForegroundColor Cyan
Write-Host "  - Utente:            $user" -ForegroundColor Cyan
Write-Host "  - Porta:             $port" -ForegroundColor Cyan
Write-Host ""
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

# 6. Esecuzione tramite psql con ON_ERROR_STOP=1 e password sicura tramite PGPASSWORD
Write-Host ""
Write-Host "Esecuzione dello script di reset in corso..." -ForegroundColor Cyan

try {
    # Imposta la password solo per l'ambiente temporaneo del processo
    if ($password) {
        $env:PGPASSWORD = $password
    }

    # Esegui psql passando l'URI sanificato (senza password negli argomenti) e ON_ERROR_STOP=1
    & psql "$cleanUri" -v ON_ERROR_STOP=1 -f "$sqlScriptPath"
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
} finally {
    # Rimuovi sempre la password dalla variabile d'ambiente
    $env:PGPASSWORD = $null
    Remove-Item env:\PGPASSWORD -ErrorAction SilentlyContinue
}
