"""
CloudFormation Template Parser
================================
This module is the core logic of ArchViz. It takes a raw CloudFormation
template (JSON or YAML) and converts it into a graph of nodes and edges
that React Flow can render as an interactive diagram.

High-level flow:
  raw template string
      → parse JSON/YAML into a Python dict
      → extract the Resources section
      → convert each resource into a DiagramNode
      → scan each resource's properties for Ref / Fn::GetAtt references
      → convert each reference into a DiagramEdge
      → return nodes + edges
"""

import json
import yaml
from typing import Any


# ---------------------------------------------------------------------------
# CloudFormation YAML loader
# ---------------------------------------------------------------------------
# CloudFormation templates use YAML shorthand tags for intrinsic functions:
#   !Ref LogicalName          → {"Ref": "LogicalName"}
#   !GetAtt Resource.Attr     → {"Fn::GetAtt": ["Resource", "Attr"]}
#   !Sub "string ${Var}"      → {"Fn::Sub": "string ${Var}"}
#   !Join [",", [a, b]]       → {"Fn::Join": [",", [a, b]]}
#   ... etc.
#
# PyYAML's safe_load rejects these because they're not standard YAML 1.1 tags.
# We register constructors for each CF tag so PyYAML converts them into the
# equivalent dict form — which our Ref/GetAtt extractor already handles.

class _CfnLoader(yaml.SafeLoader):
    pass

def _tag_constructor(tag_suffix: str):
    """
    Returns a PyYAML constructor function that converts a YAML tag node
    into its CloudFormation dict equivalent.

    Scalar tags  (e.g. !Ref MyBucket)        → {"Ref": "MyBucket"}
    Sequence tags (e.g. !Select [0, [a,b]])   → {"Fn::Select": [0, [a,b]]}
    Mapping tags  (e.g. !Transform {...})      → {"Fn::Transform": {...}}

    For !Ref we use "Ref" as the key; for everything else we use "Fn::<Tag>".
    """
    fn_key = tag_suffix if tag_suffix == "Ref" or tag_suffix == "Condition" else f"Fn::{tag_suffix}"

    def constructor(loader: yaml.SafeLoader, node: yaml.Node) -> Any:
        if isinstance(node, yaml.ScalarNode):
            return {fn_key: loader.construct_scalar(node)}
        elif isinstance(node, yaml.SequenceNode):
            return {fn_key: loader.construct_sequence(node, deep=True)}
        else:
            return {fn_key: loader.construct_mapping(node, deep=True)}

    return constructor

# Register constructors for every CloudFormation intrinsic function tag
for _tag in [
    "Ref", "GetAtt", "Sub", "Join", "Select", "Split", "FindInMap",
    "Base64", "If", "Not", "And", "Or", "Equals", "ImportValue",
    "Transform", "Condition",
]:
    _CfnLoader.add_constructor(f"!{_tag}", _tag_constructor(_tag))

from app.models.diagram import DiagramNode, DiagramEdge, NodeData, NodePosition


# ---------------------------------------------------------------------------
# Service metadata
# ---------------------------------------------------------------------------
# Maps a CloudFormation resource type to a short service label.
# We use this to display a friendlier name on the diagram node and to
# pick a color category (see SERVICE_COLORS below).
#
# Format: "AWS::<Category>::<ResourceType>" → "Short Name"
SERVICE_LABELS: dict[str, str] = {
    # Compute
    "AWS::Lambda::Function":            "Lambda",
    "AWS::EC2::Instance":               "EC2",
    "AWS::ECS::Cluster":                "ECS Cluster",
    "AWS::ECS::Service":                "ECS Service",
    "AWS::ECS::TaskDefinition":         "ECS Task",
    "AWS::Batch::JobDefinition":        "Batch Job",
    # Storage
    "AWS::S3::Bucket":                  "S3",
    "AWS::DynamoDB::Table":             "DynamoDB",
    "AWS::RDS::DBInstance":             "RDS",
    "AWS::RDS::DBCluster":              "Aurora",
    "AWS::ElastiCache::CacheCluster":   "ElastiCache",
    # Networking
    "AWS::ApiGateway::RestApi":         "API Gateway",
    "AWS::ApiGatewayV2::Api":           "API Gateway v2",
    "AWS::CloudFront::Distribution":    "CloudFront",
    "AWS::Route53::RecordSet":          "Route 53",
    "AWS::ElasticLoadBalancingV2::LoadBalancer": "ALB/NLB",
    "AWS::EC2::VPC":                    "VPC",
    "AWS::EC2::Subnet":                 "Subnet",
    "AWS::EC2::SecurityGroup":          "Security Group",
    # Messaging / Integration
    "AWS::SQS::Queue":                  "SQS",
    "AWS::SNS::Topic":                  "SNS",
    "AWS::Events::Rule":                "EventBridge",
    "AWS::Kinesis::Stream":             "Kinesis",
    # Security / Identity
    "AWS::IAM::Role":                   "IAM Role",
    "AWS::IAM::Policy":                 "IAM Policy",
    "AWS::Cognito::UserPool":           "Cognito",
    "AWS::SecretsManager::Secret":      "Secrets Manager",
    "AWS::KMS::Key":                    "KMS",
    # Monitoring
    "AWS::CloudWatch::Alarm":           "CloudWatch Alarm",
    "AWS::Logs::LogGroup":              "Log Group",
    # CDN / Edge
    "AWS::CloudFront::CloudFrontOriginAccessIdentity": "OAI",
    # Other
    "AWS::CloudFormation::Stack":       "Nested Stack",
    "AWS::StepFunctions::StateMachine": "Step Functions",
}

