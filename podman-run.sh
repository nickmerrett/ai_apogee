#!/bin/bash

# AI Philosopher Chat - Podman Management Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="ai-philosopher-chat"
CONTAINER_NAME="philosopher-chat"
PORT="3000"
DATA_DIR="$(pwd)/data"

# Detect if we're on an SELinux system
SELINUX_VOLUME_FLAG=""
if command -v getenforce &> /dev/null && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
    SELINUX_VOLUME_FLAG=":Z"
    echo -e "${BLUE}SELinux detected - using appropriate volume flags${NC}"
fi

# Functions
print_usage() {
    echo -e "${BLUE}AI Philosopher Chat - Podman Management${NC}"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build     - Build the Podman image"
    echo "  run       - Run the container (interactive setup)"
    echo "  start     - Start existing container"
    echo "  stop      - Stop the container"
    echo "  restart   - Restart the container"
    echo "  logs      - View container logs"
    echo "  status    - Check container status"
    echo "  clean     - Remove container and image"
    echo "  health    - Check application health"
    echo "  systemd   - Generate systemd service file"
    echo ""
}

build_image() {
    echo -e "${BLUE}Building Podman image...${NC}"
    podman build -t $IMAGE_NAME .
    echo -e "${GREEN}Image built successfully!${NC}"
}

setup_environment() {
    echo -e "${YELLOW}Setting up environment variables...${NC}"
    echo "Please provide your API keys (press Enter to skip any provider):"
    echo ""
    
    read -p "Anthropic Claude API Key: " ANTHROPIC_KEY
    read -p "OpenAI API Key: " OPENAI_KEY
    read -p "Google Gemini API Key: " GOOGLE_KEY
    read -p "IBM WatsonX API Key: " WATSONX_KEY
    read -p "IBM WatsonX Project ID: " WATSONX_PROJECT
    
    # Build environment variables string
    ENV_VARS=""
    [ ! -z "$ANTHROPIC_KEY" ] && ENV_VARS="$ENV_VARS -e ANTHROPIC_API_KEY=$ANTHROPIC_KEY"
    [ ! -z "$OPENAI_KEY" ] && ENV_VARS="$ENV_VARS -e OPENAI_API_KEY=$OPENAI_KEY"
    [ ! -z "$GOOGLE_KEY" ] && ENV_VARS="$ENV_VARS -e GOOGLE_API_KEY=$GOOGLE_KEY"
    [ ! -z "$WATSONX_KEY" ] && ENV_VARS="$ENV_VARS -e IBM_WATSONX_API_KEY=$WATSONX_KEY"
    [ ! -z "$WATSONX_PROJECT" ] && ENV_VARS="$ENV_VARS -e IBM_WATSONX_PROJECT_ID=$WATSONX_PROJECT"
    
    echo "$ENV_VARS"
}

run_container() {
    # Check if container already exists
    if podman ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}Container already exists. Use 'start' to start it or 'clean' to remove it first.${NC}"
        return 1
    fi
    
    # Set up environment
    ENV_VARS=$(setup_environment)
    
    if [ -z "$ENV_VARS" ]; then
        echo -e "${RED}Error: At least one API key is required!${NC}"
        return 1
    fi
    
    # Create data directory
    mkdir -p "$DATA_DIR"
    
    echo -e "${BLUE}Starting container with Podman...${NC}"
    podman run -d \
        --name $CONTAINER_NAME \
        -p $PORT:3000 \
        $ENV_VARS \
        -v "$DATA_DIR:/app/data$SELINUX_VOLUME_FLAG" \
        --restart unless-stopped \
        $IMAGE_NAME
    
    echo -e "${GREEN}Container started successfully!${NC}"
    echo -e "${GREEN}Access the application at: http://localhost:$PORT${NC}"
    
    if [ ! -z "$SELINUX_VOLUME_FLAG" ]; then
        echo -e "${BLUE}Note: SELinux volume labeling applied for secure access${NC}"
    fi
}

generate_systemd() {
    echo -e "${BLUE}Generating systemd service file...${NC}"
    
    # Create user systemd directory if it doesn't exist
    mkdir -p ~/.config/systemd/user
    
    # Generate the service file
    podman generate systemd --name $CONTAINER_NAME --new > ~/.config/systemd/user/$CONTAINER_NAME.service
    
    echo -e "${GREEN}Systemd service file created: ~/.config/systemd/user/$CONTAINER_NAME.service${NC}"
    echo -e "${YELLOW}To enable the service:${NC}"
    echo "  systemctl --user daemon-reload"
    echo "  systemctl --user enable $CONTAINER_NAME.service"
    echo "  systemctl --user start $CONTAINER_NAME.service"
    echo ""
    echo -e "${YELLOW}To enable linger (start on boot):${NC}"
    echo "  sudo loginctl enable-linger \$USER"
}

check_health() {
    echo -e "${BLUE}Checking application health...${NC}"
    if curl -s http://localhost:$PORT/health > /dev/null; then
        curl -s http://localhost:$PORT/health | python3 -m json.tool 2>/dev/null || \
        curl -s http://localhost:$PORT/health
    else
        echo -e "${RED}Health check failed - is the container running?${NC}"
    fi
}

check_podman() {
    if ! command -v podman &> /dev/null; then
        echo -e "${RED}Podman is not installed or not in PATH${NC}"
        echo -e "${YELLOW}Install Podman: https://podman.io/getting-started/installation${NC}"
        exit 1
    fi
}

case "$1" in
    build)
        check_podman
        build_image
        ;;
    run)
        check_podman
        build_image
        run_container
        ;;
    start)
        check_podman
        echo -e "${BLUE}Starting container...${NC}"
        podman start $CONTAINER_NAME
        echo -e "${GREEN}Container started!${NC}"
        ;;
    stop)
        check_podman
        echo -e "${BLUE}Stopping container...${NC}"
        podman stop $CONTAINER_NAME
        echo -e "${GREEN}Container stopped!${NC}"
        ;;
    restart)
        check_podman
        echo -e "${BLUE}Restarting container...${NC}"
        podman restart $CONTAINER_NAME
        echo -e "${GREEN}Container restarted!${NC}"
        ;;
    logs)
        check_podman
        podman logs -f $CONTAINER_NAME
        ;;
    status)
        check_podman
        echo -e "${BLUE}Container Status:${NC}"
        podman ps --filter name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo -e "${BLUE}Health Status:${NC}"
        podman inspect --format='{{json .State.Health}}' $CONTAINER_NAME 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "Health check not available"
        ;;
    clean)
        check_podman
        echo -e "${YELLOW}Removing container and image...${NC}"
        podman stop $CONTAINER_NAME 2>/dev/null || true
        podman rm $CONTAINER_NAME 2>/dev/null || true
        podman rmi $IMAGE_NAME 2>/dev/null || true
        echo -e "${GREEN}Cleanup complete!${NC}"
        ;;
    health)
        check_health
        ;;
    systemd)
        check_podman
        generate_systemd
        ;;
    *)
        print_usage
        ;;
esac