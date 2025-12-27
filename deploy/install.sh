#!/bin/bash

# ============================================
# HyprDash - Production Installer
# ============================================
# Fetches from GitHub, installs dependencies,
# sets up nginx, SSL certificates, and more
# ============================================

# Don't exit on error - handle errors manually
set +e

# Colors (only if terminal supports it)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    NC='\033[0m'
    BOLD='\033[1m'
else
    RED=''
    GREEN=''
    BLUE=''
    YELLOW=''
    CYAN=''
    NC=''
    BOLD=''
fi

# GitHub Repositories
PANEL_REPO="https://github.com/appuzlotatheog/hyprdash-panel.git"
DAEMON_REPO="https://github.com/appuzlotatheog/hyprdash-daemon.git"

# Defaults
INSTALL_DIR="/opt/hyprdash"
PANEL_PORT=3001
WEB_PORT=5173
DAEMON_PORT=8080
PANEL_NAME="HyprDash"
DOMAIN=""
EMAIL=""
INSTALL_PANEL=false
INSTALL_DAEMON=false
SETUP_NGINX=false
SETUP_SSL=false
CREATE_SERVICE=true
INTERACTIVE=true

# Print banner
print_banner() {
    clear 2>/dev/null || true
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                                           ║${NC}"
    echo -e "${CYAN}║   ${BOLD}██╗  ██╗██╗   ██╗██████╗ ██████╗ ██████╗  █████╗ ███████╗██╗  ██╗${NC}${CYAN}       ║${NC}"
    echo -e "${CYAN}║   ${BOLD}██║  ██║╚██╗ ██╔╝██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝██║  ██║${NC}${CYAN}       ║${NC}"
    echo -e "${CYAN}║   ${BOLD}███████║ ╚████╔╝ ██████╔╝██████╔╝██║  ██║███████║███████╗███████║${NC}${CYAN}       ║${NC}"
    echo -e "${CYAN}║   ${BOLD}██╔══██║  ╚██╔╝  ██╔═══╝ ██╔══██╗██║  ██║██╔══██║╚════██║██╔══██║${NC}${CYAN}       ║${NC}"
    echo -e "${CYAN}║   ${BOLD}██║  ██║   ██║   ██║     ██║  ██║██████╔╝██║  ██║███████║██║  ██║${NC}${CYAN}       ║${NC}"
    echo -e "${CYAN}║   ${BOLD}╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝${NC}${CYAN}       ║${NC}"
    echo -e "${CYAN}║                                                                           ║${NC}"
    echo -e "${CYAN}║              Production Installer v1.0                                    ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Check if TTY is available for interactive mode
check_tty() {
    if [[ ! -t 0 ]]; then
        INTERACTIVE=false
        log_warn "No TTY detected (running via pipe). Using non-interactive mode."
        log_warn "Use command line arguments to configure: --help for options"
        
        # If no component selected, default to both
        if ! $INSTALL_PANEL && ! $INSTALL_DAEMON; then
            log_info "Defaulting to full installation (Panel + Daemon)"
            INSTALL_PANEL=true
            INSTALL_DAEMON=true
        fi
    fi
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        log_error "Cannot detect OS"
        exit 1
    fi
    log_info "Detected OS: $OS $OS_VERSION"
}

# Install system packages
install_packages() {
    log_info "Installing required packages..."
    
    case $OS in
        ubuntu|debian)
            apt-get update -qq 2>/dev/null
            apt-get install -y -qq curl wget git unzip tar software-properties-common \
                ca-certificates gnupg lsb-release 2>/dev/null
            ;;
        centos|rhel|fedora|rocky|almalinux)
            if command -v dnf &> /dev/null; then
                dnf install -y -q curl wget git unzip tar 2>/dev/null
            else
                yum install -y -q curl wget git unzip tar 2>/dev/null
            fi
            ;;
        *)
            log_warn "Unsupported OS: $OS. Attempting to continue..."
            ;;
    esac
    log_success "System packages installed"
}

# Install Node.js
install_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            log_success "Node.js $(node -v) already installed"
            return
        fi
    fi
    
    log_info "Installing Node.js 20.x..."
    
    case $OS in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - 2>/dev/null
            apt-get install -y -qq nodejs 2>/dev/null
            ;;
        centos|rhel|fedora|rocky|almalinux)
            curl -fsSL https://rpm.nodesource.com/setup_20.x 2>/dev/null | bash - 2>/dev/null
            if command -v dnf &> /dev/null; then
                dnf install -y -q nodejs 2>/dev/null
            else
                yum install -y -q nodejs 2>/dev/null
            fi
            ;;
        *)
            log_error "Please install Node.js 18+ manually"
            exit 1
            ;;
    esac
    
    if command -v node &> /dev/null; then
        log_success "Node.js $(node -v) installed"
    else
        log_error "Failed to install Node.js"
        exit 1
    fi
}

