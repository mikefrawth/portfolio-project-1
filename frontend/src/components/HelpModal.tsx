/**
 * HelpModal — Usage guide and AWS connection info
 * ------------------------------------------------
 * Opened by the "?" button in the top bar.
 * Click the backdrop or the ✕ button to dismiss.
 */
import type { ReactNode } from "react";

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <span style={s.title}>How to use ArchViz</span>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.body}>
          <Section heading="Generating a diagram">
            <Steps>
              <li>Paste a CloudFormation template (JSON or YAML) into the editor at the bottom.</li>
              <li>Click <strong>Generate Diagram →</strong> to parse and visualize all resources.</li>
              <li>Click any node to see its full resource properties in the right panel.</li>
              <li>Drag nodes to rearrange the layout. Scroll to zoom; drag the background to pan.</li>
            </Steps>
          </Section>

          <Section heading="Saving &amp; loading diagrams">
            <Steps>
              <li>With a diagram on the canvas, click <strong>Save Diagram</strong> in the left sidebar.</li>
              <li>Give it a name — it will be stored in DynamoDB.</li>
              <li>Click any saved diagram in the left sidebar list to reload it onto the canvas.</li>
              <li>Click the trash icon next to a saved diagram to delete it.</li>
            </Steps>
          </Section>

          <Section heading="Does this connect to my AWS account?">
            <p style={s.para}>
              ArchViz does <strong>not</strong> read live resources from your AWS account — you
              paste templates in manually. It <em>does</em> use AWS DynamoDB to persist saved
              diagrams.
            </p>
            <p style={s.para}>To enable saves you need a DynamoDB table. Two options:</p>
            <p style={s.subheading}>Option A — DynamoDB Local (no AWS account needed)</p>
            <pre style={s.code}>{`# From the repo root:
docker compose up -d
# Starts DynamoDB Local on port 8001 and the backend on port 8000.
# The table is created automatically on first startup.`}</pre>

            <p style={s.subheading}>Option B — Real AWS credentials</p>
            <pre style={s.code}>{`export AWS_ACCESS_KEY_ID=<your-key>
export AWS_SECRET_ACCESS_KEY=<your-secret>
export AWS_DEFAULT_REGION=us-east-1

# Create the table once:
aws dynamodb create-table \\
  --table-name archviz-diagrams \\
  --attribute-definitions AttributeName=id,AttributeType=S \\
  --key-schema AttributeName=id,KeyType=HASH \\
  --billing-mode PAY_PER_REQUEST

# Then start the backend normally:
cd backend && uvicorn app.main:app --reload --port 8000`}</pre>

            <p style={s.subheading}>Production deployment</p>
            <p style={s.para}>
              Deploy with <code style={s.inlineCode}>cdk deploy</code> in the <code style={s.inlineCode}>/infra</code> directory.
              The CDK stack creates the DynamoDB table and grants the Lambda function access
              automatically via an IAM role — no credentials needed in environment variables.
            </p>
          </Section>

          <Section heading="Supported resources &amp; references">
            <p style={s.para}>
              Every entry in the <code style={s.inlineCode}>Resources</code> section becomes a node.
              Recognized AWS service types get colored labels; unknown types appear as gray nodes.
              Edges are drawn for <code style={s.inlineCode}>Ref</code>,{" "}
              <code style={s.inlineCode}>Fn::GetAtt</code>, and{" "}
              <code style={s.inlineCode}>DependsOn</code> relationships.
            </p>
            <p style={s.para}>
              Both JSON and YAML templates are supported, including YAML shorthand tags such as{" "}
              <code style={s.inlineCode}>!Ref</code>, <code style={s.inlineCode}>!GetAtt</code>, and{" "}
              <code style={s.inlineCode}>!Sub</code>.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h3 style={s.sectionHeading}>{heading}</h3>
      {children}
    </section>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol style={s.list}>{children}</ol>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    width: "min(680px, 92vw)",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  title: {
    fontWeight: 700,
    fontSize: 15,
    color: "var(--text-primary)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 14,
    padding: "2px 4px",
  },
  body: {
    padding: "20px 24px",
    overflowY: "auto",
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--accent)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 10,
  },
  para: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.7,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-primary)",
    marginTop: 10,
    marginBottom: 4,
  },
  list: {
    fontSize: 13,
    color: "var(--text-secondary)",
    lineHeight: 1.7,
    paddingLeft: 20,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  code: {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 11.5,
    color: "#a8d8a8",
    overflowX: "auto",
    lineHeight: 1.6,
    marginBottom: 8,
    whiteSpace: "pre",
  },
  inlineCode: {
    background: "var(--bg-elevated)",
    borderRadius: 3,
    padding: "1px 5px",
    fontSize: "0.9em",
    color: "var(--accent)",
    fontFamily: "monospace",
  },
};
