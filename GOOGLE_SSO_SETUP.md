# Google SSO and Event Management Setup Guide

This guide will help you set up Google SSO authentication with whitelisting and the adviser/admin event creation features.

## Features Implemented

### 1. Google SSO Authentication
- **Login with Google**: Users can sign in using their university Google accounts
- **Email Domain Validation**: Only university email domains (@university.edu.ph, @uc-bcf.edu.ph) are allowed
- **Auto-Registration**: First-time users are automatically added to the pending whitelist

### 2. Whitelist System
- **Automatic Whitelist Entry**: New users are added with "pending" status
- **Role-Based Approval**: 
  - Admins can approve/reject all roles (admin, adviser, member)
  - Advisers can only approve/reject members
- **Status Flow**: Pending → Approved/Rejected
- **Access Control**: Only approved users can access the system

### 3. Event Management
- **Event Creation**: Admins and advisers can create events with multiple schedules
- **Event Schedules**: Each event can have multiple date/time/venue combinations
- **Volunteer Requirements**: Specify required volunteers per schedule
- **Event Status**: Draft, Scheduled, Ongoing, Completed, Cancelled
- **Access Control**: 
  - Admins/Advisers: Create, edit, delete events
  - Members: View events only

## Setup Instructions

### 1. Configure Google OAuth

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google+ API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Add authorized redirect URI: `http://localhost/auth/google/callback` (adjust for your domain)
   - Copy the Client ID and Client Secret

4. **Update .env file**:
   ```bash
   GOOGLE_CLIENT_ID=your-client-id-here
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   GOOGLE_REDIRECT_URI=http://localhost/auth/google/callback
   ```

### 2. Run Database Migrations

Make sure your database is set up and run:

```bash
php artisan migrate
```

### 3. Seed the Database

Run the seeders to create initial data:

```bash
php artisan db:seed --class=MemberWhitelistSeeder
php artisan db:seed --class=RolesSeeder
php artisan db:seed --class=OrganizationsSeeder
php artisan db:seed --class=TimeSlotsSeeder
```

### 4. Install Frontend Dependencies

```bash
npm install
```

### 5. Build Frontend Assets

```bash
npm run build
# or for development with hot reload:
npm run dev
```

### 6. Start the Application

```bash
php artisan serve
```

Visit `http://localhost:8000/login` to see the login page.

## Usage Workflow

### First-Time User Flow

1. **User visits login page** → Clicks "Sign in with Google"
2. **Google OAuth** → User authenticates with Google
3. **Email validation** → System checks if email is from allowed domain
4. **Whitelist check**:
   - If not in whitelist → Create pending entry → Show "Pending Approval" page
   - If pending → Show "Pending Approval" page
   - If rejected → Show "Not Whitelisted" page
   - If approved → Create Member account → Redirect to onboarding

### Admin/Adviser Approval Flow

1. **Admin/Adviser logs in** → Goes to dashboard
2. **Navigate to Whitelist Management**:
   - Admin: `/admin/whitelist/pending`
   - Adviser: `/adviser/whitelist/pending`
3. **Review pending requests** → Approve or reject

### Event Creation Flow

1. **Admin/Adviser logs in** → Navigate to "Create Event"
2. **Fill in event details**:
   - Title (required)
   - Description (optional)
   - Status (draft, scheduled, etc.)
3. **Add schedules** (at least one required):
   - Date
   - Time slot
   - Venue (optional)
   - Required volunteers
4. **Submit** → Event is created and visible to all members

## Routes Reference

### Authentication
- `GET /login` - Login page
- `GET /auth/google` - Redirect to Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `POST /logout` - Logout

### Events (All authenticated users)
- `GET /events` - List all events
- `GET /events/{id}` - View event details

### Event Management (Admin/Adviser only)
- `GET /events/create` - Create event form
- `POST /events` - Store new event
- `GET /events/{id}/edit` - Edit event form
- `PUT /events/{id}` - Update event
- `DELETE /events/{id}` - Delete event

### Whitelist Management (Admin)
- `GET /admin/whitelist` - List all whitelist entries
- `GET /admin/whitelist/pending` - List pending entries
- `POST /admin/whitelist` - Add whitelist entry
- `POST /admin/whitelist/{id}/approve` - Approve entry
- `POST /admin/whitelist/{id}/reject` - Reject entry
- `DELETE /admin/whitelist/{id}` - Remove entry
- `POST /admin/whitelist/bulk-import` - Bulk import emails

### Whitelist Management (Adviser - Members only)
- `GET /adviser/whitelist` - List all whitelist entries
- `GET /adviser/whitelist/pending` - List pending member entries
- `POST /adviser/whitelist` - Add member whitelist entry
- `POST /adviser/whitelist/{id}/approve` - Approve member entry
- `POST /adviser/whitelist/{id}/reject` - Reject member entry

## Pre-seeded Accounts

The `MemberWhitelistSeeder` creates these pre-approved accounts:
- **Admin**: admin@university.edu.ph
- **Adviser**: adviser@university.edu.ph

These accounts can log in immediately. First login will create their Member records.

## Customization

### Change Allowed Email Domains

Edit `app/Models/MemberWhitelist.php`, line ~93:

```php
$allowedDomains = ['university.edu.ph', 'uc-bcf.edu.ph', 'yourdomain.edu'];
```

### Modify Event Statuses

Edit `app/Http/Controllers/EventController.php` and the event creation form to add/remove status options.

### Customize Views

All views are in `resources/views/`:
- `auth/` - Authentication pages
- `events/` - Event management pages
- `admin/` - Admin dashboard
- `adviser/` - Adviser dashboard
- `member/` - Member dashboard
- `layouts/app.blade.php` - Main layout template

## Troubleshooting

### "Invalid credentials" error
- Double-check your Google Client ID and Secret in `.env`
- Ensure the redirect URI in Google Console matches your `.env` setting

### "Not whitelisted" after first login
- Check that the email domain is in the allowed domains list
- Verify database connection and that whitelist table exists

### Assets not loading
- Run `npm run build` to compile frontend assets
- Check that `APP_URL` in `.env` matches your development URL

### Events page showing errors
- Ensure TimeSlot seeder has been run
- Check that all relationships in models are properly defined

## Next Steps

Consider implementing:
- Email notifications for whitelist approval/rejection
- Volunteer assignment system
- Event calendar view
- Member availability scheduling
- Reporting and analytics

## Support

For issues or questions, contact the development team or refer to the Laravel and Socialite documentation.
