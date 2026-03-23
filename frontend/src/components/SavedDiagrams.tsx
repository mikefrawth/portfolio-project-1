/**
 * SavedDiagrams — Sidebar list of previously saved diagrams
 * ----------------------------------------------------------
 * Shows a list of saved diagram names. Clicking one loads it.
 * Also provides a save button for the current diagram.
 */
import { useState } from "react";
import type { DiagramSummary } from "../api/client";

interface SavedDiagramsProps {
  diagrams: DiagramSummary[];
  onLoad: (id: string) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
  hasCurrentDiagram: boolean;
}

export function SavedDiagrams({
  diagrams,
  onLoad,
  onSave,
  onDelete,
  isSaving,
  hasCurrentDiagram,
}: SavedDiagramsProps) {
  // Local state for the "save diagram" name input
  const [saveName, setSaveName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  function handleSave() {
    if (!saveName.trim()) return;
    onSave(saveName.trim());
    setSaveName("");
    setShowSaveForm(false);
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>Saved Diagrams</span>
        {/* Only show "Save current" if there's a diagram on the canvas */}
        {hasCurrentDiagram && (
          <button
            onClick={() => setShowSaveForm((v) => !v)}
            style={styles.saveBtn}
          >
            {showSaveForm ? "Cancel" : "+ Save"}
          </button>
        )}
      </div>

      {/* Save form — name input + confirm button */}
      {showSaveForm && (
        <div style={styles.saveForm}>
          <input
            style={styles.input}
            type="text"
            placeholder="Diagram name…"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim() || isSaving}
            style={{
              ...styles.confirmBtn,
              opacity: !saveName.trim() || isSaving ? 0.5 : 1,
            }}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* Diagram list */}
      <div style={styles.list}>
        {diagrams.length === 0 ? (
          <p style={styles.empty}>No saved diagrams yet</p>
        ) : (
          diagrams.map((d) => (
            <div key={d.id} style={styles.item}>
              <button
                style={styles.itemName}
                onClick={() => onLoad(d.id)}
                title={`Load "${d.name}"`}
              >
                {d.name}
              </button>
              <span style={styles.itemDate}>
                {/* Format the ISO date string into a readable local date */}
                {new Date(d.createdAt).toLocaleDateString()}
              </span>
              <button
                style={styles.deleteBtn}
                onClick={() => onDelete(d.id)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 220,
    flexShrink: 0,
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
  },
  title: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-secondary)",
  },
  saveBtn: {
    background: "none",
    border: "1px solid var(--accent)",
    color: "var(--accent)",
    borderRadius: 4,
    fontSize: 11,
    padding: "2px 8px",
    cursor: "pointer",
  },
  saveForm: {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    gap: 6,
  },
  input: {
    flex: 1,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text-primary)",
    padding: "4px 8px",
    fontSize: 12,
    outline: "none",
  },
  confirmBtn: {
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    borderRadius: 4,
    fontSize: 12,
    padding: "4px 10px",
    cursor: "pointer",
  },
  list: {
    flex: 1,
    overflow: "auto",
    padding: "6px 0",
  },
  empty: {
    padding: "12px",
    color: "var(--text-secondary)",
    fontSize: 12,
    textAlign: "center",
  },
  item: {
    display: "flex",
    alignItems: "center",
    padding: "6px 12px",
    gap: 6,
    borderBottom: "1px solid var(--border)",
  },
  itemName: {
    flex: 1,
    background: "none",
    border: "none",
    color: "var(--text-primary)",
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    padding: 0,
  },
  itemDate: {
    fontSize: 10,
    color: "var(--text-secondary)",
    flexShrink: 0,
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: 11,
    cursor: "pointer",
    padding: "2px 4px",
    borderRadius: 3,
    flexShrink: 0,
  },
};
