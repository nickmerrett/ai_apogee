# Docker Deployment Guide

This guide shows how to run the AI Philosopher Chat application in a Docker container.

## 🐳 Quick Start

### Build the Docker Image

```bash
docker build -t ai-philosopher-chat .
```

### Run the Container

```bash
docker run -d \
  --name philosopher-chat \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY="your_claude_api_key" \
  -e OPENAI_API_KEY="your_openai_api_key" \
  -e GOOGLE_API_KEY="your_gemini_api_key" \
  -v $(pwd)/data:/app/data \
  ai-philosopher-chat
```

The application will be available at `http://localhost:3000`

## 🔧 Configuration

### Environment Variables

Set these environment variables to enable different AI providers:

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Claude API key | Optional* |
| `OPENAI_API_KEY` | OpenAI API key | Optional* |
| `GOOGLE_API_KEY` | Google Gemini API key | Optional* |
| `IBM_WATSONX_API_KEY` | IBM WatsonX API key | Optional* |
| `IBM_WATSONX_PROJECT_ID` | IBM WatsonX Project ID | Optional* |
| `GROK_API_KEY` | Grok API key | Optional* |
| `MISTRAL_API_KEY` | Mistral API key | Optional* |
| `PORT` | Server port (default: 3000) | Optional |

*At least one AI provider API key is required for the application to function.

### Volume Mounting

Mount a volume to persist conversation data:

```bash
-v /host/path/to/data:/app/data
```

This ensures conversation history survives container restarts.

## 📝 Docker Commands

### Build with Custom Tag
```bash
docker build -t your-registry/ai-philosopher-chat:v1.0 .
```

### Run with All Environment Variables
```bash
docker run -d \
  --name philosopher-chat \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e OPENAI_API_KEY="sk-..." \
  -e GOOGLE_API_KEY="AIza..." \
  -e IBM_WATSONX_API_KEY="..." \
  -e IBM_WATSONX_PROJECT_ID="..." \
  -e PORT=3000 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  ai-philosopher-chat
```

### View Logs
```bash
docker logs philosopher-chat
docker logs -f philosopher-chat  # Follow logs
```

### Stop and Remove
```bash
docker stop philosopher-chat
docker rm philosopher-chat
```

### Health Check
The container includes a health check endpoint:
```bash
curl http://localhost:3000/health
```

## 🚀 Production Deployment

### Using Environment File
Create a `.env` file:
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
PORT=3000
```

Run with environment file:
```bash
docker run -d \
  --name philosopher-chat \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  ai-philosopher-chat
```

### Behind Reverse Proxy
When running behind nginx or similar:

```bash
docker run -d \
  --name philosopher-chat \
  -p 127.0.0.1:3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  ai-philosopher-chat
```

## 🔍 Troubleshooting

### Check Container Status
```bash
docker ps
docker inspect philosopher-chat
```

### Debug Container
```bash
docker exec -it philosopher-chat sh
```

### View Health Status
```bash
docker inspect --format='{{json .State.Health}}' philosopher-chat
```

## 🛡️ Security Notes

- The container runs as a non-root user (`appuser`)
- API keys are passed as environment variables (not in the image)
- Data directory is owned by the app user
- Use environment files instead of command-line args in production
- Consider using Docker secrets for API keys in production

## 📊 Container Specs

- **Base Image:** `node:18-alpine`
- **Working Directory:** `/app`
- **Exposed Port:** `3000`
- **User:** `appuser` (UID: 1001)
- **Health Check:** Built-in endpoint at `/health`