# Color categories for node styling on the frontend.
# The frontend maps these category names to background colors.
SERVICE_CATEGORIES: dict[str, str] = {
    "AWS::Lambda::Function":            "compute",
    "AWS::EC2::Instance":               "compute",
    "AWS::ECS::Cluster":                "compute",
    "AWS::ECS::Service":                "compute",
    "AWS::ECS::TaskDefinition":         "compute",
    "AWS::S3::Bucket":                  "storage",
    "AWS::DynamoDB::Table":             "storage",
    "AWS::RDS::DBInstance":             "storage",
    "AWS::RDS::DBCluster":              "storage",
    "AWS::ElastiCache::CacheCluster":   "storage",
    "AWS::ApiGateway::RestApi":         "network",
    "AWS::ApiGatewayV2::Api":           "network",
    "AWS::CloudFront::Distribution":    "network",
    "AWS::Route53::RecordSet":          "network",
    "AWS::ElasticLoadBalancingV2::LoadBalancer": "network",
    "AWS::EC2::VPC":                    "network",
    "AWS::EC2::Subnet":                 "network",
    "AWS::EC2::SecurityGroup":          "network",
    "AWS::SQS::Queue":                  "messaging",
    "AWS::SNS::Topic":                  "messaging",
    "AWS::Events::Rule":                "messaging",
    "AWS::Kinesis::Stream":             "messaging",
    "AWS::IAM::Role":                   "security",
    "AWS::IAM::Policy":                 "security",
    "AWS::Cognito::UserPool":           "security",
    "AWS::SecretsManager::Secret":      "security",
    "AWS::KMS::Key":                    "security",
    "AWS::CloudWatch::Alarm":           "monitoring",
    "AWS::Logs::LogGroup":              "monitoring",
}


# ---------------------------------------------------------------------------
# Layout helper
# ---------------------------------------------------------------------------

def _calculate_position(index: int, total: int) -> NodePosition:
    """
    Assigns an (x, y) position to each node so they don't all stack on top
    of each other when React Flow first renders.

    Strategy: arrange nodes in a grid, 4 columns wide.
      - index 0 → column 0, row 0 → (0,   0)
      - index 1 → column 1, row 0 → (220, 0)
      - index 4 → column 0, row 1 → (0,   120)

    React Flow lets users drag nodes after initial render, so this just
    needs to be "good enough" as a starting layout.
    """
    columns = 4
    col = index % columns
    row = index // columns
    return NodePosition(x=col * 220, y=row * 120)


# ---------------------------------------------------------------------------
# Reference extraction
# ---------------------------------------------------------------------------

def _extract_refs(value: Any) -> list[tuple[str, str]]:
    """
    Recursively walk a CloudFormation property value and collect every
    resource reference found inside it.

    Returns a list of (target_resource_id, ref_type) tuples, e.g.:
      [("MyBucket", "Ref"), ("MyTable", "Fn::GetAtt")]

    CloudFormation has two main ways to reference another resource:

    1. { "Ref": "LogicalResourceId" }
       Used to get the default value of a resource (e.g. bucket name,
       function ARN). This is the most common reference.

    2. { "Fn::GetAtt": ["LogicalResourceId", "Attribute"] }
       Used to get a specific attribute of a resource (e.g. ARN, URL).

    Both create a dependency between resources, so both become edges.
    """
    refs: list[tuple[str, str]] = []

    if isinstance(value, dict):
        # Check for { "Ref": "SomeResource" }
        if "Ref" in value and isinstance(value["Ref"], str):
            refs.append((value["Ref"], "Ref"))

        # Check for { "Fn::GetAtt": ["SomeResource", "Arn"] }
        elif "Fn::GetAtt" in value:
            att = value["Fn::GetAtt"]
            # CloudFormation supports both list form ["Resource", "Attr"]
            # and dot-notation string form "Resource.Attr"
            if isinstance(att, list) and len(att) >= 1:
                refs.append((att[0], "Fn::GetAtt"))
            elif isinstance(att, str) and "." in att:
                refs.append((att.split(".")[0], "Fn::GetAtt"))

        else:
            # Not a Ref/GetAtt — recurse into nested dicts (e.g. Sub, If, etc.)
            for v in value.values():
                refs.extend(_extract_refs(v))

    elif isinstance(value, list):
        # Recurse into lists (e.g. property arrays, Fn::Select, etc.)
        for item in value:
            refs.extend(_extract_refs(item))

    return refs


