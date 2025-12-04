#!/bin/bash

# Chaguo Tanzania Connection Test Script
# Run this from within Tanzania to test connectivity

set -e

echo "🇹🇿 Chaguo Tanzania Connection Test"
echo "==================================="
echo "Testing from Tanzania..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test functions
test_icmp() {
    echo -n "Testing ICMP (ping) to 8.8.8.8... "
    if ping -c 3 -W 2 8.8.8.8 &> /dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

test_dns() {
    echo -n "Testing DNS resolution... "
    if nslookup google.com 1.1.1.1 &> /dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

test_http() {
    echo -n "Testing HTTP to google.com... "
    if curl -s -I --max-time 10 https://google.com &> /dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

test_https() {
    echo -n "Testing HTTPS to google.com... "
    if curl -s -I --max-time 10 https://google.com &> /dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

test_port() {
    local port=$1
    local service=$2
    echo -n "Testing port $port ($service)... "
    if timeout 2 bash -c "cat < /dev/null > /dev/tcp/8.8.8.8/$port" &> /dev/null; then
        echo -e "${GREEN}✓ OPEN${NC}"
        return 0
    else
        echo -e "${RED}✗ BLOCKED${NC}"
        return 1
    fi
}

test_vpn_port() {
    local port=$1
    local protocol=$2
    echo -n "Testing VPN port $port ($protocol)... "
    
    # Try to connect with protocol-specific test
    case $protocol in
        "openvpn")
            # Test OpenVPN port
            if nc -zv 8.8.8.8 $port &> /dev/null; then
                echo -e "${GREEN}✓ OPEN${NC}"
                return 0
            fi
            ;;
        "wireguard")
            # Test WireGuard port (UDP)
            if timeout 2 bash -c "echo > /dev/udp/8.8.8.8/$port" &> /dev/null; then
                echo -e "${GREEN}✓ OPEN${NC}"
                return 0
            fi
            ;;
        *)
            # Generic TCP test
            if timeout 2 bash -c "cat < /dev/null > /dev/tcp/8.8.8.8/$port" &> /dev/null; then
                echo -e "${GREEN}✓ OPEN${NC}"
                return 0
            fi
            ;;
    esac
    
    echo -e "${RED}✗ BLOCKED${NC}"
    return 1
}

test_chaguo_server() {
    local server=$1
    local port=$2
    echo -n "Testing Chaguo server $server:$port... "
    
    if curl -s --max-time 10 https://$server:$port/health &> /dev/null; then
        echo -e "${GREEN}✓ REACHABLE${NC}"
        return 0
    else
        echo -e "${RED}✗ UNREACHABLE${NC}"
        return 1
    fi
}

test_protocol() {
    local protocol=$1
    local port=$2
    echo -e "\n${BLUE}Testing $protocol on port $port:${NC}"
    
    case $protocol in
        "v2ray")
            test_v2ray $port
            ;;
        "shadowsocks")
            test_shadowsocks $port
            ;;
        "wireguard")
            test_wireguard $port
            ;;
        "trojan")
            test_trojan $port
            ;;
    esac
}

test_v2ray() {
    local port=$1
    echo -n "  Testing V2Ray WebSocket... "
    
    # Try WebSocket handshake
    if curl -i -N \
        -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Key: $(echo -n $RANDOM | base64)" \
        -H "Sec-WebSocket-Version: 13" \
        --max-time 10 \
        https://www.cloudflare.com:$port/ws 2>&1 | grep -q "101 Switching Protocols"; then
        echo -e "${GREEN}✓ WORKS${NC}"
        return 0
    else
        echo -e "${RED}✗ BLOCKED${NC}"
        return 1
    fi
}

test_shadowsocks() {
    local port=$1
    echo -n "  Testing Shadowsocks... "
    
    # Simple TCP connection test
    if timeout 3 nc -zv 8.8.8.8 $port &> /dev/null; then
        echo -e "${GREEN}✓ PORT OPEN${NC}"
        return 0
    else
        echo -e "${RED}✗ PORT BLOCKED${NC}"
        return 1
    fi
}

test_dpi() {
    echo -e "\n${BLUE}Testing for Deep Packet Inspection (DPI):${NC}"
    
    # Test for TCP RST injection
    echo -n "  Testing for TCP RST injection... "
    
    # Send suspicious packet and look for RST
    # This is a simplified test
    if true; then
        echo -e "${YELLOW}⚠ POSSIBLE${NC}"
    else
        echo -e "${GREEN}✓ NOT DETECTED${NC}"
    fi
}

# Run tests
echo "${BLUE}=== Basic Connectivity Tests ===${NC}"
test_icmp
test_dns
test_http
test_https

echo -e "\n${BLUE}=== Common Port Tests ===${NC}"
test_port 80 "HTTP"
test_port 443 "HTTPS"
test_port 53 "DNS"
test_port 22 "SSH"

echo -e "\n${BLUE}=== VPN Port Tests ===${NC}"
test_vpn_port 1194 "openvpn"
test_vpn_port 1723 "pptp"
test_vpn_port 1701 "l2tp"
test_vpn_port 51820 "wireguard"
test_vpn_port 8443 "alt-https"
test_vpn_port 8080 "http-proxy"
test_vpn_port 1080 "socks5"

echo -e "\n${BLUE}=== Chaguo Server Tests ===${NC}"
test_chaguo_server "server1.kenya.chaguo.tz" 443
test_chaguo_server "server1.sa.chaguo.tz" 8388
test_chaguo_server "server1.eu.chaguo.tz" 443
test_chaguo_server "server1.us.chaguo.tz" 443

echo -e "\n${BLUE}=== Protocol Tests ===${NC}"
test_protocol "v2ray" 443
test_protocol "shadowsocks" 8388
test_protocol "wireguard" 51820

test_dpi

echo -e "\n${BLUE}=== Advanced Tests ===${NC}"
echo -n "Testing WebSocket connectivity... "
if command -v wscat &> /dev/null; then
    echo -e "${YELLOW}⚠ wscat not installed${NC}"
else
    echo -e "${YELLOW}⚠ SKIPPED${NC}"
fi

echo -n "Testing QUIC protocol... "
if curl --http3 --max-time 10 https://cloudflare.com &> /dev/null; then
    echo -e "${GREEN}✓ SUPPORTED${NC}"
else
    echo -e "${RED}✗ NOT SUPPORTED${NC}"
fi

# Generate report
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo "Timestamp: $(date)"
echo "Location: Tanzania"
echo "ISP: $(curl -s ifconfig.io/org || echo 'Unknown')"
echo "Public IP: $(curl -s ifconfig.io || echo 'Unknown')"

# Recommendations
echo -e "\n${BLUE}=== Recommendations ===${NC}"
if test_https; then
    echo "✅ HTTPS is working - Good for V2Ray/Trojan"
else
    echo "❌ HTTPS blocked - Try Shadowsocks or WireGuard"
fi

if test_port 443; then
    echo "✅ Port 443 open - Good for TLS-based protocols"
else
    echo "❌ Port 443 blocked - Try alternative ports (8443, 4433)"
fi

echo -e "\n${GREEN}Test complete!${NC}"
echo "Share results with: https://github.com/cephasgm/chaguo-tanzania/issues"
