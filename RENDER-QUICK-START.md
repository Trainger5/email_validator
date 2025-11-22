# 🚀 Quick Render Deployment Guide

## Prerequisites
- GitHub account
- Render.com account (free signup)

## Step-by-Step

### 1️⃣ Push to GitHub

```bash
cd u:\email-validator

# Initialize git (if needed)
git init
git add .
git commit -m "Ready for Render deployment"

# Create repo on GitHub then:
git remote add origin https://github.com/YOUR_USERNAME/email-validator.git
git branch -M main
git push -u origin main
```

### 2️⃣ Deploy on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Select `email-validator` repo
5. Render detects `render.yaml` automatically
6. Click **"Apply"**
7. Wait 3-5 minutes for deployment

### 3️⃣ Get Your URL

- After deployment: `https://YOUR-APP-NAME.onrender.com`
- Test health: `https://YOUR-APP-NAME.onrender.com/health`

### 4️⃣ Update Frontend

1. Edit `frontend/.env.production`:
   ```
   VITE_API_BASE=https://YOUR-APP-NAME.onrender.com
   ```

2. Rebuild:
   ```bash
   cd frontend
   npm run build
   ```

3. Upload `dist/` to Hostinger

### 5️⃣ Test SMTP

Try validating an email:
- ✅ If "deliverable" → Port 25 works!
- ❌ If "unknown" → Port 25 blocked (consider Oracle Cloud)

---

## ⚡ Important Notes

**Free Tier Limitations:**
- App sleeps after 15 minutes
- First request after sleep takes ~30s
- 750 hours/month (not 24/7)

**Keep Awake (Optional):**
Use UptimeRobot to ping `/health` every 10 minutes

---

**Need help?** Check [RENDER-DEPLOYMENT.md](RENDER-DEPLOYMENT.md) for detailed instructions.
