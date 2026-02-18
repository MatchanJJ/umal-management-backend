# Start All Services

## 🚀 Quick Start (All Services)

Run this single command to start everything:

```powershell
.\start-all-services.ps1
```

This will automatically start:
- ✅ Laravel Backend on **http://localhost:8000**
- ✅ NLP API Service on **http://localhost:8001**
- ✅ API Documentation at **http://localhost:8001/docs**

Press `Ctrl+C` to stop all services.

---

## 🔧 Manual Start (Individual Services)

If you prefer to start services individually:

### Option 1: Start Each Service in Separate Terminals

**Terminal 1 - Laravel Backend:**
```powershell
php -S localhost:8000 -t public
```

**Terminal 2 - NLP API Service:**
```powershell
cd nlp-service
uvicorn main:app --reload --port 8001
```

OR use the startup script:
```powershell
cd nlp-service
.\start-nlp.ps1
```

### Option 2: Start Laravel Only

If you don't need the NLP service:
```powershell
php -S localhost:8000 -t public
```

---

## 📍 Service URLs

Once started, access these URLs:

| Service | URL | Description |
|---------|-----|-------------|
| **Laravel App** | http://localhost:8000 | Main application |
| **Login Page** | http://localhost:8000/login | Google SSO login |
| **NLP API** | http://localhost:8001 | Natural language parsing API |
| **API Docs** | http://localhost:8001/docs | Interactive API documentation |
| **API Health** | http://localhost:8001/health | Service health check |

---

## 🛑 Stop Services

**If using the startup script:**
- Press `Ctrl+C` in the terminal

**If running manually:**
- Press `Ctrl+C` in each terminal window

**Kill all PHP processes:**
```powershell
Get-Process php -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Kill all Python processes:**
```powershell
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

## 🔍 Troubleshooting

### Port Already in Use

If you get port errors:

**Check what's using port 8000:**
```powershell
netstat -ano | Select-String ":8000"
```

**Check what's using port 8001:**
```powershell
netstat -ano | Select-String ":8001"
```

**Kill specific process (replace PID):**
```powershell
Stop-Process -Id <PID> -Force
```

### Assets Not Loading

Rebuild frontend assets:
```powershell
npm run build
php artisan config:clear
```

### NLP Service Not Working

Make sure you've trained the index first:
```powershell
cd nlp-service
python train_index.py
```

---

## 📦 First Time Setup

If this is your first time running:

1. **Install dependencies:**
   ```powershell
   composer install
   npm install
   cd nlp-service
   pip install -r requirements.txt
   cd ..
   ```

2. **Setup database:**
   ```powershell
   php artisan migrate
   php artisan db:seed
   ```

3. **Build assets:**
   ```powershell
   npm run build
   ```

4. **Train NLP model:**
   ```powershell
   cd nlp-service
   python train_index.py
   cd ..
   ```

5. **Start services:**
   ```powershell
   .\start-all-services.ps1
   ```

---

## ✅ Test Your Setup

1. **Laravel:** http://localhost:8000/login
2. **NLP API Docs:** http://localhost:8001/docs
3. **NLP Health Check:** http://localhost:8001/health

If all three URLs work, you're ready to go! 🎉
