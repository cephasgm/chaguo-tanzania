#!/bin/bash
# Chaguo Tanzania - Infrastructure Deployment Script
# Deploys complete server infrastructure across multiple providers

set -e

echo "🚀 Chaguo Tanzania Infrastructure Deployment"
echo "=========================================="
echo ""

# Configuration
readonly DEPLOYMENT_ID="chaguo-$(date +%Y%m%d-%H%M%S)"
readonly CONFIG_DIR="$(dirname "$0")/../configs"
readonly LOG_DIR="/tmp/chaguo-deploy-$(date +%s)"
readonly SSH_KEY_PATH="$HOME/.ssh/chaguo-deploy"
readonly SERVERS_FILE="${CONFIG_DIR}/servers.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check for required tools
    local required_tools=("terraform" "ansible" "jq" "ssh-keygen" "scp" "ssh")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "Required tool not found: $tool"
        fi
    done
    success "All required tools found"
    
    # Check for cloud provider CLI tools
    if ! command -v doctl &> /dev/null; then
        warning "DigitalOcean CLI (doctl) not found, skipping DO deployment"
    fi
    
    if ! command -v oci &> /dev/null; then
        warning "Oracle Cloud CLI (oci) not found, skipping OCI deployment"
    fi
    
    if [[ ! -f "$HOME/.aws/credentials" ]]; then
        warning "AWS credentials not found, skipping AWS deployment"
    fi
    
    # Create SSH key if not exists
    if [[ ! -f "${SSH_KEY_PATH}" ]]; then
        log "Generating SSH key for deployment..."
        ssh-keygen -t ed25519 -f "${SSH_KEY_PATH}" -N "" -q
        chmod 600 "${SSH_KEY_PATH}"
        success "SSH key generated: ${SSH_KEY_PATH}"
    fi
    
    # Create log directory
    mkdir -p "${LOG_DIR}"
    success "Log directory created: ${LOG_DIR}"
}

# Parse arguments
parse_arguments() {
    local providers=""
    local regions=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --providers)
                providers="$2"
                shift 2
                ;;
            --regions)
                regions="$2"
                shift 2
                ;;
            --config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Unknown argument: $1"
                ;;
        esac
    done
    
    # Default providers if not specified
    if [[ -z "$providers" ]]; then
        providers="do,oci,aws"
    fi
    
    # Default regions if not specified
    if [[ -z "$regions" ]]; then
        regions="nairobi,johannesburg,frankfurt,ashburn"
    fi
    
    # Export variables
    export DEPLOYMENT_PROVIDERS="$providers"
    export DEPLOYMENT_REGIONS="$regions"
}

show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Chaguo Tanzania infrastructure across multiple cloud providers.

Options:
  --providers PROVIDERS   Comma-separated list of providers (do,oci,aws,all)
  --regions REGIONS       Comma-separated list of regions to deploy to
  --config CONFIG_FILE    Path to configuration file
  --help, -h             Show this help message

Examples:
  $0 --providers do,oci --regions nairobi,frankfurt
  $0 --providers all --regions all
  $0 --config custom-config.json

Available providers:
  - do: DigitalOcean
  - oci: Oracle Cloud
  - aws: Amazon Web Services

Available regions:
  - nairobi: Nairobi, Kenya (Africa)
  - johannesburg: Johannesburg, South Africa (Africa)
  - frankfurt: Frankfurt, Germany (Europe)
  - ashburn: Ashburn, USA (North America)
  - singapore: Singapore (Asia)
  - sydney: Sydney, Australia (Oceania)
EOF
}

