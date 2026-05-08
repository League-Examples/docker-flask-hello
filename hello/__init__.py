import random

from flask import Flask, render_template

PAGES = [
    "pages/page1.html",
    "pages/page2.html",
    "pages/page3.html",
    "pages/page4.html",
    "pages/page5.html",
    "pages/boids.html",
    "pages/voronoi.html",
    "pages/aurora.html",
]


def create_app():
    app = Flask(__name__)

    @app.route("/")
    def index():
        return render_template(random.choice(PAGES))

    @app.route("/boids")
    def boids():
        return render_template("pages/boids.html")

    @app.route("/voronoi")
    def voronoi():
        return render_template("pages/voronoi.html")

    @app.route("/aurora")
    def aurora():
        return render_template("pages/aurora.html")

    return app
