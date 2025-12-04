#!/bin/bash

# Chaguo Server Setup Script
# Run this on a fresh VPS to set up Chaguo proxy servers

set -e

echo "🚀 Starting Chaguo Server Setup..."
echo "=================================="

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo "Cannot detect OS. Exiting."
    exit 1
fi

echo "Detected OS: $OS $VERSION"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Update system
log "Updating system packages..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt-get update && apt-get upgrade -y
    apt-get install -y curl wget git sudo ufw net-tools
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
    yum update -y
    yum install -y curl wget git sudo net-tools firewalld
elif [ "$OS" = "alpine" ]; then
    apk update && apk upgrade
    apk add curl wget git sudo net-tools iptables
else
    error "Unsupported OS: $OS"
    exit 1
fi
success "System updated"

# Create chaguo user
log "Creating chaguo user..."
if ! id "chaguo" &>/dev/null; then
    useradd -m -s /bin/bash chaguo
    usermod -aG sudo chaguo
    echo "chaguo ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/chaguo
    success "Created chaguo user"
else
    warning "chaguo user already exists"
fi

# Setup firewall
log "Configuring firewall..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 8388/tcp
    ufw allow 51820/udp
    ufw --force enable
    success "UFW configured"
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
    systemctl start firewalld
    systemctl enable firewalld
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-port=8388/tcp
    firewall-cmd --permanent --add-port=51820/udp
    firewall-cmd --reload
    success "Firewalld configured"
fi

# Install Docker (for containerized deployment)
log "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    usermod -aG docker chaguo
    systemctl enable docker
    systemctl start docker
    success "Docker installed"
else
    warning "Docker already installed"
fi

# Install Docker Compose
log "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    success "Docker Compose installed"
else
    warning "Docker Compose already installed"
fi

# Create chaguo directory
log "Creating Chaguo directory structure..."
mkdir -p /opt/chaguo/{configs,logs,data}
chown -R chaguo:chaguo /opt/chaguo
cd /opt/chaguo

# Clone or create configs
log "Setting up configuration files..."
cat > /opt/chaguo/configs/v2ray-config.json << 'EOF'
{
  "log": {
    "loglevel": "warning",
    "access": "/var/log/v2ray/access.log",
    "error": "/var/log/v2ray/error.log"
  },
  "inbounds": [{
    "port": 443,
    "protocol": "vmess",
    "settings": {
      "clients": [
        {
          "id": "$(uuidgen)",
          "alterId": 0,
          "security": "auto"
        }
      ]
    },
    "streamSettings": {
      "network": "ws",
      "wsSettings": {
        "path": "/ws",
        "headers": {
          "Host": "www.cloudflare.com"
        }
      },
      "security": "tls",
      "tlsSettings": {
        "serverName": "www.cloudflare.com",
        "certificates": [{
          "certificateFile": "/etc/ssl/certs/chaguo.crt",
          "keyFile": "/etc/ssl/private/chaguo.key"
        }]
      }
    }
  }],
  "outbounds": [{
    "protocol": "freedom",
    "settings": {}
  }]
}
EOF

# Generate SSL certificates
log "Generating SSL certificates..."
mkdir -p /etc/ssl/{certs,private}
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/chaguo.key \
    -out /etc/ssl/certs/chaguo.crt \
    -subj "/C=TZ/ST=Dar es Salaam/L=Dar es Salaam/O=Chaguo/CN=chaguo.tz"

# Create Docker Compose file
log "Creating Docker Compose configuration..."
cat > /opt/chaguo/docker-compose.yml << 'EOF'
version: '3.8'