# Terraform deployment functions
deploy_with_terraform() {
    local provider="$1"
    local region="$2"
    local server_type="$3"
    
    log "Deploying ${provider} server in ${region}..."
    
    # Create Terraform directory
    local tf_dir="${LOG_DIR}/terraform/${provider}-${region}"
    mkdir -p "${tf_dir}"
    
    # Generate Terraform configuration
    generate_terraform_config "$provider" "$region" "$server_type" > "${tf_dir}/main.tf"
    
    # Initialize and apply
    cd "${tf_dir}"
    
    terraform init -no-color > "${LOG_DIR}/terraform-init-${provider}-${region}.log" 2>&1
    if [[ $? -ne 0 ]]; then
        warning "Terraform init failed for ${provider}/${region}"
        return 1
    fi
    
    terraform apply -auto-approve -no-color > "${LOG_DIR}/terraform-apply-${provider}-${region}.log" 2>&1
    if [[ $? -ne 0 ]]; then
        warning "Terraform apply failed for ${provider}/${region}"
        return 1
    fi
    
    # Get outputs
    local server_ip=$(terraform output -raw server_ip 2>/dev/null || echo "")
    local server_id=$(terraform output -raw server_id 2>/dev/null || echo "")
    
    if [[ -n "$server_ip" ]]; then
        echo "${provider},${region},${server_ip},${server_id}" >> "${LOG_DIR}/deployed-servers.csv"
        success "Deployed ${provider} server in ${region}: ${server_ip}"
    else
        warning "Failed to get server IP for ${provider}/${region}"
    fi
    
    cd - > /dev/null
}

generate_terraform_config() {
    local provider="$1"
    local region="$2"
    local server_type="$3"
    
    case "$provider" in
        "do")
            cat << EOF
terraform {
  required_providers {
    digitalocean = {
      source = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

variable "do_token" {
  description = "DigitalOcean API token"
  type = string
  sensitive = true
}

variable "ssh_key_id" {
  description = "SSH key ID"
  type = string
}

data "digitalocean_ssh_key" "chaguo_key" {
  name = "chaguo-deploy"
}

resource "digitalocean_droplet" "chaguo_server" {
  image  = "ubuntu-22-04-x64"
  name   = "chaguo-${region}-${DEPLOYMENT_ID}"
  region = "${map_region "do" "$region")}"
  size   = "s-1vcpu-1gb"
  ssh_keys = [data.digitalocean_ssh_key.chaguo_key.id]
  
  tags = ["chaguo", "tanzania", "${region}", "vpn"]
  
  connection {
    type = "ssh"
    user = "root"
    host = self.ipv4_address
    private_key = file("${SSH_KEY_PATH}")
    timeout = "2m"
  }
  
  provisioner "file" {
    source      = "../../scripts/server-setup.sh"
    destination = "/tmp/server-setup.sh"
  }
  
  provisioner "remote-exec" {
    inline = [
      "chmod +x /tmp/server-setup.sh",
      "sudo /tmp/server-setup.sh 2>&1 | tee /tmp/chaguo-setup.log"
    ]
  }
}

output "server_ip" {
  value = digitalocean_droplet.chaguo_server.ipv4_address
}

output "server_id" {
  value = digitalocean_droplet.chaguo_server.id
}
EOF
            ;;
        "oci")
            cat << EOF
terraform {
  required_providers {
    oci = {
      source = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

provider "oci" {
  tenancy_ocid = var.tenancy_ocid
  user_ocid = var.user_ocid
  fingerprint = var.fingerprint
  private_key_path = var.private_key_path
  region = "${map_region "oci" "$region")}"
}

variable "tenancy_ocid" {
  description = "OCI Tenancy OCID"
  type = string
  sensitive = true
}

variable "user_ocid" {
  description = "OCI User OCID"
  type = string
  sensitive = true
}

variable "fingerprint" {
  description = "API Key Fingerprint"
  type = string
  sensitive = true
}

variable "private_key_path" {
  description = "Path to private key"
  type = string
}

resource "oci_core_instance" "chaguo_server" {
  compartment_id = var.compartment_id
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  shape = "VM.Standard.A1.Flex"
  
  shape_config {
    memory_in_gbs = 6
    ocpus = 4
  }
  
  display_name = "chaguo-${region}-${DEPLOYMENT_ID}"
  
  create_vnic_details {
    subnet_id = oci_core_subnet.chaguo_subnet.id
    display_name = "chaguo-vnic"
    assign_public_ip = true
  }
  
  source_details {
    source_type = "image"
    source_id = data.oci_core_images.ubuntu.images[0].id
  }
  
  metadata = {
    ssh_authorized_keys = file("${SSH_KEY_PATH}.pub")
  }
  
  preserve_boot_volume = false
}

resource "oci_core_vcn" "chaguo_vcn" {
  compartment_id = var.compartment_id
  cidr_block = "10.0.0.0/16"
  display_name = "chaguo-vcn-${region}"
}

resource "oci_core_subnet" "chaguo_subnet" {
  compartment_id = var.compartment_id
  vcn_id = oci_core_vcn.chaguo_vcn.id
  cidr_block = "10.0.1.0/24"
  display_name = "chaguo-subnet-${region}"
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_id
}

data "oci_core_images" "ubuntu" {
  compartment_id = var.compartment_id
  operating_system = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape = "VM.Standard.A1.Flex"
}

output "server_ip" {
  value = oci_core_instance.chaguo_server.public_ip
}

output "server_id" {
  value = oci_core_instance.chaguo_server.id
}
EOF
            ;;
        "aws")
            cat << EOF
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${map_region "aws" "$region")}"
}

resource "aws_instance" "chaguo_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
  key_name      = aws_key_pair.chaguo_key.key_name
  
  vpc_security_group_ids = [aws_security_group.chaguo_sg.id]
  subnet_id              = aws_subnet.chaguo_subnet.id
  
  tags = {
    Name = "chaguo-${region}-${DEPLOYMENT_ID}"
    Project = "ChaguoTanzania"
    Type = "VPN"
  }
  
  user_data = filebase64("${CONFIG_DIR}/templates/user-data.sh")
  
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    delete_on_termination = true
  }
}

