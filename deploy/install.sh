#!/bin/bash

# ============================================
# HyprDash - Interactive Installer
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Defaults
PANEL_PORT=3001
WEB_PORT=5173
DAEMON_PORT=8080
PANEL_NAME="HyprDash"
INSTALL_PANEL=true
INSTALL_DAEMON=true
INSTALL_WEB=true

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                                           ║"
    echo "║     ${BOLD}██╗  ██╗██╗   ██╗██████╗ ██████╗ ██████╗  █████╗ ███████╗██╗  ██╗${NC}${CYAN}  ║"
    echo "║     ${BOLD}██║  ██║╚██╗ ██╔╝██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝██║  ██║${NC}${CYAN}  ║"
    echo "║     ${BOLD}███████║ ╚████╔╝ ██████╔╝██████╔╝██║  ██║███████║███████╗███████║${NC}${CYAN}  ║"
    echo "║     ${BOLD}██╔══██║  ╚██╔╝  ██╔═══╝ ██╔══██╗██║  ██║██╔══██║╚════██║██╔══██║${NC}${CYAN}  ║"
    echo "║     ${BOLD}██║  ██║   ██║   ██║     ██║  ██║██████╔╝██║  ██║███████║██║  ██║${NC}${CYAN}  ║"
    echo "║     ${BOLD}╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝${NC}${CYAN}  ║"
    echo "║                                                                                           ║"
    echo "║              Game Server Management Panel                                                 ║"
    echo "╚═══════════════════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}[1/7] Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js is not installed${NC}"
        echo -e "${YELLOW}  Please install Node.js 18+ first: https://nodejs.org${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}✗ Node.js version must be 18 or higher (found: $(node -v))${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}✗ npm is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ npm $(npm -v)${NC}"
}

# Interactive component selection
select_components() {
    echo ""
    echo -e "${BLUE}[2/7] Select components to install:${NC}"
    echo ""
    echo "  1) Panel + Web UI (Web interface & API)"
    echo "  2) Daemon only (Node agent for running servers)"
    echo "  3) Both (Full installation)"
    echo ""
    read -p "  Enter choice [1-3] (default: 3): " choice
    
    case $choice in
        1)
            INSTALL_PANEL=true
            INSTALL_WEB=true
            INSTALL_DAEMON=false
            echo -e "${GREEN}  ✓ Installing: Panel + Web UI${NC}"
            ;;
        2)
            INSTALL_PANEL=false
            INSTALL_WEB=false
            INSTALL_DAEMON=true
            echo -e "${GREEN}  ✓ Installing: Daemon only${NC}"
            ;;
        3|"")
            INSTALL_PANEL=true
            INSTALL_WEB=true
            INSTALL_DAEMON=true
            echo -e "${GREEN}  ✓ Installing: Full installation${NC}"
            ;;
        *)
            echo -e "${YELLOW}  Invalid choice, defaulting to full installation${NC}"
            ;;
    esac
}

# Configure ports
configure_ports() {
    echo ""
    echo -e "${BLUE}[3/7] Configure ports:${NC}"
    echo ""
    
    if [ "$INSTALL_PANEL" = true ]; then
        read -p "  Panel API port (default: $PANEL_PORT): " input_panel_port
        PANEL_PORT=${input_panel_port:-$PANEL_PORT}
        echo -e "${GREEN}  ✓ Panel API: $PANEL_PORT${NC}"
        
        read -p "  Web UI port (default: $WEB_PORT): " input_web_port
        WEB_PORT=${input_web_port:-$WEB_PORT}
        echo -e "${GREEN}  ✓ Web UI: $WEB_PORT${NC}"
    fi
    
    if [ "$INSTALL_DAEMON" = true ]; then
        read -p "  Daemon port (default: $DAEMON_PORT): " input_daemon_port
        DAEMON_PORT=${input_daemon_port:-$DAEMON_PORT}
        echo -e "${GREEN}  ✓ Daemon: $DAEMON_PORT${NC}"
    fi
}

# Configure panel name
configure_panel_name() {
    if [ "$INSTALL_PANEL" = true ]; then
        echo ""
        echo -e "${BLUE}[4/7] Configure panel branding:${NC}"
        echo ""
        read -p "  Panel name (default: $PANEL_NAME): " input_name
        PANEL_NAME=${input_name:-$PANEL_NAME}
        echo -e "${GREEN}  ✓ Panel name: $PANEL_NAME${NC}"
    fi
}

