#!/bin/bash

# AI Philosopher Chat - Docker Management Script

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

# Functions
print_usage() {
    echo -e "${BLUE}AI Philosopher Chat - Docker Management${NC}"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build     - Build the Docker image"
    echo "  run       - Run the container (interactive setup)"
    echo "  start     - Start existing container"
    echo "  stop      - Stop the container"
    echo "  restart   - Restart the container"
    echo "  logs      - View container logs"
    echo "  status    - Check container status"
    echo "  clean     - Remove container and image"
    echo "  health    - Check application health"
    echo ""
}

build_image() {
    echo -e "${BLUE}Building Docker image...${NC}"
    docker build -t $IMAGE_NAME .
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
    if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
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
    
    echo -e "${BLUE}Starting container...${NC}"
    docker run -d \
        --name $CONTAINER_NAME \
        -p $PORT:3000 \
        $ENV_VARS \
        -v "$DATA_DIR:/app/data" \
        --restart unless-stopped \
        $IMAGE_NAME
    
    echo -e "${GREEN}Container started successfully!${NC}"
    echo -e "${GREEN}Access the application at: http://localhost:$PORT${NC}"
}

check_health() {
    echo -e "${BLUE}Checking application health...${NC}"
    curl -s http://localhost:$PORT/health | python3 -m json.tool || echo -e "${RED}Health check failed${NC}"
}

case "$1" in
    build)
        build_image
        ;;
    run)
        build_image
        run_container
        ;;
    start)
        echo -e "${BLUE}Starting container...${NC}"
        docker start $CONTAINER_NAME
        echo -e "${GREEN}Container started!${NC}"
        ;;
    stop)
        echo -e "${BLUE}Stopping container...${NC}"
        docker stop $CONTAINER_NAME
        echo -e "${GREEN}Container stopped!${NC}"
        ;;
    restart)
        echo -e "${BLUE}Restarting container...${NC}"
        docker restart $CONTAINER_NAME
        echo -e "${GREEN}Container restarted!${NC}"
        ;;
    logs)
        docker logs -f $CONTAINER_NAME
        ;;
    status)
        echo -e "${BLUE}Container Status:${NC}"
        docker ps --filter name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo -e "${BLUE}Health Status:${NC}"
        docker inspect --format='{{json .State.Health}}' $CONTAINER_NAME 2>/dev/null | python3 -m json.tool || echo "Health check not available"
        ;;
    clean)
        echo -e "${YELLOW}Removing container and image...${NC}"
        docker stop $CONTAINER_NAME 2>/dev/null || true
        docker rm $CONTAINER_NAME 2>/dev/null || true
        docker rmi $IMAGE_NAME 2>/dev/null || true
        echo -e "${GREEN}Cleanup complete!${NC}"
        ;;
    health)
        check_health
        ;;
    *)
        print_usage
        ;;
esac