resource "aws_key_pair" "chaguo_key" {
  key_name   = "chaguo-key-${DEPLOYMENT_ID}"
  public_key = file("${SSH_KEY_PATH}.pub")
}

resource "aws_security_group" "chaguo_sg" {
  name        = "chaguo-sg-${region}"
  description = "Chaguo VPN Security Group"
  vpc_id      = aws_vpc.chaguo_vpc.id
  
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "WireGuard"
    from_port   = 51820
    to_port     = 51820
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    description = "Shadowsocks"
    from_port   = 8388
    to_port     = 8388
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_vpc" "chaguo_vpc" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "chaguo-vpc-${region}"
  }
}

resource "aws_subnet" "chaguo_subnet" {
  vpc_id     = aws_vpc.chaguo_vpc.id
  cidr_block = "10.0.1.0/24"
  
  tags = {
    Name = "chaguo-subnet-${region}"
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  
  owners = ["099720109477"] # Canonical
}

output "server_ip" {
  value = aws_instance.chaguo_server.public_ip
}

output "server_id" {
  value = aws_instance.chaguo_server.id
}
EOF
            ;;
    esac
}

# Map region names to provider-specific regions
map_region() {
    local provider="$1"
    local region="$2"
    
    case "$provider" in
        "do")
            case "$region" in
                "nairobi") echo "sfo3" ;;
                "johannesburg") echo "fra1" ;;
                "frankfurt") echo "fra1" ;;
                "ashburn") echo "nyc3" ;;
                "singapore") echo "sgp1" ;;
                "sydney") echo "syd1" ;;
                *) echo "ams3" ;;
            esac
            ;;
        "oci")
            case "$region" in
                "nairobi") echo "uk-london-1" ;;
                "johannesburg") echo "eu-frankfurt-1" ;;
                "frankfurt") echo "eu-frankfurt-1" ;;
                "ashburn") echo "us-ashburn-1" ;;
                "singapore") echo "ap-singapore-1" ;;
                "sydney") echo "ap-sydney-1" ;;
                *) echo "eu-frankfurt-1" ;;
            esac
            ;;
        "aws")
            case "$region" in
                "nairobi") echo "eu-west-2" ;;
                "johannesburg") echo "af-south-1" ;;
                "frankfurt") echo "eu-central-1" ;;
                "ashburn") echo "us-east-1" ;;
                "singapore") echo "ap-southeast-1" ;;
                "sydney") echo "ap-southeast-2" ;;
                *) echo "us-east-1" ;;
            esac
            ;;
    esac
}

