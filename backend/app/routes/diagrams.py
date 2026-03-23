"""
API Route Handlers
==================
This file defines all the HTTP endpoints exposed by the ArchViz API.
FastAPI uses decorators (@router.get, @router.post) to map URLs to functions.

Endpoints:
  POST /parse            — Parse a CF template, return graph data (not saved)
  POST /diagrams         — Save a parsed diagram to DynamoDB
  GET  /diagrams         — List all saved diagrams (summary only)
  GET  /diagrams/{id}    — Load a specific saved diagram with full node/edge data
  DELETE /diagrams/{id}  — Delete a saved diagram
"""

import os
import uuid
import json
import boto3
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from botocore.exceptions import ClientError

from app.parser.cloudformation import parse_template
from app.models.diagram import (
    ParseRequest,
    ParseResponse,
    SaveDiagramRequest,
    DiagramSummary,
    DiagramDetail,
    DiagramNode,
    DiagramEdge,
)

# APIRouter is FastAPI's way of grouping related routes.
# The main app in main.py mounts this router under a prefix.
router = APIRouter()


# ---------------------------------------------------------------------------
# DynamoDB client setup
# ---------------------------------------------------------------------------
# boto3 is the AWS SDK for Python. It lets us interact with DynamoDB.
#
# When running locally:
#   - We use a local DynamoDB emulator (set DYNAMODB_ENDPOINT in .env)
#   - boto3 still uses the same API — we just point it at localhost
#
# When running in Lambda:
#   - The Lambda execution role grants DynamoDB permissions
#   - boto3 automatically picks up the credentials from the role
#   - No keys needed in environment variables (that would be insecure)
#
# TABLE_NAME is set as an environment variable in the CDK stack so we
# don't hardcode it here.

def _get_table():
    """
    Returns a boto3 DynamoDB Table resource.
    Separated into a function so we can swap the endpoint for local dev.
    """
    endpoint_url = os.environ.get("DYNAMODB_ENDPOINT")  # Only set locally
    table_name = os.environ.get("DIAGRAMS_TABLE_NAME", "archviz-diagrams")

    dynamodb = boto3.resource(
        "dynamodb",
        endpoint_url=endpoint_url,   # None in production → uses real AWS
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
    )
    return dynamodb.Table(table_name)


# ---------------------------------------------------------------------------
# POST /parse
# ---------------------------------------------------------------------------

@router.post("/parse", response_model=ParseResponse)
async def parse_cloudformation(request: ParseRequest):
    """
    Parse a CloudFormation template and return graph data.

    This endpoint does NOT save anything — it's a pure transformation:
      CloudFormation template → { nodes, edges }

    The frontend uses this for the live preview before the user decides
    to save the diagram.
    """
    try:
        nodes, edges = parse_template(request.template)
    except ValueError as e:
        # ValueError means the template was malformed — 400 Bad Request
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Unexpected errors — 500 Internal Server Error
        raise HTTPException(status_code=500, detail=f"Parser error: {e}")

    return ParseResponse(nodes=nodes, edges=edges)


# ---------------------------------------------------------------------------
# POST /diagrams  — Save a diagram
# ---------------------------------------------------------------------------

@router.post("/diagrams", response_model=DiagramSummary, status_code=201)
async def save_diagram(request: SaveDiagramRequest):
    """
    Save a diagram to DynamoDB.

    DynamoDB is a NoSQL key-value store. Each item is a JSON document.
    Our table uses 'id' as the partition key (unique identifier per item).

    We serialize nodes and edges to JSON strings for storage because
    DynamoDB doesn't natively support nested lists of complex objects
    as cleanly as a flat JSON string.
    """
    table = _get_table()
    diagram_id = str(uuid.uuid4())   # Random unique ID
    created_at = datetime.now(timezone.utc).isoformat()

    item = {
        "id": diagram_id,
        "name": request.name,
        "createdAt": created_at,
        # Store nodes/edges as JSON strings — easy to deserialize on GET
        "nodes": json.dumps([n.model_dump() for n in request.nodes]),
        "edges": json.dumps([e.model_dump() for e in request.edges]),
    }

    try:
        table.put_item(Item=item)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Failed to save diagram: {e}")

    return DiagramSummary(id=diagram_id, name=request.name, createdAt=created_at)


# ---------------------------------------------------------------------------
# GET /diagrams  — List all saved diagrams
# ---------------------------------------------------------------------------

@router.get("/diagrams", response_model=list[DiagramSummary])
async def list_diagrams():
    """
    Return a list of all saved diagrams (name + id only, no graph data).

    DynamoDB Scan reads every item in the table. For a portfolio project
    this is fine — in production you'd use a Query with an index or
    paginate large result sets.
    """
    table = _get_table()

    try:
        # ProjectionExpression limits which attributes are returned,
        # keeping the response small (we skip nodes/edges here)
        response = table.scan(
            ProjectionExpression="id, #n, createdAt",
            ExpressionAttributeNames={"#n": "name"},  # 'name' is a reserved word in DynamoDB
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Failed to list diagrams: {e}")

    items = response.get("Items", [])
    # Sort by creation time, newest first
    items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

    return [
        DiagramSummary(id=item["id"], name=item["name"], createdAt=item["createdAt"])
        for item in items
    ]


# ---------------------------------------------------------------------------
# GET /diagrams/{diagram_id}  — Load a specific diagram
# ---------------------------------------------------------------------------

@router.get("/diagrams/{diagram_id}", response_model=DiagramDetail)
async def get_diagram(diagram_id: str):
    """
    Return the full diagram including nodes and edges.
    Used when the user selects a saved diagram from the list to reload it.
    """
    table = _get_table()

    try:
        response = table.get_item(Key={"id": diagram_id})
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch diagram: {e}")

    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Diagram not found")

    # Deserialize the JSON strings back into node/edge objects
    nodes = [DiagramNode(**n) for n in json.loads(item["nodes"])]
    edges = [DiagramEdge(**e) for e in json.loads(item["edges"])]

    return DiagramDetail(
        id=item["id"],
        name=item["name"],
        createdAt=item["createdAt"],
        nodes=nodes,
        edges=edges,
    )


# ---------------------------------------------------------------------------
# DELETE /diagrams/{diagram_id}  — Delete a diagram
# ---------------------------------------------------------------------------

@router.delete("/diagrams/{diagram_id}", status_code=204)
async def delete_diagram(diagram_id: str):
    """
    Delete a saved diagram from DynamoDB.
    Returns 204 No Content on success (standard REST convention for DELETE).
    """
    table = _get_table()

    try:
        table.delete_item(Key={"id": diagram_id})
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete diagram: {e}")
