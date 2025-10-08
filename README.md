Happy Journey app built with Next.js, Clerk, Firebase (Firestore + Storage) and Gemini.

## Setup

1) Install deps

```bash
npm i
```

2) Env vars (.env.local)

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Firebase Admin
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Gemini
GEMINI_API_KEY=...
# Optional: override model
# GEMINI_MODEL=gemini-pro

# Groq (optional - will be used if set)
GROQ_API_KEY=...
# Optional: override model
# GROQ_MODEL=llama-3.1-70b-versatile
```

3) Run

```bash
npm run dev
```

## Features

- Plan trips by place: `/api/ai/plan`
- Suggest trips by budget: `/api/ai/suggest`
- History stored in Firestore, accessible at `/trips`
- Google Maps links included in itineraries