# Ansible configuration deployment
deploy_ansible_config() {
    local server_ip="$1"
    local region="$2"
    local provider="$3"
    
    log "Deploying configuration to ${server_ip}..."
    
    # Create Ansible inventory
    cat > "${LOG_DIR}/ansible/inventory.ini" << EOF
[chaguo_servers]
${server_ip}

[chaguo_servers:vars]
ansible_user=root
ansible_ssh_private_key_file=${SSH_KEY_PATH}
ansible_python_interpreter=/usr/bin/python3
server_region=${region}
server_provider=${provider}
deployment_id=${DEPLOYMENT_ID}
EOF
    
    # Create Ansible playbook
    cat > "${LOG_DIR}/ansible/deploy.yml" << EOF
---
- name: Deploy Chaguo VPN Server
  hosts: chaguo_servers
  become: yes
  
  vars:
    config_dir: /opt/chaguo
    log_dir: /var/log/chaguo
    domain_name: chaguo.tz
    
  tasks:
    - name: Create directories
      file:
        path: "{{ item }}"
        state: directory
        owner: root
        group: root
        mode: '0755'
      loop:
        - "{{ config_dir }}"
        - "{{ config_dir }}/configs"
        - "{{ config_dir }}/logs"
        - "{{ log_dir }}"
    
    - name: Copy configuration files
      copy:
        src: "../../configs/templates/{{ item }}"
        dest: "{{ config_dir }}/{{ item }}"
        owner: root
        group: root
        mode: '0644'
      loop:
        - v2ray-config.json
        - shadowsocks.json
        - nginx.conf
        - docker-compose.yml
    
    - name: Generate SSL certificates
      shell: |
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
          -keyout /etc/ssl/private/chaguo.key \
          -out /etc/ssl/certs/chaguo.crt \
          -subj "/C=TZ/ST=Dar es Salaam/L=Dar es Salaam/O=Chaguo/CN={{ domain_name }}"
      args:
        creates: /etc/ssl/certs/chaguo.crt
    
    - name: Start Docker Compose services
      shell: |
        cd {{ config_dir }}
        docker-compose up -d
      args:
        creates: /var/run/docker/chaguo-v2ray.pid
    
    - name: Enable firewall ports
      ufw:
        rule: allow
        port: "{{ item }}"
        proto: tcp
      loop:
        - 22
        - 80
        - 443
        - 8388
      when: ansible_os_family == 'Debian'
    
    - name: Create monitoring script
      copy:
        dest: /usr/local/bin/monitor-chaguo.sh
        content: |
          #!/bin/bash
          echo "Chaguo Server Monitor"
          echo "====================="
          echo "Region: {{ region }}"
          echo "Provider: {{ provider }}"
          echo "Deployment ID: {{ deployment_id }}"
          echo ""
          echo "Service Status:"
          docker-compose -f {{ config_dir }}/docker-compose.yml ps
          echo ""
          echo "Resource Usage:"
          free -h
          echo ""
          df -h
        owner: root
        group: root
        mode: '0755'
    
    - name: Schedule automatic updates
      cron:
        name: "Chaguo Auto Update"
        minute: "0"
        hour: "3"
        job: "cd {{ config_dir }} && docker-compose pull && docker-compose up -d && docker system prune -af"
    
    - name: Register server in central registry
      uri:
        url: "https://registry.chaguo.tz/api/servers"
        method: POST
        body_format: json
        body:
          ip: "{{ ansible_default_ipv4.address }}"
          region: "{{ region }}"
          provider: "{{ provider }}"
          deployment_id: "{{ deployment_id }}"
          status: "active"
        status_code: 200, 201
        timeout: 10
      register: registry_result
      ignore_errors: yes
      when: false  # Disabled by default, enable when registry is set up
EOF
    
    # Run Ansible playbook
    cd "${LOG_DIR}/ansible"
    ansible-playbook -i inventory.ini deploy.yml > "${LOG_DIR}/ansible-${server_ip}.log" 2>&1
    
    if [[ $? -eq 0 ]]; then
        success "Configuration deployed to ${server_ip}"
    else
        warning "Configuration deployment failed for ${server_ip}"
    fi
}

