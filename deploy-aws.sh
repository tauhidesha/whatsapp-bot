#!/bin/bash

# AWS Deployment Script untuk WhatsApp AI Chatbot
# Pastikan AWS CLI sudah terinstall dan dikonfigurasi

set -e

echo "🚀 Deploying WhatsApp AI Chatbot to AWS..."

# Configuration
REGION="us-east-1"
ECR_REPOSITORY="whatsapp-ai-chatbot"
ECS_CLUSTER="whatsapp-ai-cluster"
ECS_SERVICE="whatsapp-ai-service"
TASK_DEFINITION="whatsapp-ai-task"

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPOSITORY}"

echo "📋 Configuration:"
echo "  Region: ${REGION}"
echo "  ECR Repository: ${ECR_REPOSITORY}"
echo "  ECR URI: ${ECR_URI}"
echo "  ECS Cluster: ${ECS_CLUSTER}"
echo "  ECS Service: ${ECS_SERVICE}"

# Step 1: Create ECR Repository
echo "📦 Creating ECR repository..."
aws ecr create-repository \
    --repository-name ${ECR_REPOSITORY} \
    --region ${REGION} \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 \
    || echo "Repository already exists"

# Step 2: Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# Step 3: Build Docker Image
echo "🔨 Building Docker image..."
docker build -t ${ECR_REPOSITORY} .

# Step 4: Tag and Push Image
echo "📤 Tagging and pushing image..."
docker tag ${ECR_REPOSITORY}:latest ${ECR_URI}:latest
docker push ${ECR_URI}:latest

# Step 5: Create ECS Cluster (if not exists)
echo "🏗️  Creating ECS cluster..."
aws ecs create-cluster \
    --cluster-name ${ECS_CLUSTER} \
    --region ${REGION} \
    || echo "Cluster already exists"

# Step 6: Create Task Definition
echo "📝 Creating task definition..."
cat > task-definition.json << EOF
{
  "family": "${TASK_DEFINITION}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "whatsapp-ai-chatbot",
      "image": "${ECR_URI}:latest",
      "portMappings": [
        {
          "containerPort": 4000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "4000"
        },
        {
          "name": "WHATSAPP_SESSION",
          "value": "ai-chatbot"
        },
        {
          "name": "WHATSAPP_HEADLESS",
          "value": "true"
        },
        {
          "name": "WHATSAPP_AUTO_CLOSE",
          "value": "false"
        },
        {
          "name": "AI_MODEL",
          "value": "gemini-1.5-flash"
        },
        {
          "name": "AI_TEMPERATURE",
          "value": "0.7"
        },
        {
          "name": "DEBOUNCE_DELAY_MS",
          "value": "15000"
        }
      ],
      "secrets": [
        {
          "name": "GOOGLE_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:whatsapp-ai/google-api-key"
        },
        {
          "name": "FIREBASE_SERVICE_ACCOUNT_BASE64",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:whatsapp-ai/firebase-service-account"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/whatsapp-ai-chatbot",
          "awslogs-region": "${REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:4000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

aws ecs register-task-definition \
    --cli-input-json file://task-definition.json \
    --region ${REGION}

# Step 7: Create CloudWatch Log Group
echo "📊 Creating CloudWatch log group..."
aws logs create-log-group \
    --log-group-name "/ecs/whatsapp-ai-chatbot" \
    --region ${REGION} \
    || echo "Log group already exists"

# Step 8: Create VPC and Security Group (if needed)
echo "🌐 Creating VPC resources..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region ${REGION})
SUBNET_ID=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" --query "Subnets[0].SubnetId" --output text --region ${REGION})

# Create Security Group
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name whatsapp-ai-sg \
    --description "Security group for WhatsApp AI Chatbot" \
    --vpc-id ${VPC_ID} \
    --region ${REGION} \
    --query 'GroupId' \
    --output text 2>/dev/null || aws ec2 describe-security-groups --filters "Name=group-name,Values=whatsapp-ai-sg" --query "SecurityGroups[0].GroupId" --output text --region ${REGION})

# Add inbound rule for port 4000
aws ec2 authorize-security-group-ingress \
    --group-id ${SECURITY_GROUP_ID} \
    --protocol tcp \
    --port 4000 \
    --cidr 0.0.0.0/0 \
    --region ${REGION} 2>/dev/null || echo "Rule already exists"

# Step 9: Create ECS Service
echo "🚀 Creating ECS service..."
aws ecs create-service \
    --cluster ${ECS_CLUSTER} \
    --service-name ${ECS_SERVICE} \
    --task-definition ${TASK_DEFINITION} \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_ID}],securityGroups=[${SECURITY_GROUP_ID}],assignPublicIp=ENABLED}" \
    --region ${REGION} \
    || echo "Service already exists"

echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Set up AWS Secrets Manager:"
echo "   - GOOGLE_API_KEY: aws secretsmanager create-secret --name whatsapp-ai/google-api-key --secret-string 'your-api-key'"
echo "   - FIREBASE_SERVICE_ACCOUNT_BASE64: aws secretsmanager create-secret --name whatsapp-ai/firebase-service-account --secret-string 'your-base64-key'"
echo ""
echo "2. Check service status:"
echo "   aws ecs describe-services --cluster ${ECS_CLUSTER} --services ${ECS_SERVICE} --region ${REGION}"
echo ""
echo "3. View logs:"
echo "   aws logs tail /ecs/whatsapp-ai-chatbot --follow --region ${REGION}"
echo ""
echo "4. Get service endpoint:"
echo "   aws ecs describe-tasks --cluster ${ECS_CLUSTER} --tasks \$(aws ecs list-tasks --cluster ${ECS_CLUSTER} --service-name ${ECS_SERVICE} --query 'taskArns[0]' --output text --region ${REGION}) --region ${REGION}"

# Cleanup
rm -f task-definition.json

echo "🎉 WhatsApp AI Chatbot is now running on AWS ECS!"

