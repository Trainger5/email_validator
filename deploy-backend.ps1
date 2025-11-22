# EC2 Backend Deployment Script for Windows (PowerShell)
# Run this in PowerShell

$ErrorActionPreference = "Stop"

# Configuration
$EC2_HOST = "13.235.49.247"
$EC2_USER = "ubuntu"
$SSH_KEY = "U:\credential\mailer123.pem"
$DEPLOY_DIR = "/opt/email-validator"

Write-Host "=== Email Validator Backend Deployment ===" -ForegroundColor Green
Write-Host ""

# Test SSH connection
Write-Host "Testing SSH connection..." -ForegroundColor Yellow
try {
    ssh -i $SSH_KEY "${EC2_USER}@${EC2_HOST}" "echo 'Connection successful'"
    Write-Host "✓ SSH connection verified" -ForegroundColor Green
} catch {
    Write-Host "✗ SSH connection failed. Check your SSH key and EC2 IP." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 1: Update system and install dependencies..." -ForegroundColor Yellow
ssh -i $SSH_KEY "${EC2_USER}@${EC2_HOST}" @"
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv nginx git
"@

Write-Host ""
Write-Host "Step 2: Create application directory..." -ForegroundColor Yellow
ssh -i $SSH_KEY "${EC2_USER}@${EC2_HOST}" @"
sudo mkdir -p $DEPLOY_DIR
sudo chown ${EC2_USER}:${EC2_USER} $DEPLOY_DIR
"@

Write-Host ""
Write-Host "Step 3: Upload application files..." -ForegroundColor Yellow
Write-Host "Uploading Python files..." -ForegroundColor Cyan

# Upload main files
scp -i $SSH_KEY email_validator.py "${EC2_USER}@${EC2_HOST}:${DEPLOY_DIR}/"
scp -i $SSH_KEY server.py "${EC2_USER}@${EC2_HOST}:${DEPLOY_DIR}/"
scp -i $SSH_KEY storage.py "${EC2_USER}@${EC2_HOST}:${DEPLOY_DIR}/"
scp -i $SSH_KEY xlsx_utils.py "${EC2_USER}@${EC2_HOST}:${DEPLOY_DIR}/"

Write-Host "✓ Files uploaded" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Setup Python virtual environment..." -ForegroundColor Yellow
ssh -i $SSH_KEY "${EC2_USER}@${EC2_HOST}" @"
cd $DEPLOY_DIR
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install flask flask-cors pyjwt bcrypt openpyxl dnspython
mkdir -p data
"@

Write-Host ""
Write-Host "Step 5: Create systemd service..." -ForegroundColor Yellow
ssh -i $SSH_KEY "${EC2_USER}@${EC2_HOST}" @"
sudo tee /etc/systemd/system/emailvalidator.service > /dev/null <<'EOF'
[Unit]
Description=Email Validator API
After=network.target

[Service]
Type=simple
User=${EC2_USER}
WorkingDirectory=${DEPLOY_DIR}
Environment="PATH=${DEPLOY_DIR}/venv/bin"
ExecStart=${DEPLOY_DIR}/venv/bin/python server.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable emailvalidator
sudo systemctl start emailvalidator
"@

Write-Host ""
Write-Host "Step 6: Configure Nginx..." -ForegroundColor Yellow
ssh -i $SSH_KEY "${EC2_USER}@${EC2_HOST}" @"
sudo tee /etc/nginx/sites-available/emailvalidator > /dev/null <<'EOF'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host \`$host;
        proxy_set_header X-Real-IP \`$remote_addr;
        proxy_set_header X-Forwarded-For \`$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \`$scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        
        if (\`$request_method = 'OPTIONS') {
            return 204;
        }
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/emailvalidator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
"@

Write-Host ""
Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Backend is now running at: http://${EC2_HOST}" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Create .env file on EC2 with your configuration" -ForegroundColor White
Write-Host "   Run: ssh -i `"$SSH_KEY`" ${EC2_USER}@${EC2_HOST}" -ForegroundColor Gray
Write-Host "   Then: cd $DEPLOY_DIR && nano .env" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test API:" -ForegroundColor White
Write-Host "   curl http://${EC2_HOST}/health" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update frontend .env.production with:" -ForegroundColor White
Write-Host "   VITE_API_BASE=http://${EC2_HOST}" -ForegroundColor Gray
Write-Host ""
