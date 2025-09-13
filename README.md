# Confluence Spec Chat

This is a Next.js application that provides a chatbot interface to summarize Confluence specifications and documentation using AI.

## Core Features

- **Google Authentication**: Secure login with Google accounts.
- **AI-Powered Chat**: Ask questions about your Confluence documents and get summarized answers.
- **Source Citing**: Responses include links to the original Confluence pages for reference.
- **Chat History**: Conversations are saved and loaded from Firestore.

## Getting Started

### 1. Set up Environment Variables

First, you need to configure your Firebase project details. Create a file named `.env.local` in the root of the project and add your Firebase configuration:

```bash
# You can find these values in your Firebase project settings under "General"
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
```

### 2. Set up Firebase

- **Authentication**: Go to the Firebase console, navigate to the "Authentication" section, and enable the "Google" sign-in provider.
- **Firestore**: Go to the "Firestore Database" section and create a database.

### 3. Firestore Security Rules

To ensure that users can only access their own chat history, you must set up Firestore security rules. Go to the "Rules" tab in the Firestore section of your Firebase console and paste the following:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read and write to their own chat history
    match /chats/{userId}/{documents=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Run the Development Server

Now you can install dependencies and run the app.

```bash
npm install
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.