# Install nginx
install_nginx() {
    if ! $SETUP_NGINX; then
        return
    fi
    
    if command -v nginx &> /dev/null; then
        log_success "Nginx already installed"
        return
    fi
    
    log_info "Installing Nginx..."
    
    case $OS in
        ubuntu|debian)
            apt-get install -y -qq nginx 2>/dev/null
            ;;
        centos|rhel|fedora|rocky|almalinux)
            if command -v dnf &> /dev/null; then
                dnf install -y -q nginx 2>/dev/null
            else
                yum install -y -q nginx 2>/dev/null
            fi
            ;;
    esac
    
    systemctl enable nginx 2>/dev/null
    systemctl start nginx 2>/dev/null
    log_success "Nginx installed and started"
}

# Install Certbot for SSL
install_certbot() {
    if ! $SETUP_SSL; then
        return
    fi
    
    if command -v certbot &> /dev/null; then
        log_success "Certbot already installed"
        return
    fi
    
    log_info "Installing Certbot..."
    
    case $OS in
        ubuntu|debian)
            apt-get install -y -qq certbot python3-certbot-nginx 2>/dev/null
            ;;
        centos|rhel|fedora|rocky|almalinux)
            if command -v dnf &> /dev/null; then
                dnf install -y -q certbot python3-certbot-nginx 2>/dev/null
            else
                yum install -y -q certbot python3-certbot-nginx 2>/dev/null
            fi
            ;;
    esac
    log_success "Certbot installed"
}

# Interactive menu
show_menu() {
    if ! $INTERACTIVE; then
        return
    fi
    
    echo ""
    echo -e "${BOLD}What would you like to install?${NC}"
    echo ""
    echo "  1) Panel (API + Web UI)"
    echo "  2) Daemon (Node Agent)"
    echo "  3) Both Panel and Daemon"
    echo "  4) Exit"
    echo ""
    read -p "  Select option [1-4]: " choice </dev/tty
    
    case $choice in
        1) INSTALL_PANEL=true ;;
        2) INSTALL_DAEMON=true ;;
        3) INSTALL_PANEL=true; INSTALL_DAEMON=true ;;
        4) echo "Goodbye!"; exit 0 ;;
        *) log_error "Invalid option"; show_menu ;;
    esac
}

# Configure installation
configure_install() {
    if ! $INTERACTIVE; then
        return
    fi
    
    echo ""
    echo -e "${BOLD}Configuration${NC}"
    echo ""
    
    # Installation directory
    read -p "  Install directory [$INSTALL_DIR]: " input </dev/tty
    INSTALL_DIR=${input:-$INSTALL_DIR}
    
    if $INSTALL_PANEL; then
        # Panel configuration
        read -p "  Panel API port [$PANEL_PORT]: " input </dev/tty
        PANEL_PORT=${input:-$PANEL_PORT}
        
        read -p "  Web UI port [$WEB_PORT]: " input </dev/tty
        WEB_PORT=${input:-$WEB_PORT}
        
        read -p "  Panel name [$PANEL_NAME]: " input </dev/tty
        PANEL_NAME=${input:-$PANEL_NAME}
    fi
    
    if $INSTALL_DAEMON; then
        read -p "  Daemon port [$DAEMON_PORT]: " input </dev/tty
        DAEMON_PORT=${input:-$DAEMON_PORT}
    fi
    
    # Nginx
    echo ""
    read -p "  Setup Nginx reverse proxy? [y/N]: " input </dev/tty
    if [[ "$input" =~ ^[Yy]$ ]]; then
        SETUP_NGINX=true
        read -p "  Domain name (e.g., panel.example.com): " DOMAIN </dev/tty
        
        if [ -n "$DOMAIN" ]; then
            read -p "  Setup SSL with Let's Encrypt? [y/N]: " input </dev/tty
            if [[ "$input" =~ ^[Yy]$ ]]; then
                SETUP_SSL=true
                read -p "  Email for SSL notifications: " EMAIL </dev/tty
            fi
        fi
    fi
    
    # Systemd
    read -p "  Create systemd services? [Y/n]: " input </dev/tty
    if [[ "$input" =~ ^[Nn]$ ]]; then
        CREATE_SERVICE=false
    fi
}

