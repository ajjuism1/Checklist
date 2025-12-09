# Appmaker Internal Checklist & Handover Tool

Internal tool for managing project handovers between Sales, Launch, and Customer Success teams.

## Tech Stack

- Next.js 14 (App Router)
- Firebase Authentication
- Firebase Firestore
- TypeScript

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Firebase Setup

**📖 For detailed step-by-step instructions, see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**

Quick overview:
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication with Google Sign-In provider
3. Enable Firestore Database (start in test mode, then deploy rules)
4. Copy your Firebase config to `.env.local`
5. Deploy Firestore security rules (see detailed guide)
6. Update admin emails in `firestore.rules` and `.env.local` (NEXT_PUBLIC_ADMIN_EMAILS)

## Initial Setup

After logging in as an admin:

1. Navigate to `/settings` page
2. The default checklist configuration will be loaded
3. Review and customize the checklist fields as needed
4. Click "Save Configuration" to persist the settings

The default configuration includes:
- **Sales Handover**: Brand name, store URLs, collab code, scope of work, design references, payment details, POC info, etc.
- **Launch Checklist**: Developer accounts, Firebase access, integrations, store listings, keystore files, test cases, etc.

## Features

- Google Sign-In restricted to @appmaker.xyz domain
- Project management and tracking
- Sales handover forms
- Launch team checklists
- Progress analytics and dashboards
- Admin-configurable checklist structure

# Checklist
