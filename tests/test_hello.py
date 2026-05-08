import pytest

from hello import create_app, PAGES


@pytest.fixture()
def app():
    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture()
def client(app):
    return app.test_client()


def test_index_returns_200(client):
    """The root URL should always respond with HTTP 200."""
    response = client.get("/")
    assert response.status_code == 200


def test_index_returns_html(client):
    """The response should be HTML."""
    response = client.get("/")
    assert b"<!doctype html>" in response.data.lower()


def test_index_contains_hello(client):
    """Every page should contain the word 'Hello'."""
    response = client.get("/")
    assert b"Hello" in response.data


def test_index_contains_reload_hint(client):
    """Every page should include the reload hint."""
    response = client.get("/")
    assert b"Reload" in response.data


def test_multiple_loads_use_all_pages(app):
    """
    Given enough reloads, every page should eventually be served.
    This uses monkeypatching to deterministically exercise all pages.
    """
    import unittest.mock as mock

    client = app.test_client()
    seen_pages = set()

    for page in PAGES:
        with mock.patch("hello.random.choice", return_value=page):
            response = client.get("/")
            assert response.status_code == 200
            seen_pages.add(page)

    assert seen_pages == set(PAGES), "Not all pages were served"


def test_unknown_route_returns_404(client):
    """Unknown paths should return 404."""
    response = client.get("/unknown")
    assert response.status_code == 404


# --- Requirement 9: Dedicated routes for canvas pages ---

def test_boids_route_returns_200(client):
    """GET /boids should return HTTP 200."""
    response = client.get("/boids")
    assert response.status_code == 200


def test_voronoi_route_returns_200(client):
    """GET /voronoi should return HTTP 200."""
    response = client.get("/voronoi")
    assert response.status_code == 200


def test_aurora_route_returns_200(client):
    """GET /aurora should return HTTP 200."""
    response = client.get("/aurora")
    assert response.status_code == 200


def test_boids_route_contains_data_page_marker(client):
    """The /boids response body must contain the data-page="boids" marker (Req 9.1)."""
    response = client.get("/boids")
    assert b'data-page="boids"' in response.data


def test_voronoi_route_contains_data_page_marker(client):
    """The /voronoi response body must contain the data-page="voronoi" marker (Req 9.2)."""
    response = client.get("/voronoi")
    assert b'data-page="voronoi"' in response.data


def test_aurora_route_contains_data_page_marker(client):
    """The /aurora response body must contain the data-page="aurora" marker (Req 9.3)."""
    response = client.get("/aurora")
    assert b'data-page="aurora"' in response.data


# --- Requirement 1.1: PAGES list integrity ---

def test_pages_has_exactly_8_entries():
    """PAGES must contain exactly 8 entries (5 ASCII + 3 canvas pages) (Req 1.1)."""
    assert len(PAGES) == 8


def test_pages_includes_boids():
    """PAGES must include the boids canvas page path (Req 1.1)."""
    assert "pages/boids.html" in PAGES


def test_pages_includes_voronoi():
    """PAGES must include the voronoi canvas page path (Req 1.1)."""
    assert "pages/voronoi.html" in PAGES


def test_pages_includes_aurora():
    """PAGES must include the aurora canvas page path (Req 1.1)."""
    assert "pages/aurora.html" in PAGES
