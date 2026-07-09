# Tom Riddle's Sentient Diary

An interactive web application simulating Tom Riddle's diary from the Harry Potter universe. The diary allows users to write on an HTML5 canvas and receive AI-generated responses from the Google Gemini API (`gemini-2.5-flash`). The UI features a parchment theme and ink-bleeding typography effects for an immersive experience.

## Architecture

The project consists of:
- **Frontend**: An Angular application featuring an HTML5 canvas for handwritten input, rendering AI responses with a dynamic ink-bleeding effect.
- **Backend**: Uses the Google Gemini API (`gemini-2.5-flash`) directly from the frontend to process handwritten inputs and generate responses.

## Prerequisites

- Node.js & npm (for local frontend development)
- Angular CLI
- Docker & Docker Compose (for containerized deployment)
- A valid Google Gemini API key configured in `frontend/src/environments/environment.ts`.

## Setup & Execution

### Running Locally (Development Mode)

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Angular development server (accessible over your local IP for multi-device testing):
   ```bash
   ng serve --host 0.0.0.0
   ```
4. Access the app at `http://<your-local-ip>:4200`.

### Running with Docker

The frontend can be containerized using the provided `docker-compose.yml`.

1. Ensure your Gemini API key is configured in `frontend/src/environments/environment.ts`.

2. Build and start the container:
   ```bash
   docker-compose up --build -d
   ```
3. The diary frontend will be accessible at `http://localhost` (or your machine's IP on port 80).

## Troubleshooting

- **Ink smudged error**: If the AI-generated text appears as "the ink seems smudged, it cannot be read", ensure that your Gemini API key is valid, your internet connection is active, and the API responses are correctly parsed by the `renderTextLine` implementation in the frontend's canvas rendering logic.
