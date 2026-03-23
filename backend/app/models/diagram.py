"""
Data models for the ArchViz API.

Pydantic models serve two purposes here:
1. Validation — FastAPI automatically rejects requests that don't match these shapes
2. Documentation — FastAPI generates an OpenAPI (Swagger) spec from these models
   Visit http://localhost:8000/docs when running locally to see it
"""

from pydantic import BaseModel
from typing import Any


# ---------------------------------------------------------------------------
# Graph primitives — these are the shapes React Flow expects on the frontend
# ---------------------------------------------------------------------------

class NodePosition(BaseModel):
    """
    x/y coordinates for where React Flow should render the node on the canvas.
    The parser assigns these automatically using a simple grid layout.
    """
    x: float
    y: float


class NodeData(BaseModel):
    """
    Metadata attached to each node. React Flow passes this to our custom
    node component so it can display the service name, type, and properties.
    """
    label: str           # Human-readable name, e.g. "MyLambdaFunction"
    resourceType: str    # Full CF type, e.g. "AWS::Lambda::Function"
    service: str         # Short service name, e.g. "Lambda"
    properties: dict[str, Any]  # Raw CF properties for the detail panel


class DiagramNode(BaseModel):
    """
    A single node in the React Flow graph.
    React Flow requires: id, type, position, data
    """
    id: str              # Unique ID matching the CF logical resource name
    type: str            # React Flow node type — we use "awsNode" (our custom type)
    position: NodePosition
    data: NodeData


class DiagramEdge(BaseModel):
    """
    A directed edge (arrow) between two nodes in the React Flow graph.
    React Flow requires: id, source, target
    """
    id: str              # Unique ID for this edge, e.g. "edge-Lambda1-Table1"
    source: str          # ID of the node the arrow starts from
    target: str          # ID of the node the arrow points to
    label: str = ""      # Optional label shown on the arrow, e.g. "Ref"
    animated: bool = True  # Animated edges look great for data-flow diagrams


# ---------------------------------------------------------------------------
# API request / response shapes
# ---------------------------------------------------------------------------

class ParseRequest(BaseModel):
    """
    Request body for POST /parse.
    The frontend sends the raw template text (JSON or YAML string).
    """
    template: str        # Raw CloudFormation template as a string


class ParseResponse(BaseModel):
    """
    Response from POST /parse.
    Contains everything React Flow needs to render the diagram.
    """
    nodes: list[DiagramNode]
    edges: list[DiagramEdge]


class SaveDiagramRequest(BaseModel):
    """
    Request body for POST /diagrams.
    The frontend sends the name plus the already-parsed graph data.
    """
    name: str
    nodes: list[DiagramNode]
    edges: list[DiagramEdge]


class DiagramSummary(BaseModel):
    """
    Lightweight representation used in the list view (GET /diagrams).
    We don't return full node/edge data in the list to keep responses small.
    """
    id: str
    name: str
    createdAt: str


class DiagramDetail(BaseModel):
    """
    Full diagram returned when loading a saved diagram (GET /diagrams/{id}).
    """
    id: str
    name: str
    createdAt: str
    nodes: list[DiagramNode]
    edges: list[DiagramEdge]
