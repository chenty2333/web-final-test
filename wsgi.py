"""WSGI entry point for production servers."""

from campus_ledger import create_app


app = create_app()
