# **App Name**: Confluence Spec-Finder

## Core Features:

- Google Authentication: Allow users to log in securely with their Google accounts.
- Question Submission: Provide a text input field for users to submit questions about Confluence documentation.
- Confluence Data Retrieval via Vector Search: Use local LanceDB to retrieve relevant Confluence specification data based on user questions.
- AI-Powered Summarization Tool: Leverage the Gemini model to generate concise summaries of the retrieved Confluence data relevant to the user's query.
- Response Display: Display the summarized answer, along with a list of source Confluence page titles and URLs for reference.
- Chat History: Save and load conversation history using Firestore.
- Secure API Endpoints: Implement API endpoints using Firebase Authentication to handle user questions securely.

## Style Guidelines:

- Primary color: Deep Indigo (#3F51B5) to convey professionalism and reliability.
- Background color: Light Indigo (#E8EAF6) for a clean and calm interface.
- Accent color: Vibrant Orange (#FF9800) to highlight key elements and actions.
- Body and headline font: 'Inter', a sans-serif font, will provide a modern and neutral appearance suitable for both headings and body text.
- Centralized chat display with input box and submit button at the bottom. Ensure a clean and intuitive layout.
- Use clear and professional icons for navigation and actions.
- Subtle transitions for loading and displaying AI responses to enhance user experience.