# Configure firewall
configure_firewall() {
    echo ""
    echo -e "${BLUE}[5/7] Firewall configuration:${NC}"
    echo ""
    
    # Detect firewall
    FIREWALL=""
    if command -v ufw &> /dev/null; then
        FIREWALL="ufw"
    elif command -v firewall-cmd &> /dev/null; then
        FIREWALL="firewalld"
    fi
    
    if [ -z "$FIREWALL" ]; then
        echo -e "${YELLOW}  No firewall detected (ufw/firewalld). Skipping...${NC}"
        return
    fi
    
    echo "  Detected: $FIREWALL"
    read -p "  Open required ports in firewall? [y/N]: " open_fw
    
    if [[ "$open_fw" =~ ^[Yy]$ ]]; then
        if [ "$FIREWALL" = "ufw" ]; then
            if [ "$INSTALL_PANEL" = true ]; then
                sudo ufw allow $PANEL_PORT/tcp comment "HyprDash Panel API"
                sudo ufw allow $WEB_PORT/tcp comment "HyprDash Web UI"
                echo -e "${GREEN}  ✓ Opened ports $PANEL_PORT, $WEB_PORT${NC}"
            fi
            if [ "$INSTALL_DAEMON" = true ]; then
                sudo ufw allow $DAEMON_PORT/tcp comment "HyprDash Daemon"
                echo -e "${GREEN}  ✓ Opened port $DAEMON_PORT${NC}"
            fi
        elif [ "$FIREWALL" = "firewalld" ]; then
            if [ "$INSTALL_PANEL" = true ]; then
                sudo firewall-cmd --permanent --add-port=$PANEL_PORT/tcp
                sudo firewall-cmd --permanent --add-port=$WEB_PORT/tcp
                echo -e "${GREEN}  ✓ Opened ports $PANEL_PORT, $WEB_PORT${NC}"
            fi
            if [ "$INSTALL_DAEMON" = true ]; then
                sudo firewall-cmd --permanent --add-port=$DAEMON_PORT/tcp
                echo -e "${GREEN}  ✓ Opened port $DAEMON_PORT${NC}"
            fi
            sudo firewall-cmd --reload
        fi
    else
        echo -e "${YELLOW}  Skipping firewall configuration${NC}"
    fi
}

# Install dependencies
install_dependencies() {
    echo ""
    echo -e "${BLUE}[6/7] Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Build and configure
build_and_configure() {
    echo ""
    echo -e "${BLUE}[7/7] Building and configuring...${NC}"
    
    # Generate Panel .env
    if [ "$INSTALL_PANEL" = true ]; then
        PANEL_ENV="packages/panel/.env"
        if [ ! -f "$PANEL_ENV" ]; then
            echo -e "${CYAN}  Creating Panel .env...${NC}"
            cat > "$PANEL_ENV" << EOF
# Database
DATABASE_URL="file:./dev.db"

# JWT Secret (auto-generated)
JWT_SECRET="$(openssl rand -hex 32)"

# Server Port
PORT=$PANEL_PORT

# Panel Name
PANEL_NAME="$PANEL_NAME"
EOF
            echo -e "${GREEN}  ✓ Created $PANEL_ENV${NC}"
        else
            echo -e "${YELLOW}  $PANEL_ENV already exists, skipping...${NC}"
        fi
    fi
    
    # Generate Daemon config
    if [ "$INSTALL_DAEMON" = true ]; then
        DAEMON_CONFIG="packages/daemon/config.json"
        if [ ! -f "$DAEMON_CONFIG" ]; then
            echo -e "${CYAN}  Creating Daemon config...${NC}"
            cat > "$DAEMON_CONFIG" << EOF
{
    "panelUrl": "http://localhost:$PANEL_PORT",
    "token": "CHANGE_ME_TO_NODE_TOKEN",
    "port": $DAEMON_PORT,
    "serversDir": "./servers"
}
EOF
            echo -e "${GREEN}  ✓ Created $DAEMON_CONFIG${NC}"
        else
            echo -e "${YELLOW}  $DAEMON_CONFIG already exists, skipping...${NC}"
        fi
    fi
    
    # Build selected components
    if [ "$INSTALL_PANEL" = true ]; then
        echo -e "${CYAN}  Building Panel...${NC}"
        npm run build --workspace=@game-panel/panel
        echo -e "${GREEN}  ✓ Panel built${NC}"
    fi
    
    if [ "$INSTALL_DAEMON" = true ]; then
        echo -e "${CYAN}  Building Daemon...${NC}"
        npm run build --workspace=@game-panel/daemon
        echo -e "${GREEN}  ✓ Daemon built${NC}"
    fi
    
    if [ "$INSTALL_WEB" = true ]; then
        echo -e "${CYAN}  Building Web UI...${NC}"
        npm run build --workspace=@game-panel/web
        echo -e "${GREEN}  ✓ Web UI built${NC}"
    fi
    
    # Setup database
    if [ "$INSTALL_PANEL" = true ]; then
        echo -e "${CYAN}  Setting up database...${NC}"
        npm run db:generate
        npm run db:push
        npm run db:seed
        echo -e "${GREEN}  ✓ Database ready${NC}"
    fi
}

# Print summary
print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  Installation Complete!                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ "$INSTALL_PANEL" = true ]; then
        echo -e "  ${BOLD}Panel API:${NC}   http://localhost:$PANEL_PORT"
        echo -e "  ${BOLD}Web UI:${NC}      http://localhost:$WEB_PORT"
        echo -e "  ${BOLD}Panel Name:${NC}  $PANEL_NAME"
        echo ""
    fi
    
    if [ "$INSTALL_DAEMON" = true ]; then
        echo -e "  ${BOLD}Daemon:${NC}      http://localhost:$DAEMON_PORT"
        echo ""
    fi
    
    echo -e "  ${BOLD}Next Steps:${NC}"
    echo ""
    
    if [ "$INSTALL_PANEL" = true ]; then
        echo "  1. Edit packages/panel/.env with your database credentials"
        echo "  2. Start the panel: npm run start:panel"
    fi
    
    if [ "$INSTALL_DAEMON" = true ]; then
        echo "  3. Edit packages/daemon/config.json with the node token from the panel"
        echo "  4. Start the daemon: npm run start:daemon"
    fi
    
    echo ""
    echo -e "  ${CYAN}For development mode: npm run dev${NC}"
    echo ""
}

# Main
main() {
    print_banner
    check_prerequisites
    select_components
    configure_ports
    configure_panel_name
    configure_firewall
    install_dependencies
    build_and_configure
    print_summary
}

main
