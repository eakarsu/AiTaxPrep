#!/bin/bash

# AI Tax Prep Assistant - Startup Script
# This script sets up and starts the complete application

# Removed set -e to allow script to continue on non-critical errors

echo "=========================================="
echo "  AI Tax Prep Assistant - Setup & Start  "
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PostgreSQL is running
check_postgres() {
    print_status "Checking PostgreSQL connection..."
    if command -v pg_isready &> /dev/null; then
        if pg_isready -h localhost -p 5432 &> /dev/null; then
            print_success "PostgreSQL is running"
            return 0
        fi
    fi

    # Try to connect using psql
    if command -v psql &> /dev/null; then
        if psql -h localhost -p 5432 -U postgres -c '\q' 2>/dev/null; then
            print_success "PostgreSQL is running"
            return 0
        fi
    fi

    print_error "PostgreSQL is not running or not accessible"
    echo ""
    echo "Please start PostgreSQL and try again."
    echo "On macOS: brew services start postgresql"
    echo "On Ubuntu: sudo service postgresql start"
    echo ""
    return 1
}

# Create database if it doesn't exist
setup_database() {
    print_status "Setting up database..."

    # Source environment variables
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi

    DB_NAME=${DB_NAME:-ai_tax_prep}
    DB_USER=${DB_USER:-postgres}

    # Check if database exists
    if psql -h localhost -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
        print_status "Database '$DB_NAME' already exists"
    else
        print_status "Creating database '$DB_NAME'..."
        createdb -h localhost -U $DB_USER $DB_NAME 2>/dev/null || {
            psql -h localhost -U $DB_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || {
                print_warning "Could not create database. It may already exist or require different credentials."
            }
        }
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing server dependencies..."
    npm install

    print_status "Installing client dependencies..."
    cd client && npm install && cd ..

    print_success "All dependencies installed"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    if npm run db:migrate; then
        print_success "Migrations completed"
    else
        print_warning "Migrations had some issues. Continuing..."
    fi
}

# Seed the database
seed_database() {
    print_status "Seeding database with sample data..."
    if npm run db:seed; then
        print_success "Database seeded with 15+ items per table"
    else
        print_warning "Seeding had some issues (data may already exist). Continuing..."
    fi
}

# Clear used ports
clear_ports() {
    print_status "Clearing ports 3000 and 5001..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    lsof -ti:5001 | xargs kill -9 2>/dev/null || true
    pkill -f nodemon 2>/dev/null || true
    pkill -f "react-scripts" 2>/dev/null || true
    sleep 2
    print_success "Ports cleared"
}

# Start the application
start_app() {
    clear_ports
    print_status "Starting the application..."
    echo ""
    echo "=========================================="
    echo "  Application Starting...                "
    echo "=========================================="
    echo ""
    echo "  Backend API:  http://localhost:5001/api"
    echo "  Frontend:     http://localhost:3000"
    echo ""
    echo "  Demo Login Credentials:"
    echo "  Email:    john.doe@email.com"
    echo "  Password: password123"
    echo ""
    echo "=========================================="
    echo ""

    npm run dev
}

# Main execution
main() {
    echo ""

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16+ is required. Current version: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v) detected"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    print_success "npm $(npm -v) detected"

    # Check PostgreSQL
    check_postgres || exit 1

    # Setup database
    setup_database

    # Install dependencies
    install_dependencies

    # Run migrations
    run_migrations

    # Seed database
    seed_database

    echo ""
    print_success "Setup completed successfully!"
    echo ""

    # Start application
    start_app
}

# Handle script arguments
case "$1" in
    --no-seed)
        # Skip seeding (for subsequent runs)
        check_postgres || exit 1
        start_app
        ;;
    --seed-only)
        # Only run seeding
        check_postgres || exit 1
        seed_database
        ;;
    --reset)
        # Reset and reseed database
        check_postgres || exit 1
        print_status "Resetting database..."
        npm run db:reset
        run_migrations
        seed_database
        print_success "Database reset and reseeded"
        ;;
    --help|-h)
        echo "Usage: ./start.sh [option]"
        echo ""
        echo "Options:"
        echo "  (none)      Full setup: install deps, migrate, seed, and start"
        echo "  --no-seed   Start without re-seeding the database"
        echo "  --seed-only Only seed the database (don't start app)"
        echo "  --reset     Reset database and reseed"
        echo "  --help      Show this help message"
        echo ""
        ;;
    *)
        main
        ;;
esac