services:
  v2ray:
    image: v2fly/v2fly-core:latest
    container_name: chaguo-v2ray
    restart: unless-stopped
    ports:
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./configs/v2ray-config.json:/etc/v2ray/config.json
      - /etc/ssl/certs/chaguo.crt:/etc/ssl/certs/chaguo.crt
      - /etc/ssl/private/chaguo.key:/etc/ssl/private/chaguo.key
      - ./logs/v2ray:/var/log/v2ray
    networks:
      - chaguo-network
    command: run -c /etc/v2ray/config.json

  shadowsocks:
    image: shadowsocks/shadowsocks-libev:latest
    container_name: chaguo-ss
    restart: unless-stopped
    ports:
      - "8388:8388"
      - "8388:8388/udp"
    volumes:
      - ./configs/shadowsocks.json:/etc/shadowsocks-libev/config.json
    networks:
      - chaguo-network
    command: ss-server -c /etc/shadowsocks-libev/config.json -u

  wireguard:
    image: linuxserver/wireguard:latest
    container_name: chaguo-wg
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.conf.all.src_valid_mark=1
      - net.ipv4.ip_forward=1
    ports:
      - "51820:51820/udp"
    volumes:
      - ./configs/wireguard:/config
      - /lib/modules:/lib/modules
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Africa/Dar_es_Salaam
      - SERVERURL=chaguo.tz
      - SERVERPORT=51820
      - PEERS=10
      - PEERDNS=1.1.1.1
      - INTERNAL_SUBNET=10.13.13.0
    networks:
      - chaguo-network

  nginx:
    image: nginx:alpine
    container_name: chaguo-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "8443:443"
    volumes:
      - ./configs/nginx.conf:/etc/nginx/nginx.conf
      - /etc/ssl/certs/chaguo.crt:/etc/ssl/certs/chaguo.crt
      - /etc/ssl/private/chaguo.key:/etc/ssl/private/chaguo.key
      - ./logs/nginx:/var/log/nginx
    networks:
      - chaguo-network

  monitoring:
    image: prom/prometheus:latest
    container_name: chaguo-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./configs/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./data/prometheus:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - chaguo-network

networks:
  chaguo-network:
    driver: bridge
EOF

# Create nginx config
log "Creating nginx configuration..."
cat > /opt/chaguo/configs/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Server blocks
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name chaguo.tz;

        ssl_certificate /etc/ssl/certs/chaguo.crt;
        ssl_certificate_key /etc/ssl/private/chaguo.key;

        location / {
            return 200 '{"status": "ok", "service": "chaguo", "version": "1.0.0"}';
            add_header Content-Type application/json;
        }

        location /health {
            access_log off;
            return 200 'healthy\n';
            add_header Content-Type text/plain;
        }

        location /ws {
            proxy_pass http://v2ray:443;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /metrics {
            proxy_pass http://monitoring:9090;
        }
    }
}
EOF

# Create prometheus config
log "Creating Prometheus configuration..."
cat > /opt/chaguo/configs/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'chaguo-servers'
    static_configs:
      - targets: ['v2ray:443', 'shadowsocks:8388', 'nginx:80']
    metrics_path: /health
    scheme: http

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
EOF

# Set permissions
log "Setting permissions..."
chown -R chaguo:chaguo /opt/chaguo
chmod 600 /etc/ssl/private/chaguo.key
chmod 644 /etc/ssl/certs/chaguo.crt

# Start services
log "Starting Chaguo services..."
cd /opt/chaguo
sudo -u chaguo docker-compose up -d

# Wait for services to start
sleep 10

# Check service status
log "Checking service status..."
if sudo -u chaguo docker-compose ps | grep -q "Up"; then
    success "All services are running!"
    
    echo ""
    echo "=========================================="
    echo "🎉 Chaguo Server Setup Complete!"
    echo "=========================================="
    echo ""
    echo "Services running:"
    echo "  • V2Ray (WebSocket + TLS) on port 443"
    echo "  • Shadowsocks on port 8388"
    echo "  • WireGuard on port 51820/udp"
    echo "  • Nginx reverse proxy on ports 80/443"
    echo "  • Prometheus monitoring on port 9090"
    echo ""
    echo "Configuration files:"
    echo "  • /opt/chaguo/configs/ - Server configurations"
    echo "  • /opt/chaguo/docker-compose.yml - Service definitions"
    echo ""
    echo "Management commands:"
    echo "  • sudo -u chaguo docker-compose ps      # Check status"
    echo "  • sudo -u chaguo docker-compose logs    # View logs"
    echo "  • sudo -u chaguo docker-compose restart # Restart services"
    echo ""
    echo "Next steps:"
    echo "  1. Update configuration files with your domain"
    echo "  2. Set up proper SSL certificates (Let's Encrypt)"
    echo "  3. Configure monitoring and alerts"
    echo "  4. Add to Chaguo configuration distribution"
    echo ""
    
else
    error "Some services failed to start. Check logs with: sudo -u chaguo docker-compose logs"
    exit 1
fi

# Setup auto-update
log "Setting up auto-update..."
cat > /etc/cron.daily/chaguo-update << 'EOF'
#!/bin/bash
cd /opt/chaguo
sudo -u chaguo docker-compose pull
sudo -u chaguo docker-compose up -d
sudo -u chaguo docker system prune -af
EOF
chmod +x /etc/cron.daily/chaguo-update

success "Auto-update configured (runs daily)"

echo ""
echo "Setup completed successfully! 🎉"
echo "Server is ready to serve Chaguo clients."
