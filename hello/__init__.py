import random

from flask import Flask, render_template

PAGES = [
    "pages/page1.html",
    "pages/page2.html",
    "pages/page3.html",
    "pages/page4.html",
    "pages/page5.html",
]


def create_app():
    app = Flask(__name__)

    @app.route("/")
    def index():
        return render_template(random.choice(PAGES))

    return app
