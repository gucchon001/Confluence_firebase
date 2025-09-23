'use server';

// This will ensure that the genkit instance is configured for development.
import './genkit';

// Import the flows you want to be available in the dev UI.
import './flows/retrieve-relevant-docs-lancedb';
import './flows/summarize-confluence-docs';
