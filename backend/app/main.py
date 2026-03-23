"""
FastAPI Application Entry Point
================================
This is the root of the backend. It:
  1. Creates the FastAPI app instance
  2. Configures CORS (so the frontend can talk to the API)
  3. Mounts the route handlers from routes/diagrams.py
  4. Wraps the app with Mangum so AWS Lambda can invoke it

When running locally:
  uvicorn app.main:app --reload --port 8000

When running in AWS Lambda:
  Lambda calls the `handler` function at the bottom of this file.
  Mangum translates the Lambda event into a standard ASGI request
  that FastAPI understands — we don't have to change any route code.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.routes.diagrams import router as diagrams_router

# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ArchViz API",
    description="Parses CloudFormation templates and returns graph data for visualization.",
    version="1.0.0",
    # These docs are auto-generated from our Pydantic models and route decorators.
    # Visit http://localhost:8000/docs when running locally.
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS (Cross-Origin Resource Sharing)
# ---------------------------------------------------------------------------
# Browsers enforce the Same-Origin Policy: a web page can only make API
# calls to the same domain it was served from. Since our frontend (e.g.
# localhost:5173) is a different origin than our API (localhost:8000),
# we need to explicitly allow cross-origin requests.
#
# CORS_ORIGINS is set as an environment variable:
#   - Locally: "http://localhost:5173" (Vite dev server)
#   - In AWS:  the CloudFront distribution URL
#
# We never use "*" (allow all) in production — that would allow any
# website to call our API.

raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
allowed_origins = [o.strip() for o in raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],    # GET, POST, DELETE, OPTIONS, etc.
    allow_headers=["*"],    # Content-Type, Authorization, etc.
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
# All diagram-related routes are defined in routes/diagrams.py.
# We mount them under /api/v1 so future versions can live at /api/v2
# without breaking existing clients.
app.include_router(diagrams_router, prefix="/api/v1", tags=["diagrams"])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
async def health():
    """
    Simple liveness check. API Gateway and load balancers can ping this
    to confirm the function is responding before routing real traffic.
    """
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------
# Mangum wraps our FastAPI ASGI app so it can be invoked by AWS Lambda.
#
# When a request hits API Gateway:
#   1. API Gateway calls Lambda with an event dict
#   2. Mangum converts that event into an ASGI-compatible request
#   3. FastAPI processes it as a normal HTTP request
#   4. Mangum converts the FastAPI response back into the format
#      API Gateway expects and returns it
#
# lifespan="off" disables startup/shutdown events which aren't needed
# in a Lambda context (the process is ephemeral anyway).
handler = Mangum(app, lifespan="off")