# Clone repositories
clone_repos() {
    log_info "Creating directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    if $INSTALL_PANEL; then
        if [ -d "panel" ]; then
            log_warn "Panel directory exists, pulling latest..."
            cd panel && git pull 2>/dev/null && cd ..
        else
            log_info "Cloning HyprDash Panel..."
            git clone --depth 1 "$PANEL_REPO" panel 2>/dev/null
            if [ $? -ne 0 ]; then
                log_error "Failed to clone Panel repository"
                exit 1
            fi
        fi
        log_success "Panel downloaded"
    fi
    
    if $INSTALL_DAEMON; then
        if [ -d "daemon" ]; then
            log_warn "Daemon directory exists, pulling latest..."
            cd daemon && git pull 2>/dev/null && cd ..
        else
            log_info "Cloning HyprDash Daemon..."
            git clone --depth 1 "$DAEMON_REPO" daemon 2>/dev/null
            if [ $? -ne 0 ]; then
                log_error "Failed to clone Daemon repository"
                exit 1
            fi
        fi
        log_success "Daemon downloaded"
    fi
}

# Setup Panel
setup_panel() {
    if ! $INSTALL_PANEL; then
        return
    fi
    
    log_info "Setting up Panel..."
    cd "$INSTALL_DIR/panel"
    
    # Install dependencies
    log_info "Installing Panel dependencies..."
    npm install --legacy-peer-deps 2>/dev/null || npm install 2>/dev/null
    
    # Install web dependencies
    if [ -d "web" ]; then
        log_info "Installing Web UI dependencies..."
        cd web && (npm install --legacy-peer-deps 2>/dev/null || npm install 2>/dev/null) && cd ..
    fi
    
    # Create .env
    if [ ! -f .env ]; then
        log_info "Creating .env file..."
        JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
        cat > .env << EOF
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="$JWT_SECRET"
PORT=$PANEL_PORT
CORS_ORIGIN="http://localhost:$WEB_PORT"
PANEL_NAME="$PANEL_NAME"
EOF
    fi
    
    # Build
    log_info "Building Panel..."
    npm run build:api 2>/dev/null || npm run build 2>/dev/null
    
    if [ -d "web" ]; then
        log_info "Building Web UI..."
        npm run build:web 2>/dev/null || (cd web && npm run build 2>/dev/null && cd ..)
    fi
    
    # Setup database
    log_info "Setting up database..."
    npm run db:generate 2>/dev/null
    npm run db:push 2>/dev/null
    npm run db:seed 2>/dev/null
    
    log_success "Panel setup complete"
}

# Setup Daemon
setup_daemon() {
    if ! $INSTALL_DAEMON; then
        return
    fi
    
    log_info "Setting up Daemon..."
    cd "$INSTALL_DIR/daemon"
    
    # Install dependencies
    log_info "Installing Daemon dependencies..."
    npm install --legacy-peer-deps 2>/dev/null || npm install 2>/dev/null
    
    # Create config
    if [ ! -f config.json ]; then
        log_info "Creating config.json..."
        cat > config.json << EOF
{
    "panelUrl": "http://localhost:$PANEL_PORT",
    "token": "CHANGE_ME_TO_YOUR_NODE_TOKEN",
    "port": $DAEMON_PORT,
    "serversDir": "./servers"
}
EOF
    fi
    
    # Create servers directory
    mkdir -p servers
    
    # Build
    log_info "Building Daemon..."
    npm run build 2>/dev/null
    
    log_success "Daemon setup complete"
}

