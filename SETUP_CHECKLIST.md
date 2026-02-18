# Quick Setup Checklist

Use this checklist to get your Google SSO and Event Management system up and running.

## ✅ Prerequisites

- [ ] PHP 8.2 or higher installed
- [ ] PostgreSQL database running
- [ ] Composer installed
- [ ] Node.js and npm installed
- [ ] Google Cloud Console account

## ✅ Step 1: Google OAuth Setup

### 1.1 Create Google Cloud Project
- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Create a new project (e.g., "UMAL Management")

### 1.2 Enable Required APIs
- [ ] Navigate to "APIs & Services" → "Library"
- [ ] Enable "Google+ API"

### 1.3 Create OAuth Credentials
- [ ] Go to "APIs & Services" → "Credentials"
- [ ] Click "Create Credentials" → "OAuth client ID"
- [ ] Configure OAuth consent screen if prompted
- [ ] Application type: "Web application"
- [ ] Name: "UMAL Management SSO"
- [ ] Authorized redirect URIs:
  - Development: `http://localhost:8000/auth/google/callback`
  - Production: `https://yourdomain.com/auth/google/callback`
- [ ] Copy the Client ID and Client Secret

## ✅ Step 2: Configure Environment

### 2.1 Copy Environment File
```bash
cp .env.example .env
```

### 2.2 Update Database Configuration
```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=umal_management_backend
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password
```

### 2.3 Add Google OAuth Credentials
```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

### 2.4 Set Application URL
```env
APP_URL=http://localhost:8000
```

### 2.5 Generate Application Key
```bash
php artisan key:generate
```

## ✅ Step 3: Install Dependencies

### 3.1 Install PHP Dependencies
```bash
composer install
```

### 3.2 Install Node Dependencies
```bash
npm install
```

## ✅ Step 4: Database Setup

### 4.1 Create Database
```sql
-- In PostgreSQL:
CREATE DATABASE umal_management_backend;
```

### 4.2 Run Migrations
```bash
php artisan migrate
```

**Expected output:** ~20 migration files should run successfully

### 4.3 Run Seeders
```bash
php artisan db:seed --class=MemberWhitelistSeeder
php artisan db:seed --class=RolesSeeder
php artisan db:seed --class=OrganizationsSeeder
php artisan db:seed --class=TimeSlotsSeeder
```

**Note:** If you get errors, make sure these seeder files exist. If not, you may need to create them.

## ✅ Step 5: Build Frontend Assets

### 5.1 Build for Development (with hot reload)
```bash
npm run dev
```

**OR**

### 5.2 Build for Production
```bash
npm run build
```

## ✅ Step 6: Start the Application

### 6.1 Start Laravel Development Server
```bash
php artisan serve
```

**Expected:** Server running on http://localhost:8000

### 6.2 Test the Application
- [ ] Visit http://localhost:8000/login
- [ ] You should see the Google Sign-In button

## ✅ Step 7: Test Authentication Flow

### 7.1 Test with Pre-seeded Admin
- [ ] Click "Sign in with Google"
- [ ] Sign in with a Google account using email: `admin@university.edu.ph`
  - **Note:** Must be an actual Google account with this email
- [ ] Should redirect to dashboard after successful login

### 7.2 Test with New User (Whitelist Flow)
- [ ] Log out (if logged in)
- [ ] Sign in with a different university email
- [ ] Should see "Pending Approval" page
- [ ] Log in as admin
- [ ] Navigate to Admin → Whitelist Management
- [ ] Approve the pending request
- [ ] Log out as admin
- [ ] Log in as the new user
- [ ] Should successfully access the system

## ✅ Step 8: Test Event Creation

### 8.1 Create Test Event
- [ ] Log in as admin or adviser
- [ ] Click "Create Event" in navigation
- [ ] Fill in event details:
  - Title: "Test Event"
  - Description: "This is a test event"
  - Status: "Scheduled"
- [ ] Add a schedule:
  - Date: Choose a future date
  - Time Slot: Select any
  - Venue: "Test Venue"
  - Required Volunteers: 5
- [ ] Submit the form

### 8.2 Verify Event was Created
- [ ] Navigate to Events page
- [ ] Should see "Test Event" in the list
- [ ] Click on the event to view details
- [ ] Should see the schedule you created

## ✅ Troubleshooting

### Issue: "Invalid credentials" when signing in
**Solution:**
- Double-check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
- Verify redirect URI in Google Console matches your .env setting exactly
- Clear browser cache and try again

### Issue: "SQLSTATE connection refused"
**Solution:**
- Make sure PostgreSQL is running
- Verify database credentials in .env
- Check if database exists: `psql -l` (list databases)

### Issue: "Class 'Socialite' not found"
**Solution:**
```bash
composer dump-autoload
php artisan config:clear
php artisan cache:clear
```

### Issue: Assets not loading (404 errors)
**Solution:**
```bash
npm run build
php artisan config:clear
```

### Issue: "Table 'time_slots' doesn't exist"
**Solution:**
- The TimeSlotsSeeder needs data
- Create some test time slots manually or update the seeder

### Issue: "Not whitelisted" after first login
**Solution:**
- Check email domain is in allowed list
- Edit `app/Models/MemberWhitelist.php` line ~93 to add your domain
- Run `php artisan config:clear`

## ✅ Verify Installation Complete

All of the following should work:

- [ ] ✅ Login page loads at http://localhost:8000/login
- [ ] ✅ Google OAuth redirects properly
- [ ] ✅ Pre-approved users can log in immediately
- [ ] ✅ New users see "Pending Approval" page
- [ ] ✅ Admin can access whitelist management
- [ ] ✅ Admin/Adviser can create events
- [ ] ✅ Events display properly on events page
- [ ] ✅ Navigation shows correct options based on role
- [ ] ✅ Logout works properly

## 📚 Next Steps

Once everything is working:

1. **Customize Email Domains** - Edit allowed domains in MemberWhitelist model
2. **Add Production Config** - Set up production environment variables
3. **Create More Time Slots** - Seed or manually add time slots for your needs
4. **Add Real Users** - Bulk import emails via admin whitelist interface
5. **Customize Branding** - Update colors, logos, and text in views
6. **Set Up Email** - Configure SMTP for email notifications (future feature)

## 📖 Documentation

- **Full Guide:** See [GOOGLE_SSO_SETUP.md](GOOGLE_SSO_SETUP.md)
- **Implementation Details:** See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Laravel Docs:** https://laravel.com/docs
- **Socialite Docs:** https://laravel.com/docs/socialite

## 🆘 Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Review Laravel logs: `storage/logs/laravel.log`
3. Check browser console for JavaScript errors
4. Verify all migrations ran successfully: `php artisan migrate:status`
5. Clear all caches: `php artisan optimize:clear`

---

**Congratulations!** 🎉 Once you've completed this checklist, your Google SSO and Event Management system should be fully operational.