# Health check deployed servers
health_check_servers() {
    log "Performing health checks on deployed servers..."
    
    if [[ ! -f "${LOG_DIR}/deployed-servers.csv" ]]; then
        warning "No servers deployed for health check"
        return
    fi
    
    echo "IP Address,Region,Provider,HTTP Status,HTTPS Status,Latency" > "${LOG_DIR}/health-check.csv"
    
    while IFS=',' read -r provider region ip id; do
        if [[ -z "$ip" ]]; then
            continue
        fi
        
        log "Checking health of ${ip} (${region}/${provider})..."
        
        # Check HTTP
        local http_status="FAIL"
        if curl -s -f -m 5 "http://${ip}:80/health" > /dev/null 2>&1; then
            http_status="OK"
        fi
        
        # Check HTTPS
        local https_status="FAIL"
        if curl -s -f -m 5 -k "https://${ip}:443/health" > /dev/null 2>&1; then
            https_status="OK"
        fi
        
        # Check latency
        local latency="N/A"
        if ping -c 1 -W 2 "$ip" > /dev/null 2>&1; then
            latency=$(ping -c 3 -i 0.2 "$ip" | tail -1 | awk -F '/' '{print $5}')
        fi
        
        echo "${ip},${region},${provider},${http_status},${https_status},${latency}" >> "${LOG_DIR}/health-check.csv"
        
        if [[ "$http_status" == "OK" && "$https_status" == "OK" ]]; then
            success "Server ${ip} is healthy"
        else
            warning "Server ${ip} health check failed"
        fi
    done < "${LOG_DIR}/deployed-servers.csv"
    
    # Display health check summary
    echo ""
    echo "Health Check Summary:"
    echo "===================="
    column -t -s ',' "${LOG_DIR}/health-check.csv"
    echo ""
}

