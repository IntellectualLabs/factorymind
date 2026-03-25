.PHONY: dev dev-backend dev-frontend build clean install seed setup

setup: install seed

install:
	pnpm install

seed:
	./scripts/seed.sh

dev:
	@echo "Starting backend and frontend..."
	@cd packages/backend && node ../../node_modules/tsx/dist/cli.mjs src/index.ts &
	@sleep 2
	@cd packages/frontend && node ../../node_modules/vite/bin/vite.js
	@echo "Backend: http://localhost:3001  Frontend: http://localhost:5173"

dev-backend:
	cd packages/backend && node ../../node_modules/tsx/dist/cli.mjs watch src/index.ts

dev-frontend:
	cd packages/frontend && node ../../node_modules/vite/bin/vite.js

build:
	pnpm build

clean:
	pnpm clean
