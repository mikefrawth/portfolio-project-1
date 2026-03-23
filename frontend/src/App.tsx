/**
 * App — Root Component
 * ---------------------
 * This is the top-level component that wires everything together.
 *
 * Layout (left to right):
 *   ┌──────────────┬──────────────────────────┬───────────────┐
 *   │ SavedDiagrams│     DiagramCanvas         │  NodeDetail   │
 *   │  (220px)     │     (flex: 1)             │  (300px)      │
 *   ├──────────────┤                           │               │
 *   │              │                           │               │
 *   └──────────────┴──────────────────────────┴───────────────┘
 *                      Editor sits below the canvas in a
 *                      resizable split view (bottom half)
 *
 * State management:
 *   We use React's useState hook — no Redux or Zustand needed for an MVP.
 *   All state lives here and is passed down as props.
 *
 * Data flow:
 *   User types in Editor
 *     → clicks "Generate Diagram"
 *       → App calls parseTemplate() API
 *         → sets nodes/edges state
 *           → DiagramCanvas re-renders with new graph
 *             → User clicks a node
 *               → selectedNode state updates
 *                 → NodeDetail panel renders
 */
import { useState, useEffect, useCallback } from "react";

import { Editor } from "./components/Editor";
import { DiagramCanvas } from "./components/DiagramCanvas";
import { NodeDetail } from "./components/NodeDetail";
import { SavedDiagrams } from "./components/SavedDiagrams";

import {
  parseTemplate,
  saveDiagram,
  listDiagrams,
  getDiagram,
  deleteDiagram,
  type DiagramNode,
  type DiagramEdge,
  type DiagramSummary,
} from "./api/client";

export default function App() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  // The raw template text in the Monaco editor
  const [templateText, setTemplateText] = useState("");

  // The parsed graph data — drives the canvas
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [edges, setEdges] = useState<DiagramEdge[]>([]);

  // Which node the user has clicked on (null = panel hidden)
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);

  // List of saved diagrams shown in the left sidebar
  const [savedDiagrams, setSavedDiagrams] = useState<DiagramSummary[]>([]);

  // Loading / error states for async operations
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load saved diagrams on first render
  // ---------------------------------------------------------------------------
  // useEffect with an empty dependency array [] runs once after mount,
  // similar to componentDidMount in class components.
  useEffect(() => {
    listDiagrams()
      .then(setSavedDiagrams)
      .catch(() => {}); // Non-critical — don't show error if list fails
  }, []);

  // ---------------------------------------------------------------------------
  // Parse template
  // ---------------------------------------------------------------------------
  const handleParse = useCallback(async () => {
    if (!templateText.trim()) return;
    setIsParsing(true);
    setError(null);
    try {
      const result = await parseTemplate(templateText);
      setNodes(result.nodes);
      setEdges(result.edges);
      setSelectedNode(null); // Clear any previously selected node
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse template");
    } finally {
      // finally always runs — clears the loading state whether success or error
      setIsParsing(false);
    }
  }, [templateText]);

  // ---------------------------------------------------------------------------
  // Save diagram
  // ---------------------------------------------------------------------------
  const handleSave = useCallback(
    async (name: string) => {
      setIsSaving(true);
      try {
        const summary = await saveDiagram(name, nodes, edges);
        // Prepend the new diagram to the top of the list
        setSavedDiagrams((prev) => [summary, ...prev]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save diagram");
      } finally {
        setIsSaving(false);
      }
    },
    [nodes, edges]
  );

  // ---------------------------------------------------------------------------
  // Load a saved diagram
  // ---------------------------------------------------------------------------
  const handleLoad = useCallback(async (id: string) => {
    try {
      const diagram = await getDiagram(id);
      setNodes(diagram.nodes);
      setEdges(diagram.edges);
      setSelectedNode(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diagram");
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Delete a saved diagram
  // ---------------------------------------------------------------------------
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteDiagram(id);
      setSavedDiagrams((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete diagram");
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={styles.app}>
      {/* ── Top bar ── */}
      <header style={styles.topBar}>
        <span style={styles.logo}>ArchViz</span>
        <span style={styles.tagline}>CloudFormation Diagram Generator</span>
        {error && (
          <div style={styles.error}>
            ⚠ {error}
            <button onClick={() => setError(null)} style={styles.dismissBtn}>
              ✕
            </button>
          </div>
        )}
      </header>

      {/* ── Main layout ── */}
      <div style={styles.main}>
        {/* Left: saved diagrams list */}
        <SavedDiagrams
          diagrams={savedDiagrams}
          onLoad={handleLoad}
          onSave={handleSave}
          onDelete={handleDelete}
          isSaving={isSaving}
          hasCurrentDiagram={nodes.length > 0}
        />

        {/* Center: split vertically between canvas (top) and editor (bottom) */}
        <div style={styles.centerColumn}>
          {/* Canvas takes the top 60% */}
          <div style={styles.canvasArea}>
            <DiagramCanvas
              nodes={nodes}
              edges={edges}
              onNodeClick={setSelectedNode}
            />
          </div>

          {/* Divider */}
          <div style={styles.divider} />

          {/* Editor takes the bottom 40% */}
          <div style={styles.editorArea}>
            <Editor
              value={templateText}
              onChange={setTemplateText}
              onParse={handleParse}
              isParsing={isParsing}
            />
          </div>
        </div>

        {/* Right: node detail panel (only visible when a node is selected) */}
        <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 16px",
    background: "var(--bg-surface)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    zIndex: 10,
  },
  logo: {
    fontWeight: 800,
    fontSize: 16,
    color: "var(--accent)",
    letterSpacing: "-0.02em",
  },
  tagline: {
    fontSize: 12,
    color: "var(--text-secondary)",
  },
  error: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#3b1515",
    border: "1px solid #7f1d1d",
    color: "#fca5a5",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12,
  },
  dismissBtn: {
    background: "none",
    border: "none",
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 11,
    padding: "0 2px",
  },
  main: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },
  centerColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  canvasArea: {
    flex: "0 0 60%",
    display: "flex",
    overflow: "hidden",
  },
  divider: {
    height: 4,
    background: "var(--border)",
    cursor: "row-resize",
    flexShrink: 0,
  },
  editorArea: {
    flex: "0 0 40%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
};
