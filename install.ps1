# economic-deploy.ps1
# All-in-one deployment script for E-conomic API Integration

# Function to display colored section headers
function Write-Section {
    param([string]$text)
    Write-Host ""
    Write-Host "=== $text ===" -ForegroundColor Cyan
    Write-Host ""
}

# Function to check if we should continue after a step
function Confirm-Continue {
    param(
        [string]$message = "Continue to the next step?",
        [switch]$optional
    )
    
    if ($optional) {
        $response = Read-Host "$message (Y/n)"
        return ($response -ne "n")
    } else {
        $response = Read-Host "$message (y/N)"
        return ($response -eq "y")
    }
}

# Main script starts here
Clear-Host
Write-Host "E-conomic API Integration - Deployment Script" -ForegroundColor Green
Write-Host "-----------------------------------------------"

# Set paths
$nodePath = "C:\Program Files\nodejs\node.exe"
$npmPath = "C:\Program Files\nodejs\npm.cmd"

Write-Section "Checking Prerequisites"

# Check for Node.js
if (-not (Test-Path $nodePath)) {
    Write-Host "ERROR: Node.js not found at $nodePath" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/ (LTS version recommended)" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✓ Node.js found at $nodePath" -ForegroundColor Green

# Check for MariaDB
$mariaDBPath = "C:\Program Files\MariaDB 10.11\bin\mysql.exe"
if (-not (Test-Path $mariaDBPath)) {
    Write-Host "MariaDB not found. Installing..." -ForegroundColor Yellow
    
    # Create downloads directory if it doesn't exist
    $downloadDir = ".\downloads"
    if (-not (Test-Path $downloadDir)) {
        New-Item -ItemType Directory -Path $downloadDir | Out-Null
    }

    # Download MariaDB MSI
    $mariadbUrl = "https://mirror.group.one/mariadb//mariadb-11.7.2/winx64-packages/mariadb-11.7.2-winx64.msi"
    $installerPath = "$downloadDir\mariadb-installer.msi"
    
    Write-Host "Downloading MariaDB..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri $mariadbUrl -OutFile $installerPath
    } catch {
        Write-Host "Failed to download MariaDB: $_" -ForegroundColor Red
        exit 1
    }

    # Install MariaDB
    Write-Host "Installing MariaDB..." -ForegroundColor Cyan
    $rootPassword = "9A421C35!CA" # You might want to make this configurable
    $installArgs = "/i `"$installerPath`" /qn SERVICENAME=MariaDB ROOT_PASSWORD=`"$rootPassword`""
    
    try {
        Start-Process msiexec.exe -ArgumentList $installArgs -Wait
        Write-Host "✓ MariaDB installed successfully" -ForegroundColor Green
        
        # Update .env file with MariaDB credentials
        if (Test-Path ".env") {
            $envContent = Get-Content ".env" -Raw
            $envContent = $envContent -replace "DB_ROOT_PASSWORD=.*", "DB_ROOT_PASSWORD=$rootPassword"
            $envContent | Set-Content ".env"
        }
        
        # Wait for MariaDB service to start
        Write-Host "Starting MariaDB service..." -ForegroundColor Cyan
        Start-Service -Name "MariaDB"
        Start-Sleep -Seconds 10
    } catch {
        Write-Host "Failed to install MariaDB: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ MariaDB found at $mariaDBPath" -ForegroundColor Green
}

# Add MariaDB to PATH if not already there
$mariaDBBinPath = "C:\Program Files\MariaDB 11.7\bin"
if ($env:Path -notlike "*$mariaDBBinPath*") {
    Write-Host "Adding MariaDB to PATH..." -ForegroundColor Cyan
    $env:Path += ";$mariaDBBinPath"
    [Environment]::SetEnvironmentVariable(
        "Path",
        [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::Machine) + ";$mariaDBBinPath",
        [EnvironmentVariableTarget]::Machine
    )
}

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "WARNING: .env file not found!" -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        $createEnv = Read-Host "Would you like to create .env from .env.example? (Y/n)"
        if ($createEnv -ne "n") {
            Copy-Item ".env.example" ".env"
            Write-Host "✓ Created .env file from template" -ForegroundColor Green
            Write-Host "NOTE: You should edit the .env file with your actual configuration values." -ForegroundColor Yellow
            $editNow = Read-Host "Would you like to open .env for editing now? (y/N)"
            if ($editNow -eq "y") {
                Start-Process notepad.exe -ArgumentList ".env"
                Write-Host "Please save and close the file when done editing."
                Read-Host "Press Enter when ready to continue"
            }
        }
    } else {
        Write-Host "ERROR: .env.example not found. Cannot create .env file." -ForegroundColor Red
        if (-not (Confirm-Continue "Continue anyway?")) {
            exit 1
        }
    }
}

# Step 1: Install dependencies
Write-Section "Installing Dependencies"
try {
    Write-Host "Running npm install..." -ForegroundColor Cyan
    & $npmPath install --production
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
    }
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to install dependencies: $_" -ForegroundColor Red
    if (-not (Confirm-Continue "Continue to database setup?")) {
        exit 1
    }
}

# Step 2: Set up the database
Write-Section "Setting up Database"
try {
    Write-Host "Running database setup script..." -ForegroundColor Cyan
    & $nodePath setup-db.js
    if ($LASTEXITCODE -ne 0) {
        throw "Database setup failed with exit code $LASTEXITCODE"
    }
    Write-Host "✓ Database created successfully" -ForegroundColor Green
    
    Write-Host "Running database migrations..." -ForegroundColor Cyan
    & $nodePath src/db/run-migrations.js
    if ($LASTEXITCODE -ne 0) {
        throw "Database migrations failed with exit code $LASTEXITCODE"
    }
    Write-Host "✓ Database migrations completed successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Database setup failed: $_" -ForegroundColor Red
    if (-not (Confirm-Continue "Continue to connection test?")) {
        exit 1
    }
}

# Step 3: Start the application
Write-Section "Starting Application"
# Get port from .env file
$port = 3000 # Default port
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match 'PORT=(\d+)') {
        $port = $matches[1]
    }
}

Write-Host "The application will start on port $port" -ForegroundColor Cyan
Write-Host "You can verify it's working by navigating to: http://localhost:$port/health" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the application when done" -ForegroundColor Yellow
Write-Host ""

$startNow = Read-Host "Start the application now? (Y/n)"
if ($startNow -ne "n") {
    try {
        & $nodePath src/server.js
    } catch {
        Write-Host "ERROR: Failed to start application: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Application not started. You can start it manually with:" -ForegroundColor Yellow
    Write-Host "node src/server.js" -ForegroundColor Yellow
}

# End of script - this will only be reached if the application is not started
Write-Host ""
Write-Host "Deployment script completed." -ForegroundColor Green