# Podman Deployment Guide

This guide shows how to run the AI Philosopher Chat application using Podman.

## 🦭 Podman vs Docker

Podman is a daemonless container engine that's fully compatible with Docker commands. Simply replace `docker` with `podman` in all commands.

## 🚀 Quick Start

### Build the Container Image

```bash
podman build -t ai-philosopher-chat .
```

### Run the Container

```bash
podman run -d \
  --name philosopher-chat \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY="your_claude_api_key" \
  -e OPENAI_API_KEY="your_openai_api_key" \
  -e GOOGLE_API_KEY="your_gemini_api_key" \
  -v $(pwd)/data:/app/data:Z \
  ai-philosopher-chat
```

**Note:** The `:Z` flag on the volume mount is important for SELinux systems (like Fedora/RHEL).

The application will be available at `http://localhost:3000`

## 🔧 Podman-Specific Configuration

### SELinux Considerations

On SELinux-enabled systems (Fedora, RHEL, CentOS), use the `:Z` flag for volume mounts:

```bash
-v $(pwd)/data:/app/data:Z
```

This properly labels the volume for container access.

### Rootless Operation

Podman runs rootless by default, which is more secure:

```bash
# Check current user containers
podman ps

# Run without root privileges
podman run --user 1001:1001 ...
```

### Systemd Integration

Create a systemd service for the container:

```bash
# Generate systemd unit file
podman generate systemd --name philosopher-chat --new > ~/.config/systemd/user/philosopher-chat.service

# Enable and start service
systemctl --user daemon-reload
systemctl --user enable philosopher-chat.service
systemctl --user start philosopher-chat.service
```

## 📝 Podman Commands

### Build with Custom Tag
```bash
podman build -t localhost/ai-philosopher-chat:v1.0 .
```

### Run with All Environment Variables
```bash
podman run -d \
  --name philosopher-chat \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e OPENAI_API_KEY="sk-..." \
  -e GOOGLE_API_KEY="AIza..." \
  -e IBM_WATSONX_API_KEY="..." \
  -e IBM_WATSONX_PROJECT_ID="..." \
  -e PORT=3000 \
  -v $(pwd)/data:/app/data:Z \
  --restart unless-stopped \
  ai-philosopher-chat
```

### Container Management
```bash
# List containers
podman ps -a

# View logs
podman logs philosopher-chat
podman logs -f philosopher-chat  # Follow logs

# Stop and remove
podman stop philosopher-chat
podman rm philosopher-chat

# Execute commands in container
podman exec -it philosopher-chat sh
```

### Health Check
```bash
curl http://localhost:3000/health

# Check container health status
podman inspect --format='{{json .State.Health}}' philosopher-chat
```

## 🔐 Podman Advantages

### Security Benefits
- **Rootless by default:** No daemon running as root
- **SELinux integration:** Better security isolation
- **User namespaces:** Container processes map to unprivileged user IDs

### Systemd Integration
- **Native systemd support:** Containers as systemd services
- **Auto-start:** Containers start with user login
- **Resource management:** Use systemd resource controls

### OCI Compatibility
- **Standard compliant:** Works with any OCI-compliant registry
- **Drop-in replacement:** Same commands as Docker
- **Import/Export:** Compatible with Docker images

## 🛠️ Podman-Specific Script

Update the docker-run.sh script to use Podman:

```bash
# At the top of docker-run.sh, add:
CONTAINER_RUNTIME=${CONTAINER_RUNTIME:-podman}

# Then replace docker commands with:
$CONTAINER_RUNTIME build -t $IMAGE_NAME .
$CONTAINER_RUNTIME run -d ...
```

Or simply:

```bash
export CONTAINER_RUNTIME=podman
./docker-run.sh run
```

## 📊 Pod Management (Podman-specific)

Podman supports pods (similar to Kubernetes pods):

```bash
# Create a pod
podman pod create --name philosopher-pod -p 3000:3000

# Run container in pod
podman run -d \
  --pod philosopher-pod \
  --name philosopher-chat \
  -e ANTHROPIC_API_KEY="..." \
  -v $(pwd)/data:/app/data:Z \
  ai-philosopher-chat

# Manage pod
podman pod start philosopher-pod
podman pod stop philosopher-pod
podman pod rm philosopher-pod
```

## 🚀 Production with Quadlet

For production deployments, use Podman's Quadlet (systemd integration):

Create `~/.config/containers/systemd/philosopher-chat.container`:

```ini
[Unit]
Description=AI Philosopher Chat
After=network-online.target

[Container]
Image=ai-philosopher-chat:latest
ContainerName=philosopher-chat
PublishPort=3000:3000
Environment=ANTHROPIC_API_KEY=your_key
Environment=OPENAI_API_KEY=your_key
Volume=philosopher-data:/app/data:Z
AutoUpdate=registry

[Service]
Restart=unless-stopped

[Install]
WantedBy=multi-user.target
```

Then:
```bash
systemctl --user daemon-reload
systemctl --user start philosopher-chat.service
```

## 🔍 Troubleshooting

### Port Binding Issues
```bash
# Check if port is available
ss -tulnp | grep 3000

# Use different port
podman run -p 3001:3000 ...
```

### SELinux Denials
```bash
# Check SELinux logs
sudo ausearch -m avc -ts recent

# Allow container access (if needed)
setsebool -P container_manage_cgroup true
```

### Storage Issues
```bash
# Check Podman storage
podman system df
podman system prune

# Reset storage (removes all containers/images)
podman system reset
```