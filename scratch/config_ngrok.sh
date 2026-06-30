#!/bin/bash
sudo bash -c 'cat << "SERVICE_EOF" > /etc/systemd/system/ngrok.service
[Unit]
Description=Ngrok Tunnel Service
After=network.target

[Service]
ExecStart=/usr/bin/ngrok http --domain=unblissful-unverdantly-stan.ngrok-free.dev 4000
Restart=always
User=Babayasa
Environment="HOME=/home/Babayasa"

[Install]
WantedBy=multi-user.target
SERVICE_EOF'
sudo systemctl daemon-reload
sudo systemctl enable ngrok
sudo systemctl restart ngrok