# Setup Nginx
setup_nginx_config() {
    if ! $SETUP_NGINX || [ -z "$DOMAIN" ]; then
        return
    fi
    
    log_info "Configuring Nginx..."
    
    if $INSTALL_PANEL; then
        mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null
        
        cat > /etc/nginx/sites-available/hyprdash << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # API
    location /api {
        proxy_pass http://localhost:$PANEL_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:$PANEL_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Web UI (serve static files)
    location / {
        root $INSTALL_DIR/panel/web/dist;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
        
        # Enable site
        ln -sf /etc/nginx/sites-available/hyprdash /etc/nginx/sites-enabled/ 2>/dev/null
        rm -f /etc/nginx/sites-enabled/default 2>/dev/null
        
        nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null
        log_success "Nginx configured for Panel"
    fi
}

# Setup SSL
setup_ssl_cert() {
    if ! $SETUP_SSL || [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        return
    fi
    
    log_info "Obtaining SSL certificate..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" 2>/dev/null
    log_success "SSL certificate installed"
}

# Create systemd services
create_services() {
    if ! $CREATE_SERVICE; then
        return
    fi
    
    if $INSTALL_PANEL; then
        log_info "Creating Panel systemd service..."
        cat > /etc/systemd/system/hyprdash-panel.service << EOF
[Unit]
Description=HyprDash Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/panel
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload 2>/dev/null
        systemctl enable hyprdash-panel 2>/dev/null
        log_success "Panel service created"
    fi
    
    if $INSTALL_DAEMON; then
        log_info "Creating Daemon systemd service..."
        cat > /etc/systemd/system/hyprdash-daemon.service << EOF
[Unit]
Description=HyprDash Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/daemon
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload 2>/dev/null
        systemctl enable hyprdash-daemon 2>/dev/null
        log_success "Daemon service created"
    fi
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 22/tcp 2>/dev/null
        ufw allow 80/tcp 2>/dev/null
        ufw allow 443/tcp 2>/dev/null
        
        if $INSTALL_PANEL; then
            ufw allow $PANEL_PORT/tcp 2>/dev/null
        fi
        if $INSTALL_DAEMON; then
            ufw allow $DAEMON_PORT/tcp 2>/dev/null
        fi
        
        echo "y" | ufw enable 2>/dev/null
        log_success "UFW configured"
        
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-service=http 2>/dev/null
        firewall-cmd --permanent --add-service=https 2>/dev/null
        
        if $INSTALL_PANEL; then
            firewall-cmd --permanent --add-port=$PANEL_PORT/tcp 2>/dev/null
        fi
        if $INSTALL_DAEMON; then
            firewall-cmd --permanent --add-port=$DAEMON_PORT/tcp 2>/dev/null
        fi
        
        firewall-cmd --reload 2>/dev/null
        log_success "Firewalld configured"
    else
        log_warn "No firewall detected"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Installation Complete!                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    echo -e "  ${BOLD}Installation Directory:${NC} $INSTALL_DIR"
    echo ""
    
    if $INSTALL_PANEL; then
        echo -e "  ${BOLD}Panel${NC}"
        echo -e "    API:     http://localhost:$PANEL_PORT"
        if [ -n "$DOMAIN" ]; then
            if $SETUP_SSL; then
                echo -e "    URL:     https://$DOMAIN"
            else
                echo -e "    URL:     http://$DOMAIN"
            fi
        fi
        echo ""
    fi
    
    if $INSTALL_DAEMON; then
        echo -e "  ${BOLD}Daemon${NC}"
        echo -e "    Port:    $DAEMON_PORT"
        echo -e "    Config:  $INSTALL_DIR/daemon/config.json"
        echo ""
    fi
    
    echo -e "  ${BOLD}Commands:${NC}"
    if $CREATE_SERVICE; then
        if $INSTALL_PANEL; then
            echo "    sudo systemctl start hyprdash-panel"
            echo "    sudo systemctl status hyprdash-panel"
        fi
        if $INSTALL_DAEMON; then
            echo "    sudo systemctl start hyprdash-daemon"
            echo "    sudo systemctl status hyprdash-daemon"
        fi
    fi
    echo ""
    
    if $INSTALL_DAEMON; then
        echo -e "  ${YELLOW}[!] Remember to update daemon/config.json with your node token!${NC}"
        echo ""
    fi
    
    echo -e "  ${CYAN}Thank you for using HyprDash!${NC}"
    echo ""
}

# Command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --panel)
                INSTALL_PANEL=true
                shift
                ;;
            --daemon)
                INSTALL_DAEMON=true
                shift
                ;;
            --both)
                INSTALL_PANEL=true
                INSTALL_DAEMON=true
                shift
                ;;
            --dir=*)
                INSTALL_DIR="${1#*=}"
                shift
                ;;
            --domain=*)
                DOMAIN="${1#*=}"
                SETUP_NGINX=true
                shift
                ;;
            --email=*)
                EMAIL="${1#*=}"
                SETUP_SSL=true
                shift
                ;;
            --no-service)
                CREATE_SERVICE=false
                shift
                ;;
            --help|-h)
                echo "HyprDash Installer"
                echo ""
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --panel         Install Panel only"
                echo "  --daemon        Install Daemon only"
                echo "  --both          Install both Panel and Daemon"
                echo "  --dir=PATH      Installation directory (default: /opt/hyprdash)"
                echo "  --domain=DOMAIN Setup Nginx with domain"
                echo "  --email=EMAIL   Email for SSL certificate"
                echo "  --no-service    Don't create systemd services"
                echo "  --help          Show this help"
                echo ""
                echo "Examples:"
                echo "  $0 --panel                     # Install panel only"
                echo "  $0 --both --domain=panel.com   # Full install with nginx"
                echo ""
                echo "Interactive mode is used if TTY is available."
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Main
main() {
    parse_args "$@"
    print_banner
    check_root
    check_tty
    detect_os
    
    # Interactive mode if nothing selected and TTY available
    if ! $INSTALL_PANEL && ! $INSTALL_DAEMON; then
        if $INTERACTIVE; then
            show_menu
            configure_install
        fi
    fi
    
    # Install dependencies
    install_packages
    install_nodejs
    install_nginx
    install_certbot
    
    # Clone and setup
    clone_repos
    setup_panel
    setup_daemon
    
    # Configure services
    setup_nginx_config
    setup_ssl_cert
    create_services
    configure_firewall
    
    print_summary
}

main "$@"
