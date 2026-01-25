# Password Authentication Migration

This document describes the changes made to migrate from OTP-based authentication to password-based authentication.

## Overview

The authentication system has been updated to use **email/password or phone/password** authentication instead of OTP-based verification. The manual activation workflow (requiring admin approval) has been preserved.

## Changes Made

### 1. Database Schema Updates

**File:** `src/lib/schema.ts`

- Added `password` field to the `user` table:
  ```typescript
  password: varchar("password", { length: 255 }), // Hashed password for email/phone login
  ```

**Migration Required:**
Run the SQL migration file `add_password_migration.sql`:
```sql
ALTER TABLE user ADD COLUMN password VARCHAR(255) AFTER date_of_birth;
```

### 2. Registration API Route

**File:** `src/app/api/register/route.ts`

**Changes:**
- Removed OTP verification logic
- Added password hashing using bcrypt (10 salt rounds)
- Direct user creation with hashed password
- Validates that name, email/phone, and password are provided
- Checks for existing users before registration
- Maintains magic link functionality for auto-approval
- Maintains manual activation (pending status) for regular registrations

**New Flow:**
1. Validate required fields (name, email/phone, password)
2. Check if user already exists
3. Hash the password using bcrypt
4. Create user with `pending` status (or `approved` if magic link is used)
5. Send welcome email (if email registration)
6. Return success with appropriate message

### 3. Authentication Configuration

**File:** `src/lib/auth.ts`

**Changes:**
- Updated `CredentialsProvider` to accept password field
- Added password verification using bcrypt.compare()
- Validates user status (only approved users can login)
- Maintains support for both email and phone number login

**Login Flow:**
1. Accept email/phone and password
2. Look up user by email or phone
3. Verify user status is 'approved'
4. Compare provided password with hashed password
5. Return user object if valid, null otherwise

### 4. Register Page UI

**File:** `src/app/register/page.tsx`

**Changes:**
- Removed OTP-related components (InputOTP, OTP step)
- Added password input fields with show/hide toggle
- Removed email/SMS sending functionality
- Direct registration and login without OTP verification
- Updated form fields:

**Register Tab:**
- Name (required)
- Email Address Or Phone Number (required)
- Password (required, with show/hide toggle)
- Note (optional)

**Login Tab:**
- Email Address Or Phone Number (required)
- Password (required, with show/hide toggle)

### 5. Removed Files

The following OTP-related files have been deleted:
- `src/app/verify-otp/page.tsx` - OTP verification page
- `src/app/api/auth/verify-otp/route.ts` - OTP verification API route

### 6. Unchanged Features

The following features remain unchanged:
- **Manual Activation**: New users still require admin approval (status: 'pending')
- **Magic Link**: Special invitation links still automatically approve users
- **Magic Link Tracking**: Usage tracking maintained in `magicLinkUsage` table
- **Email/Phone Support**: Users can register and login with either email or phone
- **Welcome Emails**: Welcome emails still sent for email registrations
- **OAuth Support**: Google and Facebook OAuth remain unchanged

## User Flow

### Registration Flow

1. **User fills registration form:**
   - Name
   - Email or Phone Number
   - Password
   - Note (optional)

2. **System validates and creates account:**
   - Validates required fields
   - Checks for existing account
   - Hashes password
   - Creates user with `pending` status (or `approved` if magic link used)

3. **User receives confirmation:**
   - **Regular registration**: Account created, pending admin approval
   - **Magic link registration**: Account created and auto-approved, auto-login

4. **Admin approves account** (regular registration only)

5. **User can now login** (after approval)

### Login Flow

1. **User enters credentials:**
   - Email or Phone Number
   - Password

2. **System verifies:**
   - User exists
   - Password is correct
   - Account status is 'approved'

3. **User logged in** to dashboard

## Security Features

- Passwords hashed using bcrypt with 10 salt rounds
- Only approved users can login
- Password never stored in plain text
- Password visibility toggle for better UX
- Server-side validation for all inputs

## Testing Checklist

Before deploying, test the following scenarios:

- [ ] Run the database migration
- [ ] Register new user with email
- [ ] Register new user with phone number
- [ ] Verify account is in 'pending' status
- [ ] Admin approves user account
- [ ] Login with approved account
- [ ] Login fails with incorrect password
- [ ] Login fails with pending account
- [ ] Register with magic link (auto-approval)
- [ ] Login immediately after magic link registration
- [ ] Duplicate email/phone registration fails

## Environment Variables

No new environment variables are required. Existing variables remain:
- `NEXTAUTH_URL` - Base URL for NextAuth
- `NEXTAUTH_SECRET` - Secret for NextAuth
- Database connection variables

## Notes

- The `verification_tokens` table is still present in the schema but is no longer used for user registration/login
- OTP-related fields in the `user` table (`otp`, `otpExpiry`) are still present but unused
- Consider removing these fields in a future cleanup migration if not needed elsewhere
- The email send API route (`/api/email/send`) and Twilio SMS route are no longer used for authentication

## Rollback

If you need to rollback:
1. Restore the previous versions of the modified files
2. Restore the deleted files
3. Remove the password column: `ALTER TABLE user DROP COLUMN password;`

