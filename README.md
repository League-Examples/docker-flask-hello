# docker-flask-hello

A simple Flask application that displays a **random ASCII-art "Hello, World!" page** every time you reload it. Five distinct pages are included. It is managed with [uv](https://github.com/astral-sh/uv) and ships with a `Dockerfile` and `docker-compose.yml`.

## Running with Docker Compose

```bash
docker compose up --build
```

Then open <http://localhost:5000> in your browser and reload to see different pages.

## Running locally (with uv)

```bash
# Install dependencies
uv sync

# Development server
uv run flask --app hello run --debug
```

## Running tests

```bash
uv run pytest
```

## Project structure

```
.
├── hello/              # Flask application package
│   ├── __init__.py     # App factory + route
│   └── templates/
│       ├── base.html   # Shared HTML/CSS shell
│       └── pages/      # Five ASCII-art hello-world pages
├── tests/
│   └── test_hello.py
├── pyproject.toml      # Project metadata + dependencies (uv)
├── uv.lock
├── Dockerfile
└── docker-compose.yml
```
