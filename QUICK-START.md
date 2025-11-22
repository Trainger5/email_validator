# Quick Start Deployment Guide (Public IP)

## What You Need

1. **EC2 Instance**
   - Ubuntu 22.04
   - Public IP address
   - SSH key (.pem file)
   - Security group allows: 22, 80, 8080

2. **Hostinger Account**
   - Domain configured
   - FTP access or File Manager access

---

## Step 1: Deploy Backend to EC2

### Option A: Automated (Recommended)

1. **Edit `deploy-backend.sh`:**
   ```bash
   EC2_HOST="YOUR_EC2_PUBLIC_IP"     # e.g., 54.123.45.67
   SSH_KEY="path/to/your-key.pem"     # e.g., ~/Downloads/my-key.pem
   ```

2. **Run deployment:**
   ```bash
   chmod +x deploy-backend.sh
   ./deploy-backend.sh
   ```

3. **Configure environment:**
   
   SSH to EC2:
   ```bash
   ssh -i your-key.pem ubuntu@YOUR_EC2_IP
   ```
   
   Create `.env`:
   ```bash
   cd /opt/email-validator
   nano .env
   ```
   
   Add (replace values):
   ```env
   PORT=8080
   CORS_ORIGINS=https://yourdomain.com
   JWT_SECRET=your-random-32-character-secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=YourSecurePassword123
   ENV=production
   ```
   
   Save (Ctrl+X, Y, Enter)

4. **Restart service:**
   ```bash
   sudo systemctl restart emailvalidator
   sudo systemctl status emailvalidator
   ```

5. **Test API:**
   ```bash
   curl http://YOUR_EC2_IP/health
   ```
   
   Should return: `{"status":"ok"}`

---

## Step 2: Build & Deploy Frontend

1. **Create `frontend/.env.production`:**
   ```env
   VITE_API_BASE=http://YOUR_EC2_PUBLIC_IP
   ```
   
   **Important:** Use `http://` (not `https://`) and your actual EC2 IP

2. **Build frontend:**
   ```cmd
   cd frontend
   npm install
   npm run build
   ```
   
   This creates `dist/` folder

3. **Upload to Hostinger:**
   
   **Using File Manager:**
   - Login to Hostinger
   - Go to File Manager
   - Navigate to `public_html`
   - Delete all files in `public_html`
   - Upload ALL files from `frontend/dist/`
   - Upload `frontend/.htaccess` to `public_html/.htaccess`
   
   **Using FTP:**
   - Connect to your Hostinger FTP
   - Go to `public_html` folder
   - Delete all existing files
   - Upload all from `frontend/dist/`
   - Upload `.htaccess` file

4. **Test your site:**
   
   Visit: `https://yourdomain.com`

---

## Important Notes

### Mixed Content Warning

Your backend is HTTP and frontend is HTTPS. Modern browsers may block HTTP requests from HTTPS pages.

**Solutions:**

**Option 1 - Temporary (Testing):**
Allow mixed content in browser (not recommended for production)

**Option 2 - Use HTTP for both (Testing only):**
- Frontend: `http://yourdomain.com` (disable Hostinger SSL)
- Backend: `http://YOUR_EC2_IP`

**Option 3 - Recommended for Production:**
Get a domain for your backend and setup SSL:
1. Point subdomain to EC2 (e.g., `api.yourdomain.com` → EC2 IP)
2. Run on EC2: `sudo certbot --nginx -d api.yourdomain.com`
3. Update frontend: `VITE_API_BASE=https://api.yourdomain.com`

---

## Testing Checklist

After deployment:

- [ ] Backend API responds: `curl http://YOUR_EC2_IP/health`
- [ ] Frontend loads at your domain
- [ ] Can see landing page
- [ ] Can navigate to login (check browser console for errors)
- [ ] Can login with admin credentials
- [ ] Dashboard loads after login
- [ ] Can validate emails

If you see CORS or mixed content errors in browser console, you may need to:
- Double-check CORS_ORIGINS in backend `.env`
- Consider SSL setup for backend

---

## Quick Commands

**Check backend status:**
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
sudo systemctl status emailvalidator
```

**View backend logs:**
```bash
sudo journalctl -u emailvalidator -f
```

**Restart backend:**
```bash
sudo systemctl restart emailvalidator
```

**Update backend code:**
```bash
cd /opt/email-validator
# upload new files via scp or git pull
sudo systemctl restart emailvalidator
```

---

## Troubleshooting

**Can't access backend:**
- Check EC2 security group allows port 80
- Check service is running: `sudo systemctl status emailvalidator`

**CORS errors:**
- Update CORS_ORIGINS in `/opt/email-validator/.env`
- Restart: `sudo systemctl restart emailvalidator`

**Mixed content warning:**
- See "Mixed Content Warning" section above
- Consider setting up SSL for backend

**Frontend routes not working:**
- Make sure `.htaccess` is uploaded
- Check file exists in `public_html/.htaccess`
