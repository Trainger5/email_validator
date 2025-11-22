# Deploying to Render.com

## ⚠️ Important Notes

1. **Port 25 Warning**: Render.com may also block SMTP port 25. Email validation will work for syntax/MX checks but SMTP verification might fail.
2. **Free Tier Limitations**: 
   - Service sleeps after 15 minutes of inactivity
   - 750 hours/month free (not always-on)
   - First request after sleep takes 30-60 seconds to wake up

## 📋 Prerequisites

- GitHub account (Render deploys from Git repositories)
- Render.com account (free signup at https://render.com)

## 🚀 Deployment Steps

### Step 1: Push Code to GitHub

1. **Initialize Git** (if not already done):
```bash
cd u:\email-validator
git init
git add .
git commit -m "Initial commit - Email Validator"
```

2. **Create GitHub Repository**:
   - Go to https://github.com/new
   - Create a new repository (e.g., `email-validator`)
   - Don't initialize with README (we already have code)

3. **Push to GitHub**:
```bash
git remote add origin https://github.com/YOUR_USERNAME/email-validator.git
git branch -M main
git push -u origin main
```

---

### Step 2: Deploy on Render

#### Method A: Using Blueprint (Recommended)

1. **Login to Render**: https://dashboard.render.com
2. **Click "New +"** → **"Blueprint"**
3. **Connect your GitHub repository**
4. **Select** `email-validator` repository
5. Render will detect `render.yaml` and create the service automatically
6. **Click "Apply"**
7. Wait for deployment (3-5 minutes)

#### Method B: Manual Setup

1. **Login to Render**: https://dashboard.render.com
2. **Click "New +"** → **"Web Service"**
3. **Connect GitHub** and select your repository
4. **Configure:**
   - **Name**: `email-validator-api`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py --host 0.0.0.0 --port $PORT --db-path /var/data/validations.db`
   - **Plan**: Free
5. **Add Persistent Disk**:
   - Go to service settings
   - Click "Disks" → "Add Disk"
   - **Name**: `email-validator-data`
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB
6. **Deploy**

---

### Step 3: Get Your API URL

After deployment completes:
1. Go to your service dashboard
2. Copy the URL (e.g., `https://email-validator-api.onrender.com`)
3. **Test it**: `https://email-validator-api.onrender.com/health`

---

### Step 4: Update Frontend

1. **Update** `frontend/.env.production`:
```
VITE_API_BASE=https://email-validator-api.onrender.com
```

2. **Rebuild frontend**:
```bash
cd frontend
npm run build
```

3. **Upload to Hostinger** (same as before):
   - Upload `dist/` folder contents
   - Upload `.htaccess`

---

### Step 5: Test SMTP Validation

After deployment, test if SMTP works:

1. Go to your deployed frontend
2. Try validating: `test@gmail.com`
3. Check the result:
   - ✅ If it shows "deliverable" → SMTP works!
   - ❌ If it shows "unknown (smtp_unreachable)" → Port 25 is blocked

**If port 25 is blocked on Render:**
- Consider Oracle Cloud (guaranteed to work)
- Request Render support to unblock port 25
- Accept syntax/MX validation only (no SMTP)

---

## 🔧 Environment Variables (Optional)

You can set these in Render dashboard → Settings → Environment:

| Variable | Value | Description |
|----------|-------|-------------|
| `ADMIN_USERNAME` | `admin` | Default admin username |
| `ADMIN_PASSWORD` | `your-password` | Change default password |
| `PORT` | Auto-set by Render | HTTP port |

---

## 📊 Monitoring

- **Logs**: Render Dashboard → Logs tab
- **Metrics**: Render Dashboard → Metrics tab
- **Wake from sleep**: First request will be slow (~30-60s)

---

## ⚡ Free Tier Limitations Workaround

To keep service awake (optional):
- Use a monitoring service like UptimeRobot (free)
- Ping your `/health` endpoint every 10 minutes
- This prevents the service from sleeping

---

## 🆘 Troubleshooting

### Service won't start
- Check logs in Render dashboard
- Verify `requirements.txt` has all dependencies
- Ensure Python version is 3.11+

### Database errors
- Check if persistent disk is mounted at `/var/data`
- Verify disk has write permissions

### SMTP not working
- Port 25 is likely blocked
- Check logs for connection errors
- Consider Oracle Cloud alternative

---

## 🎯 Next Steps

1. Push code to GitHub
2. Deploy on Render
3. Test SMTP validation
4. If SMTP works → You're done! 🎉
5. If SMTP blocked → Consider migrating to Oracle Cloud

Need help? Check Render documentation: https://render.com/docs
