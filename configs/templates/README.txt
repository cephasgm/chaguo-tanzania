===============================================================================
 CHAGUO TANZANIA - CONFIGURATION TEMPLATES
===============================================================================

This directory contains template files for generating Chaguo server configurations.
These templates are used by the configuration generator script to create secure,
rotating configurations for VPN servers.

================================================================================
 DIRECTORY STRUCTURE
================================================================================

configs/templates/
├── v2ray-template.json      - V2Ray + WebSocket configuration template
├── shadowsocks-template.json - Shadowsocks with obfuscation template
├── wireguard-template.json  - WireGuard server configuration template
├── trojan-template.json     - Trojan-GO configuration template
├── nginx-template.conf      - Nginx reverse proxy template
├── docker-compose-template.yml - Docker deployment template
└── README.txt              - This file

================================================================================
 TEMPLATE VARIABLES
================================================================================

All templates use the following variable substitution system:

{{VARIABLE_NAME}} - Will be replaced during configuration generation

Common variables:
-----------------
{{SERVER_ID}}           - Unique server identifier (e.g., server-ken-01)
{{SERVER_HOSTNAME}}     - Server hostname (e.g., server1.kenya.chaguo.tz)
{{SERVER_IP}}           - Server IP address
{{SERVER_REGION}}       - Geographic region (tz, ke, za, eu, us)
{{SERVER_COUNTRY}}      - Country name
{{SERVER_LOCATION}}     - Physical location
{{SERVER_PROVIDER}}     - Cloud provider
{{PORT_HTTPS}}          - HTTPS port (default: 443)
{{PORT_SHADOWSOCKS}}    - Shadowsocks port (default: 8388)
{{PORT_WIREGUARD}}      - WireGuard port (default: 51820)
{{DOMAIN_FRONT}}        - Domain for fronting (e.g., cloudflare.com)
{{TLS_CERT_PATH}}       - TLS certificate path
{{TLS_KEY_PATH}}        - TLS private key path
{{GENERATED_TIMESTAMP}} - ISO timestamp of generation
{{EXPIRE_TIMESTAMP}}    - ISO timestamp of expiration

Security variables:
-------------------
{{UUID_V2RAY}}          - V2Ray VMess UUID
{{PASSWORD_SHADOWSOCKS}} - Shadowsocks password
{{PRIVATE_KEY_WG}}      - WireGuard private key
{{PUBLIC_KEY_WG}}       - WireGuard public key
{{PASSWORD_TROJAN}}     - Trojan password

Performance variables:
----------------------
{{MTU_SIZE}}            - Maximum Transmission Unit (default: 1420)
{{WORKER_CONNECTIONS}}  - Nginx worker connections
{{KEEPALIVE_TIMEOUT}}   - Keepalive timeout in seconds
{{PROXY_BUFFER_SIZE}}   - Proxy buffer size

================================================================================
 TEMPLATE USAGE
================================================================================

1. Manual Generation:
   -------------------
   Use the generate-configs.js script:

   ```bash
   cd scripts
   node generate-configs.js --template v2ray --output /path/to/output.json
Automated Generation:

The templates are automatically processed during:

Server deployment (via server-setup.sh)

Configuration updates (cron job)

CI/CD pipeline runs

Variable Replacement:

Example template line:

json
"id": "{{SERVER_ID}}",
"host": "{{SERVER_HOSTNAME}}"
Becomes after processing:

json
"id": "server-ken-01",
"host": "server1.kenya.chaguo.tz"
================================================================================
SECURITY NOTES
================================================================================

⚠️ IMPORTANT SECURITY PRACTICES:

KEY ROTATION:

Rotate WireGuard keys every 30 days

Change V2Ray UUIDs weekly

Update passwords monthly

TEMPLATE VALIDATION:

All templates are validated for security

No hardcoded credentials in templates

Sensitive values are generated at runtime

ACCESS CONTROL:

Templates should be read-only for most users

Only config generator should write to output

Back up templates before modification

================================================================================
TEMPLATE MODIFICATION GUIDE
================================================================================

To modify a template:

BACKUP original template:

bash
cp v2ray-template.json v2ray-template.json.backup
EDIT the template:

bash
nano v2ray-template.json
VALIDATE syntax:

bash
node -c v2ray-template.json
TEST generation:

bash
node scripts/generate-configs.js --test --template v2ray
DEPLOY changes:

bash
git add configs/templates/v2ray-template.json
git commit -m "Update V2Ray template"
git push
Common modifications:

Change default ports

Add new protocol options

Update security settings

Adjust performance parameters

Add new domain fronting options

================================================================================
TROUBLESHOOTING
================================================================================

Common issues and solutions:

"Template not found" error:

Check template file exists

Verify file permissions (should be 644)

Ensure correct path in generator script

"Variable not replaced" issue:

Check variable name spelling

Verify variable is defined in generator

Check template syntax ({{VARIABLE}} not {VARIABLE})

"Invalid JSON" after generation:

Validate template JSON before generation

Check for missing commas or quotes

Ensure proper escaping of special characters

"Permission denied" when writing:

Check directory permissions

Ensure running with appropriate user

Verify disk space availability

================================================================================
BEST PRACTICES
================================================================================

VERSION CONTROL:

Keep templates in Git

Use descriptive commit messages

Tag template versions

DOCUMENTATION:

Document all template variables

Keep this README updated

Comment complex template logic

TESTING:

Test templates on staging servers first

Validate generated configurations

Monitor after deployment

BACKUP:

Regular backups of templates

Versioned backups of generated configs

Backup encryption keys separately

================================================================================
TEMPLATE EXAMPLES
================================================================================

Example: Simple V2Ray template

{
"inbounds": [{
"port": {{PORT_HTTPS}},
"protocol": "vmess",
"settings": {
"clients": [{
"id": "{{UUID_V2RAY}}",
"alterId": 0
}]
},
"streamSettings": {
"network": "ws",
"wsSettings": {
"path": "/{{WS_PATH}}"
}
}
}]
}

Example: Nginx template

server {
listen {{PORT_HTTPS}} ssl;
server_name {{SERVER_HOSTNAME}};

text
ssl_certificate {{TLS_CERT_PATH}};
ssl_certificate_key {{TLS_KEY_PATH}};

location / {
    proxy_pass http://localhost:8080;
}
}

================================================================================
CONTACT & SUPPORT
================================================================================

For template-related issues:

Check GitHub Issues: https://github.com/cephasgm/chaguo-tanzania/issues

Telegram Support: @chaguo_tz_bot

Email: templates@chaguo.tz

================================================================================
LICENSE
================================================================================

Templates are part of Chaguo Tanzania project.
Licensed under MIT License - see ../LICENSE

===============================================================================
LAST UPDATED: 2024-01-15
===============================================================================