# Generate deployment report
generate_report() {
    log "Generating deployment report..."
    
    local report_file="${LOG_DIR}/deployment-report.md"
    
    cat > "$report_file" << EOF
# Chaguo Tanzania Infrastructure Deployment Report

## Deployment Information
- **Deployment ID**: ${DEPLOYMENT_ID}
- **Timestamp**: $(date)
- **Providers**: ${DEPLOYMENT_PROVIDERS}
- **Regions**: ${DEPLOYMENT_REGIONS}

## Deployed Servers

EOF
    
    if [[ -f "${LOG_DIR}/deployed-servers.csv" ]]; then
        echo "| Provider | Region | IP Address | Server ID |" >> "$report_file"
        echo "|----------|--------|------------|-----------|" >> "$report_file"
        
        while IFS=',' read -r provider region ip id; do
            echo "| $provider | $region | $ip | $id |" >> "$report_file"
        done < "${LOG_DIR}/deployed-servers.csv"
    else
        echo "No servers were deployed." >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

## Health Check Results

EOF
    
    if [[ -f "${LOG_DIR}/health-check.csv" ]]; then
        echo "| IP Address | Region | Provider | HTTP | HTTPS | Latency |" >> "$report_file"
        echo "|------------|--------|----------|------|-------|---------|" >> "$report_file"
        
        # Skip header
        tail -n +2 "${LOG_DIR}/health-check.csv" | while IFS=',' read -r ip region provider http https latency; do
            echo "| $ip | $region | $provider | $http | $https | $latency |" >> "$report_file"
        done
    else
        echo "No health check data available." >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

## Configuration Details

### Generated Files
- Terraform configurations: \`${LOG_DIR}/terraform/\`
- Ansible playbooks: \`${LOG_DIR}/ansible/\`
- Deployment logs: \`${LOG_DIR}/\`

### Server Access
SSH Key: \`${SSH_KEY_PATH}\`
Example SSH command:
\`\`\`bash
ssh -i ${SSH_KEY_PATH} root@<server-ip>
\`\`\`

### Server Management
1. Check service status:
   \`\`\`bash
   docker-compose -f /opt/chaguo/docker-compose.yml ps
   \`\`\`
   
2. View logs:
   \`\`\`bash
   docker-compose -f /opt/chaguo/docker-compose.yml logs
   \`\`\`
   
3. Restart services:
   \`\`\`bash
   docker-compose -f /opt/chaguo/docker-compose.yml restart
   \`\`\`

## Next Steps

1. Update DNS records for deployed servers
2. Add servers to configuration distribution system
3. Test connectivity from Tanzania
4. Monitor server performance and adjust scaling

## Troubleshooting

### Common Issues

1. **SSH Connection Failed**
   - Check firewall rules
   - Verify SSH key permissions
   - Ensure server is running

2. **Services Not Starting**
   - Check Docker installation
   - Verify port availability
   - Review Docker Compose logs

3. **SSL Certificate Errors**
   - Generate new certificates
   - Update nginx configuration
   - Restart nginx service

### Support

For issues with this deployment:
1. Check logs in \`${LOG_DIR}\`
2. Review Terraform/Ansible output
3. Contact Chaguo infrastructure team

---

*Deployment completed: $(date)*
EOF
    
    success "Report generated: ${report_file}"
    
    # Copy report to current directory
    cp "$report_file" "./deployment-report-${DEPLOYMENT_ID}.md"
    log "Report copied to: ./deployment-report-${DEPLOYMENT_ID}.md"
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files..."
    
    # Ask for confirmation before removing logs
    read -p "Keep deployment logs? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        rm -rf "${LOG_DIR}"
        success "Temporary files cleaned up"
    else
        log "Logs preserved at: ${LOG_DIR}"
    fi
}

# Main deployment function
main() {
    echo "🚀 Starting Chaguo Tanzania Infrastructure Deployment"
    echo "=================================================="
    echo ""
    
    # Parse arguments
    parse_arguments "$@"
    
    # Check prerequisites
    check_prerequisites
    
    # Create deployment directories
    mkdir -p "${LOG_DIR}/terraform"
    mkdir -p "${LOG_DIR}/ansible"
    
    # Initialize deployment file
    echo "provider,region,ip_address,server_id" > "${LOG_DIR}/deployed-servers.csv"
    
    # Deploy servers
    IFS=',' read -ra PROVIDERS <<< "${DEPLOYMENT_PROVIDERS}"
    IFS=',' read -ra REGIONS <<< "${DEPLOYMENT_REGIONS}"
    
    for provider in "${PROVIDERS[@]}"; do
        for region in "${REGIONS[@]}"; do
            log "Deploying ${provider} server in ${region}..."
            
            # Deploy server
            deploy_with_terraform "$provider" "$region" "vpn"
            
            # Get the last deployed server IP
            local server_ip=$(tail -1 "${LOG_DIR}/deployed-servers.csv" | cut -d',' -f3)
            
            if [[ -n "$server_ip" && "$server_ip" != "ip_address" ]]; then
                # Deploy configuration
                deploy_ansible_config "$server_ip" "$region" "$provider"
            fi
        done
    done
    
    # Health check
    health_check_servers
    
    # Generate report
    generate_report
    
    echo ""
    echo "🎉 Deployment Complete!"
    echo "====================="
    echo ""
    echo "Summary:"
    echo "  - Deployment ID: ${DEPLOYMENT_ID}"
    echo "  - Logs: ${LOG_DIR}"
    echo "  - Report: ./deployment-report-${DEPLOYMENT_ID}.md"
    echo ""
    echo "Next steps:"
    echo "  1. Review the deployment report"
    echo "  2. Test server connectivity"
    echo "  3. Update configuration distribution"
    echo "  4. Monitor server health"
    echo ""
    
    # Cleanup
    cleanup
}

# Trap signals
trap 'error "Deployment interrupted by user"' INT TERM

# Run main function
main "$@"
