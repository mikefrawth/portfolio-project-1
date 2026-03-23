/**
 * NodeDetail — Resource Properties Sidebar
 * ------------------------------------------
 * When the user clicks a node on the diagram, this panel slides in on the
 * right side showing the full CloudFormation properties of that resource.
 *
 * Props:
 *   node     — the selected DiagramNode (null means nothing is selected)
 *   onClose  — called when the user clicks the X button
 */
import type { DiagramNode } from "../api/client";

interface NodeDetailProps {
  node: DiagramNode | null;
  onClose: () => void;
}

export function NodeDetail({ node, onClose }: NodeDetailProps) {
  // If nothing is selected, render nothing (panel is hidden)
  if (!node) return null;

  const { label, resourceType, service, properties } = node.data;

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.serviceTag}>{service}</div>
          <div style={styles.title}>{label}</div>
        </div>
        <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
          ✕
        </button>
      </div>

      {/* Resource type */}
      <div style={styles.typeRow}>
        <span style={styles.typeLabel}>Type</span>
        <span style={styles.typeValue}>{resourceType}</span>
      </div>

      {/* Properties section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Properties</div>
        {Object.keys(properties).length === 0 ? (
          <p style={styles.empty}>No properties defined</p>
        ) : (
          /*
            We render properties as a formatted JSON block.
            JSON.stringify(value, null, 2) pretty-prints with 2-space indentation.
            This is the quickest way to show nested CF property structures.
          */
          <div style={styles.propList}>
            {Object.entries(properties).map(([key, value]) => (
              <div key={key} style={styles.propItem}>
                <span style={styles.propKey}>{key}</span>
                <pre style={styles.propValue}>
                  {typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 300,
    flexShrink: 0,
    background: "var(--bg-surface)",
    borderLeft: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "14px 14px 10px",
    borderBottom: "1px solid var(--border)",
  },
  serviceTag: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--accent)",
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--text-primary)",
    wordBreak: "break-all",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: 14,
    cursor: "pointer",
    padding: "2px 4px",
    borderRadius: 4,
    flexShrink: 0,
  },
  typeRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "8px 14px",
    borderBottom: "1px solid var(--border)",
  },
  typeLabel: {
    fontSize: 11,
    color: "var(--text-secondary)",
    flexShrink: 0,
  },
  typeValue: {
    fontSize: 11,
    color: "var(--text-primary)",
    wordBreak: "break-all",
    fontFamily: "monospace",
  },
  section: {
    flex: 1,
    overflow: "auto",
    padding: "10px 14px",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-secondary)",
    marginBottom: 10,
  },
  empty: {
    color: "var(--text-secondary)",
    fontSize: 12,
  },
  propList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  propItem: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  propKey: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--accent)",
    fontFamily: "monospace",
  },
  propValue: {
    fontSize: 11,
    color: "var(--text-primary)",
    background: "var(--bg-elevated)",
    borderRadius: 4,
    padding: "4px 8px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
    maxHeight: 200,
    fontFamily: "monospace",
    lineHeight: 1.5,
  },
};
