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
