# List available recipes
default:
    @just --list

# Run Flask development server
dev:
    uv run flask --app hello run --debug --port 5010

# Start Docker containers
docker-up:
    docker-compose up -d

# Stop Docker containers
docker-down:
    docker-compose down

# View Docker container logs
docker-logs:
    docker-compose logs -f