# ---------------------------------------------------------------------------
# Main parser entry point
# ---------------------------------------------------------------------------

def parse_template(template_str: str) -> tuple[list[DiagramNode], list[DiagramEdge]]:
    """
    Parse a CloudFormation template string and return (nodes, edges).

    Steps:
      1. Detect format (JSON vs YAML) and parse into a Python dict
      2. Validate that a Resources section exists
      3. Build one DiagramNode per resource
      4. Scan each resource's properties for Ref / Fn::GetAtt
      5. Build one DiagramEdge per valid cross-resource reference
      6. Return the lists — the route handler packages them into the response
    """

    # ------------------------------------------------------------------
    # Step 1 — Parse the raw string into a Python dict
    # ------------------------------------------------------------------
    # CloudFormation supports both JSON and YAML. We detect JSON by
    # checking if the stripped string starts with '{'. Everything else
    # we attempt to parse as YAML (YAML is a superset of JSON anyway,
    # but json.loads is faster for JSON input).
    template_str = template_str.strip()

    try:
        if template_str.startswith("{"):
            template = json.loads(template_str)
        else:
            template = yaml.load(template_str, Loader=_CfnLoader)
    except Exception as e:
        raise ValueError(f"Could not parse template as JSON or YAML: {e}")

    if not isinstance(template, dict):
        raise ValueError("Template must be a JSON object or YAML mapping at the top level.")

    # ------------------------------------------------------------------
    # Step 2 — Extract the Resources section
    # ------------------------------------------------------------------
    # The Resources section is the only required section in a CF template.
    # It's a dict where each key is a "logical ID" (user-defined name)
    # and each value describes the resource type and its properties.
    #
    # Example:
    #   Resources:
    #     MyBucket:           ← logical ID (becomes our node ID)
    #       Type: AWS::S3::Bucket
    #       Properties:
    #         BucketName: my-bucket
    resources: dict[str, Any] = template.get("Resources", {})

    if not resources:
        raise ValueError("Template has no Resources section or it is empty.")

    # ------------------------------------------------------------------
    # Step 3 — Build nodes
    # ------------------------------------------------------------------
    nodes: list[DiagramNode] = []
    resource_ids = list(resources.keys())  # Needed for edge validation later

    for index, (logical_id, resource_def) in enumerate(resources.items()):
        resource_type: str = resource_def.get("Type", "Unknown")
        properties: dict[str, Any] = resource_def.get("Properties", {})

        # Look up a friendly service label, fall back to the raw type string
        service = SERVICE_LABELS.get(resource_type, resource_type.split("::")[-1])

        node = DiagramNode(
            id=logical_id,
            type="awsNode",   # Matches the custom node type registered in React Flow
            position=_calculate_position(index, len(resources)),
            data=NodeData(
                label=logical_id,
                resourceType=resource_type,
                service=service,
                properties=properties,
            ),
        )
        nodes.append(node)

    # ------------------------------------------------------------------
    # Step 4 & 5 — Build edges from Ref / Fn::GetAtt references
    # ------------------------------------------------------------------
    edges: list[DiagramEdge] = []
    seen_edges: set[str] = set()  # Prevent duplicate edges for the same pair

    for logical_id, resource_def in resources.items():
        properties = resource_def.get("Properties", {})

        # Also check DependsOn — an explicit ordering dependency
        depends_on = resource_def.get("DependsOn", [])
        if isinstance(depends_on, str):
            depends_on = [depends_on]   # DependsOn can be a string or list

        # Turn DependsOn entries into edges
        for dep in depends_on:
            if dep in resource_ids and dep != logical_id:
                edge_key = f"{logical_id}→{dep}"
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    edges.append(DiagramEdge(
                        id=f"edge-{logical_id}-{dep}",
                        source=logical_id,
                        target=dep,
                        label="DependsOn",
                    ))

        # Walk the properties dict recursively to find Ref / Fn::GetAtt
        all_refs = _extract_refs(properties)

        for target_id, ref_type in all_refs:
            # Only create an edge if the target is actually another resource
            # in this template (Ref can also reference Parameters/Conditions)
            if target_id not in resource_ids:
                continue
            # No self-loops
            if target_id == logical_id:
                continue

            edge_key = f"{logical_id}→{target_id}"
            if edge_key in seen_edges:
                continue    # Skip duplicate (same pair referenced multiple times)

            seen_edges.add(edge_key)
            edges.append(DiagramEdge(
                id=f"edge-{logical_id}-{target_id}",
                source=logical_id,
                target=target_id,
                label=ref_type,
            ))

    return nodes, edges
