.PHONY: dev docker-up docker-down docker-logs help

help:
	@echo "Available targets:"
	@echo "  dev              - Run Flask development server"
	@echo "  docker-up        - Start Docker containers"
	@echo "  docker-down      - Stop Docker containers"
	@echo "  docker-logs      - View Docker container logs"

dev:
	uv run flask --app hello run --debug

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f
