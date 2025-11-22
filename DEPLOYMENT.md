# Quick Deployment Guide

## Prerequisites Checklist

Before you begin, make sure you have:

**For EC2 Backend:**
- [ ] AWS account with EC2 access
- [ ] EC2 instance launched (Ubuntu 22.04 recommended)
- [ ] SSH key (.pem file) for EC2 access
- [ ] Security group allows ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8080 (backend)
- [ ] Domain or subdomain for API (e.g., `api.yourdomain.com`)

**For Hostinger Frontend:**
- [ ] Hostinger hosting account
- [ ] Domain configured in Hostinger
- [ ] FTP/SFTP credentials OR access to Hostinger File Manager
- [ ] NOTE: Hostinger often provides free SSL certificates automatically

---

## Step-by-Step Deployment

### Part 1: Backend on EC2

#### Option A: Automated Deployment (Linux/Mac)

1. **Configure the deployment script:**
   
   Edit `deploy-backend.sh` and update these variables:
   ```bash
   EC2_HOST="your-ec2-ip-address"        # Your EC2 public IP
   EC2_USER="ubuntu"                      # Keep as 'ubuntu' for Ubuntu AMI
   SSH_KEY="path/to/your-key.pem"        # Path to your .pem file
   DOMAIN="api.yourdomain.com"           # Your API subdomain
   ```

2. **Make the script executable:**
   ```bash
   chmod +x deploy-backend.sh
   ```

3. **Run the deployment:**
   ```bash
   ./deploy-backend.sh
   ```

4. **Configure environment on EC2:**
   
   SSH to your EC2 instance:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```
   
   Create `.env` file:
   ```bash
   cd /opt/email-validator
   nano .env
   ```
   
   Add this configuration (update values):
   ```env
   PORT=8080
   CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   JWT_SECRET=your-random-32-character-secret-here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
   ENV=production
   ```

5. **Setup SSL:**
   ```bash
   sudo certbot --nginx -d api.yourdomain.com
   ```

6. **Test the API:**
   ```bash
   curl https://api.yourdomain.com/health
   ```

#### Option B: Manual Deployment

See [deployment_plan.md](file:///C:/Users/AED/.gemini/antigravity/brain/15945556-bf8d-4ee0-a03c-722c79b0385c/deployment_plan.md) for full manual instructions.

---

### Part 2: Frontend on Hostinger

#### Step 1: Configure Environment

Create `frontend/.env.production` file (note: this file is gitignored, create it locally):
```env
VITE_API_BASE=https://api.yourdomain.com
```

#### Step 2: Build Frontend

**On Windows:**
```cmd
cd frontend
deploy.bat
```

**On Linux/Mac:**
```bash
cd frontend
npm install
npm run build
```

This creates a `dist/` folder with all production files.

#### Step 3: Upload to Hostinger

**Method 1: Hostinger File Manager (Recommended for beginners)**

1. Login to Hostinger control panel
2. Go to **File Manager**
3. Navigate to `public_html` directory
4. **Delete all existing files** (or backup first!)
5. Click **Upload** and select ALL files from `frontend/dist/` folder
6. **Important:** Make sure to upload the `.htaccess` file from `frontend/.htaccess`

**Method 2: FTP (Using FileZilla or similar)**

1. Open your FTP client
2. Connect using Hostinger FTP credentials:
   - Host: `ftp.yourdomain.com` (check Hostinger panel for exact host)
   - Username: Your FTP username from Hostinger
   - Password: Your FTP password
   - Port: 21 (or 22 for SFTP)

3. Navigate to `public_html` directory on remote server
4. Delete all existing files
5. Upload all files from `frontend/dist/` to `public_html/`
6. Upload `frontend/.htaccess` to `public_html/.htaccess`

#### Step 4: Enable SSL on Hostinger

1. Go to Hostinger control panel
2. Navigate to **SSL** section
3. If not already enabled, install **Free SSL (Let's Encrypt)**
4. Wait a few minutes for SSL to activate

#### Step 5: Test Your Frontend

Visit `https://yourdomain.com` in your browser. You should see the landing page.

---

## DNS Configuration

**IMPORTANT:** Your domain DNS must be configured correctly:

### For Backend (api.yourdomain.com)
Add an A record in your DNS settings:
- **Type**: A
- **Name**: api
- **Value**: Your EC2 public IP address
- **TTL**: 3600 (or leave as default)

### For Frontend (yourdomain.com)
If you're using Hostinger's nameservers, this should already be configured. If custom nameservers:
- **Type**: A
- **Name**: @ (or leave blank for root domain)
- **Value**: Your Hostinger server IP (find in Hostinger panel)

**Note:** DNS changes can take up to 48 hours to propagate (usually much faster).

---

## Testing Checklist

After deployment, test these:

- [ ] Backend API health check: `https://api.yourdomain.com/health`
- [ ] Frontend loads: `https://yourdomain.com`
- [ ] Landing page displays correctly
- [ ] Can navigate to login page
- [ ] Can login with admin credentials
- [ ] After login, dashboard loads
- [ ] Email validation works
- [ ] All routes work (no 404 when refreshing)
- [ ] HTTPS works on both frontend and backend
- [ ] Mobile view looks good

---

## Troubleshooting

### Backend Issues

**Service not starting:**
```bash
# Check service status
sudo systemctl status emailvalidator

# View logs
sudo journalctl -u emailvalidator -n 50 -f

# Check if port 8080 is in use
sudo netstat -tulpn | grep 8080
```

**CORS errors:**
- Make sure `CORS_ORIGINS` in `.env` matches your frontend domain exactly
- Check that you included `https://` in the origin

**502 Bad Gateway:**
- Backend service is not running
- Check logs: `sudo journalctl -u emailvalidator -f`

### Frontend Issues

**404 on page refresh:**
- `.htaccess` file is missing or not uploaded
- Check `public_html/.htaccess` exists

**Can't connect to API:**
- Check browser console for errors
- Verify `VITE_API_BASE` in build matches your API URL
- Rebuild frontend after fixing: `npm run build` and re-upload

**Changes not showing:**
- Clear browser cache (Ctrl+Shift+R)
- Check if correct files are uploaded
- Verify you uploaded from `dist/` folder, not `src/`

---

## Updating Your App

### Backend Updates

```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Navigate to app directory
cd /opt/email-validator

# Pull latest code (if using git)
git pull

# Or upload new files via SCP
# scp -i your-key.pem server.py ubuntu@your-ec2-ip:/opt/email-validator/

# Restart service
sudo systemctl restart emailvalidator

# Check status
sudo systemctl status emailvalidator
```

### Frontend Updates

```bash
# Build new version
cd frontend
npm run build

# Upload dist/ contents to Hostinger public_html/
# Using FTP or File Manager as before
```

---

## Cost Estimate

- **EC2 t2.micro**: Free tier (first 12 months) or ~$8/month
- **Hostinger Basic**: ~$3-10/month (includes domain, SSL, email)
- **Total**: $3-18/month

---

## Security Reminders

- [ ] Change default admin password immediately
- [ ] Use strong JWT secret (32+ random characters)
- [ ] Keep EC2 system updated: `sudo apt update && sudo apt upgrade`
- [ ] Only open necessary ports in EC2 security group
- [ ] Enable automatic security updates on EC2
- [ ] Backup your data regularly

---

## Need Help?

- Backend logs: `sudo journalctl -u emailvalidator -f`
- Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Check service status: `sudo systemctl status emailvalidator`
- Test API manually: `curl https://api.yourdomain.com/health`
