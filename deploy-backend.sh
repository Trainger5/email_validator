#!/bin/bash
# EC2 Backend Deployment Script for Python Email Validator

echo "=== Email Validator Backend Deployment Script ==="
echo ""

# Configuration - UPDATE THESE VALUES
EC2_HOST="13.235.49.247"          # Your EC2 public IP address
EC2_USER="ubuntu"
SSH_KEY="U:\credential\mailer123.pem"         # Path to your .pem file
DEPLOY_DIR="/opt/email-validator"

echo "Step 1: Update system and install dependencies..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << 'ENDSSH'
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git
ENDSSH

echo ""
echo "Step 2: Create application directory..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << ENDSSH
sudo mkdir -p $DEPLOY_DIR
sudo chown $EC2_USER:$EC2_USER $DEPLOY_DIR
ENDSSH

echo ""
echo "Step 3: Upload application files..."
# Upload backend files
scp -i "$SSH_KEY" -r ../email_validator.py ../server.py ../storage.py ../xlsx_utils.py "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/"

# Upload requirements if exists
if [ -f "../requirements.txt" ]; then
    scp -i "$SSH_KEY" ../requirements.txt "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/"
fi

echo ""
echo "Step 4: Setup Python virtual environment..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << ENDSSH
cd $DEPLOY_DIR
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# Install dependencies
pip install flask flask-cors pyjwt bcrypt openpyxl dnspython

# Create data directory
mkdir -p data
ENDSSH

echo ""
echo "Step 5: Create systemd service..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << ENDSSH
sudo tee /etc/systemd/system/emailvalidator.service > /dev/null <<EOF
[Unit]
Description=Email Validator API
After=network.target

[Service]
Type=simple
User=$EC2_USER
WorkingDirectory=$DEPLOY_DIR
Environment="PATH=$DEPLOY_DIR/venv/bin"
ExecStart=$DEPLOY_DIR/venv/bin/python server.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable emailvalidator
sudo systemctl start emailvalidator
sudo systemctl status emailvalidator
ENDSSH

echo ""
echo "Step 6: Configure Nginx..."
ssh -i "$SSH_KEY" "$EC2_USER@$EC2_HOST" << ENDSSH
sudo tee /etc/nginx/sites-available/emailvalidator > /dev/null <<EOF
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        
        if (\\\$request_method = 'OPTIONS') {
            return 204;
        }
    }
}
EOF

# Remove default Nginx site
sudo rm -f /etc/nginx/sites-enabled/default

sudo ln -sf /etc/nginx/sites-available/emailvalidator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
ENDSSH

echo ""
echo "=== Deployment Complete! ==="
echo ""
echo "Backend is now running at: http://$EC2_HOST"
echo ""
echo "Next steps:"
echo "1. SSH to EC2 and create .env file in $DEPLOY_DIR"
echo "2. Test API: curl http://$EC2_HOST/health"
echo "3. Update frontend .env.production with: VITE_API_BASE=http://$EC2_HOST"
echo ""
echo "IMPORTANT: Backend is running on HTTP (not HTTPS)."
echo "For production, consider setting up a domain and SSL certificate."
