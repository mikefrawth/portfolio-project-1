# ArchViz — CloudFormation Diagram Generator

A full-stack portfolio project that converts AWS CloudFormation templates into interactive architecture diagrams.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TypeScript, React, Vite, React Flow, Monaco Editor |
| Backend | Python, FastAPI, Mangum |
| Database | AWS DynamoDB |
| Infrastructure | AWS CDK (Python) |
| Hosting | S3 + CloudFront (frontend), Lambda + API Gateway (backend) |

## Architecture

```
Browser
  │
  └─► CloudFront (CDN)
          ├─► S3 (React frontend)
          └─► API Gateway (/api/*)
                    │
                    └─► Lambda (FastAPI)
                                │
                                └─► DynamoDB
```

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at http://localhost:5173

### Environment Variables

Backend (set in terminal or `.env`):
- `DIAGRAMS_TABLE_NAME` — DynamoDB table name (default: `archviz-diagrams`)
- `DYNAMODB_ENDPOINT` — Local DynamoDB endpoint for dev (e.g. `http://localhost:8000`)
- `CORS_ORIGINS` — Comma-separated allowed origins

Frontend:
- `VITE_API_URL` — Backend URL (leave empty in dev, Vite proxies to localhost:8000)

## Deployment

### Prerequisites
- AWS CLI configured (`aws configure`)
- Docker running (for Lambda container build)
- Node.js 18+ and Python 3.12+

### Steps

```bash
# 1. Build the frontend
cd frontend
npm install
npm run build

# 2. Bootstrap CDK (first time only per account/region)
cd ../infrastructure
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cdk bootstrap

# 3. Deploy
cdk deploy --context account=YOUR_ACCOUNT_ID

# 4. Note the CloudFront URL from the output, then redeploy with it
#    so CORS is locked down to your domain
cdk deploy --context account=YOUR_ACCOUNT_ID \
           --context frontend_url=https://XXXX.cloudfront.net
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/parse` | Parse CF template → nodes + edges |
| `POST` | `/api/v1/diagrams` | Save a diagram |
| `GET` | `/api/v1/diagrams` | List saved diagrams |
| `GET` | `/api/v1/diagrams/{id}` | Load a saved diagram |
| `DELETE` | `/api/v1/diagrams/{id}` | Delete a diagram |
| `GET` | `/health` | Health check |
