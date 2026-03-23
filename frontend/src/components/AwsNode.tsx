/**
 * AwsNode — Custom React Flow Node
 * ----------------------------------
 * This is the visual component for each AWS resource on the diagram canvas.
 * React Flow calls this component for every node whose `type` is "awsNode".
 *
 * React Flow passes a `data` prop containing whatever we put in NodeData
 * (label, resourceType, service, properties).
 *
 * Each node shows:
 *   - A colored left border indicating the service category
 *   - The service name (e.g. "Lambda")
 *   - The logical resource ID (e.g. "MyFunction")
 *
 * The Handle components are the connection points for edges (arrows).
 * We put one on the top and one on the bottom so edges can connect
 * from any direction.
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeData } from "../api/client";

// Map service category to a CSS variable color
const CATEGORY_COLORS: Record<string, string> = {
  compute:    "var(--color-compute)",
  storage:    "var(--color-storage)",
  network:    "var(--color-network)",
  messaging:  "var(--color-messaging)",
  security:   "var(--color-security)",
  monitoring: "var(--color-monitoring)",
};

// Map resource type to category (mirrors SERVICE_CATEGORIES in the parser)
function getCategory(resourceType: string): string {
  if (resourceType.includes("Lambda") || resourceType.includes("EC2") || resourceType.includes("ECS") || resourceType.includes("Batch")) return "compute";
  if (resourceType.includes("S3") || resourceType.includes("DynamoDB") || resourceType.includes("RDS") || resourceType.includes("ElastiCache")) return "storage";
  if (resourceType.includes("ApiGateway") || resourceType.includes("CloudFront") || resourceType.includes("Route53") || resourceType.includes("VPC") || resourceType.includes("Subnet") || resourceType.includes("LoadBalancing")) return "network";
  if (resourceType.includes("SQS") || resourceType.includes("SNS") || resourceType.includes("Events") || resourceType.includes("Kinesis")) return "messaging";
  if (resourceType.includes("IAM") || resourceType.includes("Cognito") || resourceType.includes("Secrets") || resourceType.includes("KMS")) return "security";
  if (resourceType.includes("CloudWatch") || resourceType.includes("Logs")) return "monitoring";
  return "default";
}

export function AwsNode({ data, selected }: NodeProps) {
  // React Flow passes `data` as the generic NodeData we set in the parser
  const nodeData = data as NodeData;
  const category = getCategory(nodeData.resourceType);
  const color = CATEGORY_COLORS[category] ?? "var(--color-default)";

  return (
    <>
      {/*
        Handles are the little dots that edges connect to.
        Position.Top = top edge of the node
        Position.Bottom = bottom edge of the node
        type="target" means edges can point TO this handle
        type="source" means edges can start FROM this handle
        We allow both on top and bottom for flexibility.
      */}
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Top} style={handleStyle} />

      <div
        style={{
          ...nodeStyle,
          borderColor: selected ? color : "var(--border)",
          boxShadow: selected ? `0 0 0 2px ${color}40` : "none",
        }}
      >
        {/* Colored accent bar on the left side */}
        <div style={{ ...accentBar, background: color }} />

        <div style={content}>
          {/* Service type label e.g. "Lambda" */}
          <span style={{ ...serviceLabel, color }}>{nodeData.service}</span>
          {/* Logical resource ID e.g. "MyFunction" */}
          <span style={resourceLabel}>{nodeData.label}</span>
        </div>
      </div>

      <Handle type="target" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const nodeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  minWidth: 160,
  maxWidth: 200,
  overflow: "hidden",
  cursor: "pointer",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const accentBar: React.CSSProperties = {
  width: 4,
  flexShrink: 0,
};

const content: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: "8px 10px",
  gap: 2,
  overflow: "hidden",
};

const serviceLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const resourceLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const handleStyle: React.CSSProperties = {
  background: "var(--border)",
  width: 8,
  height: 8,
  border: "2px solid var(--bg-surface)",
};
