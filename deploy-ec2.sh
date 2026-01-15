#!/bin/bash

# Script untuk deploy WhatsApp AI Chatbot ke EC2
# Usage: ./deploy-ec2.sh [ec2-user@your-ec2-ip]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EC2_HOST="${1:-ec2-user@your-ec2-ip}"
APP_DIR="~/whatsapp-bot"
REMOTE_USER=$(echo $EC2_HOST | cut -d'@' -f1)

echo -e "${GREEN}🚀 Deploying WhatsApp AI Chatbot to EC2...${NC}"
echo -e "${YELLOW}Target: ${EC2_HOST}${NC}"
echo ""

# Check if .env exists locally
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo "Please create .env file first. See README.md for details."
    exit 1
fi

# Step 1: Check SSH connection
echo -e "${YELLOW}📡 Checking SSH connection...${NC}"
if ! ssh -o ConnectTimeout=5 $EC2_HOST "echo 'Connected'" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Cannot connect to ${EC2_HOST}${NC}"
    echo "Please check:"
    echo "  1. EC2 instance is running"
    echo "  2. Security group allows SSH from your IP"
    echo "  3. SSH key is correct"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection OK${NC}"
echo ""

# Step 2: Check Docker installation
echo -e "${YELLOW}🐳 Checking Docker installation...${NC}"
if ! ssh $EC2_HOST "command -v docker" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker not found. Installing Docker...${NC}"
    ssh $EC2_HOST << 'EOF'
        # Install Docker
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        
        # Install Docker Compose
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        
        # Verify
        docker --version
        docker-compose --version
EOF
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi
echo ""

# Step 3: Create directories
echo -e "${YELLOW}📁 Creating directories...${NC}"
ssh $EC2_HOST "mkdir -p ${APP_DIR}/tokens ${APP_DIR}/logs"
echo -e "${GREEN}✅ Directories created${NC}"
echo ""

# Step 4: Copy files
echo -e "${YELLOW}📦 Copying files...${NC}"
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'tokens' --exclude 'logs' \
    ./ $EC2_HOST:${APP_DIR}/
echo -e "${GREEN}✅ Files copied${NC}"
echo ""

# Step 5: Copy .env file
echo -e "${YELLOW}🔐 Copying .env file...${NC}"
scp .env $EC2_HOST:${APP_DIR}/.env
echo -e "${GREEN}✅ .env file copied${NC}"
echo ""

# Step 6: Build and start containers
echo -e "${YELLOW}🔨 Building and starting containers...${NC}"
ssh $EC2_HOST << EOF
    cd ${APP_DIR}
    docker-compose down 2>/dev/null || true
    docker-compose build --no-cache
    docker-compose up -d
EOF
echo -e "${GREEN}✅ Containers started${NC}"
echo ""

# Step 7: Wait for health check
echo -e "${YELLOW}⏳ Waiting for application to start...${NC}"
sleep 10

# Step 8: Check health
echo -e "${YELLOW}🏥 Checking health...${NC}"
HEALTH_CHECK=$(ssh $EC2_HOST "curl -s http://localhost:4000/health || echo 'FAILED'")

if [[ $HEALTH_CHECK == *"ok"* ]] || [[ $HEALTH_CHECK == *"OK"* ]]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed or still starting...${NC}"
    echo "Check logs with: ssh ${EC2_HOST} 'cd ${APP_DIR} && docker-compose logs -f'"
fi
echo ""

# Step 9: Show logs
echo -e "${GREEN}📋 Showing recent logs...${NC}"
echo -e "${YELLOW}--- Last 20 lines ---${NC}"
ssh $EC2_HOST "cd ${APP_DIR} && docker-compose logs --tail=20 whatsapp-ai-chatbot"
echo ""

# Step 10: Instructions
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. View logs: ssh ${EC2_HOST} 'cd ${APP_DIR} && docker-compose logs -f'"
echo "2. Check QR code: ssh ${EC2_HOST} 'cd ${APP_DIR} && docker-compose logs whatsapp-ai-chatbot | grep -i qr'"
echo "3. Health check: ssh ${EC2_HOST} 'curl http://localhost:4000/health'"
echo "4. Restart: ssh ${EC2_HOST} 'cd ${APP_DIR} && docker-compose restart'"
echo ""
echo -e "${GREEN}🎉 Done!${NC}"
