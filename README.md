# Tom Riddle's Diary

A dark academia-themed, interactive web application inspired by Tom Riddle's Diary from the Harry Potter series. Write in the diary using a digital ink interface, watch your writing fade away, and receive a mysterious, sentient-like response from the diary itself.

## Features

- **Interactive Canvas:** Draw or write your thoughts on an HTML5 canvas that simulates digital ink.
- **Ink Fading Logic:** Your writing slowly fades away into the pages of the diary, triggering a response.
- **Sentient AI Backend:** Powered by the `llama3.2-vision` model via Ollama, the diary reads your entries and replies with poetic, mysterious text.
- **Dockerized Architecture:** A fully local, containerized setup ensuring easy deployment and privacy.
- **GPU Acceleration Support:** The Ollama backend supports GPU acceleration for faster inference (requires NVIDIA setup in Docker).

## Prerequisites

Before running the application, ensure you have the following installed:

1. [Docker Desktop](https://docs.docker.com/get-docker/) (or Docker Engine + Docker Compose)
2. (Optional but recommended) NVIDIA Container Toolkit for GPU support.

## Getting Started

To launch the diary, simply run the provided startup script:

```bash
./start.sh
```

### What `start.sh` does:
1. Verifies that Docker and Docker Compose are installed and running.
2. Starts the Nginx frontend and Ollama backend containers via `docker-compose.yml`.
3. Waits for the Ollama API to become healthy.
4. Checks if the required AI model (`llama3.2-vision`) is installed in your local Ollama instance, and pulls it automatically if it isn't.

### Accessing the Diary

Once the startup script completes, open your web browser and navigate to:
**http://localhost:3000**

## Project Structure

- `frontend/` - Contains the HTML, CSS, and vanilla JavaScript (app.js) for the canvas UI and fading logic.
- `docker-compose.yml` - Defines the services: `diary-frontend` (Nginx) and `ollama-backend` (Ollama).
- `start.sh` - Automated initialization and orchestration script.
- `ollama_data/` - (Created at runtime) Persistent volume to store downloaded Ollama models.

## Stopping the Application

To stop the containers and shut down the diary, run:

```bash
docker compose down
```

## Troubleshooting

- **Backend logs:** To view the backend logs and AI inference details, run:
  `docker logs -f ollama-backend`
- **Docker Daemon:** If the startup script fails due to the Docker daemon not running, ensure Docker Desktop is open and fully initialized.
- **Model Pulling:** The first time you run the app, pulling the AI model can take several minutes depending on your internet connection.
