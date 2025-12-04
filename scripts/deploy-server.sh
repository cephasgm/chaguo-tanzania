#!/bin/bash
# Quick server setup for Chaguo

echo "🚀 Setting up Chaguo VPN Server..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Create V2Ray config
sudo mkdir -p /etc/chaguo
cat > /etc/chaguo/config.json << EOF
{
  "inbounds": [{
    "port": 443,
    "protocol": "vmess",
    "settings": {
      "clients": [{
        "id": "b831381d-6324-4d53-ad4f-8cda48b30811",
        "alterId": 0
      }]
    },
    "streamSettings": {
      "network": "ws",
      "wsSettings": {
        "path": "/ws"
      },
      "security": "tls"
    }
  }],
  "outbounds": [{
    "protocol": "freedom"
  }]
}
EOF

# Run V2Ray container
sudo docker run -d \
  --name chaguo-v2ray \
  --restart always \
  -v /etc/chaguo:/etc/v2ray \
  -p 443:443 \
  v2fly/v2fly-core:latest

echo "✅ Server setup complete!"
echo "Server IP: $(curl -s ifconfig.me)"
echo "Port: 443"
echo "User ID: b831381d-6324-4d53-ad4f-8cda48b30811"
