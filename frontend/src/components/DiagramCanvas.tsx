/**
 * DiagramCanvas Component
 * -----------------------
 * Renders the interactive graph using React Flow (@xyflow/react).
 *
 * React Flow core concepts:
 *   - Nodes: boxes on the canvas (each AWS resource is one node)
 *   - Edges: arrows between nodes (each Ref/GetAtt reference is one edge)
 *   - Custom node types: we register "awsNode" to render our styled AWS boxes
 *
 * The user can:
 *   - Pan the canvas by clicking and dragging the background
 *   - Zoom with the scroll wheel or the controls in the corner
 *   - Click a node to open the detail panel (handled by onNodeClick prop)
 *   - Drag nodes to rearrange the layout
 */
import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { DiagramNode, DiagramEdge } from "../api/client";
import { AwsNode } from "./AwsNode";

// ---------------------------------------------------------------------------
// Register custom node types
// ---------------------------------------------------------------------------
// React Flow lets us define custom node renderers.
// "awsNode" matches the `type` field we set in the parser.
// Defined outside the component to avoid re-registering on every render.
const nodeTypes: NodeTypes = {
  awsNode: AwsNode,
};

interface DiagramCanvasProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  onNodeClick: (node: DiagramNode) => void;
}

export function DiagramCanvas({ nodes, edges, onNodeClick }: DiagramCanvasProps) {
  // React Flow uses its own Node/Edge types — we cast our API types to them.
  // The `data` field is passed through unchanged to our AwsNode component.
  const flowNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
  }));

  const flowEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated ?? true,
    // Style the edges to match our dark theme
    style: { stroke: "#6c8ef5", strokeWidth: 1.5 },
    labelStyle: { fill: "#8892a4", fontSize: 11 },
    labelBgStyle: { fill: "#1a1d27" },
  }));

  // When a node is clicked, pull out the original DiagramNode and pass it up
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const original = nodes.find((n) => n.id === node.id);
      if (original) onNodeClick(original);
    },
    [nodes, onNodeClick]
  );

  if (nodes.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>⬡</div>
        <p style={styles.emptyTitle}>No diagram yet</p>
        <p style={styles.emptyHint}>
          Paste a CloudFormation template in the editor and click{" "}
          <strong>Generate Diagram</strong>
        </p>
      </div>
    );
  }

  return (
    /*
      ReactFlow must be inside a container with explicit height.
      It renders an HTML5 canvas + SVG overlay for the edges.
    */
    <div style={styles.canvas}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView                        // Auto-zoom to fit all nodes on load
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
      >
        {/* Dot grid background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#2e3347"
        />
        {/* Zoom in/out + fit view buttons */}
        <Controls style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }} />
        {/* Mini overview map in the bottom-right corner */}
        <MiniMap
          style={{ background: "var(--bg-surface)" }}
          nodeColor={(node) => {
            // Color the minimap dots by service category
            const category = (node.data as { category?: string }).category;
            return categoryColor(category);
          }}
        />
      </ReactFlow>
    </div>
  );
}

/** Map a service category string to a hex color for the MiniMap */
function categoryColor(category?: string): string {
  const map: Record<string, string> = {
    compute:   "#f59e0b",
    storage:   "#10b981",
    network:   "#3b82f6",
    messaging: "#8b5cf6",
    security:  "#ef4444",
    monitoring:"#06b6d4",
  };
  return map[category ?? ""] ?? "#6b7280";
}

const styles: Record<string, React.CSSProperties> = {
  canvas: {
    flex: 1,
    height: "100%",
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "var(--text-secondary)",
    userSelect: "none",
  },
  emptyIcon: {
    fontSize: 48,
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  emptyHint: {
    fontSize: 13,
    maxWidth: 300,
    textAlign: "center",
    lineHeight: 1.6,
  },
};
