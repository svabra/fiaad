.PHONY: dev down test test-python test-frontend build

dev:
	docker compose up --build

down:
	docker compose down

test: test-python test-frontend

test-python:
	python -m pytest

test-frontend:
	npm --prefix apps/frontend test -- --watch=false

build:
	npm --prefix apps/frontend run build
	docker compose build

