# DocDiff Frontend (Dark Mode + Modals)

## Quick Start
```bash
# Extract
unzip docdiff-frontend-dark-modal.zip && cd docdiff-frontend

# Configure backend URL
cp .env.example .env
# edit .env if needed (VITE_API_BASE)

# Install & run
npm install
npm run dev
```

Open http://localhost:5173

## Build
```bash
npm run build
npm run preview
```

## Docker
```bash
docker build -t docdiff-frontend .
docker run -p 8081:80 docdiff-frontend
```
