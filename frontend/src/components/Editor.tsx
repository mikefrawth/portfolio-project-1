/**
 * Editor Component
 * ----------------
 * A Monaco Editor (VS Code's editor) embedded in the page for pasting
 * CloudFormation templates. Provides syntax highlighting for both
 * JSON and YAML.
 *
 * Props:
 *   value        — current text content (controlled by parent)
 *   onChange     — called whenever the user edits the text
 *   onParse      — called when the user clicks the "Generate Diagram" button
 *   isParsing    — disables the button while the API request is in flight
 */
import MonacoEditor from "@monaco-editor/react";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onParse: () => void;
  isParsing: boolean;
}

// A small example template shown on first load so users know what to paste
const EXAMPLE_TEMPLATE = `AWSTemplateFormatVersion: "2010-09-09"
Description: Example CloudFormation template for ArchViz

Resources:
  # API Gateway receives HTTP requests from the internet
  MyApi:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: MyDemoApi

  # Lambda function handles the business logic
  MyFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: MyDemoFunction
      Runtime: python3.12
      Handler: index.handler
      Role: !GetAtt MyExecutionRole.Arn
      Environment:
        Variables:
          TABLE_NAME: !Ref MyTable

  # IAM Role grants the Lambda permission to access DynamoDB
  MyExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: MyLambdaRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole

  # DynamoDB table stores application data
  MyTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: MyDemoTable
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH

  # S3 bucket stores static assets
  MyBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-demo-assets-bucket
`;

export function Editor({ value, onChange, onParse, isParsing }: EditorProps) {
  return (
    <div style={styles.container}>
      {/* Header bar with title and action button */}
      <div style={styles.header}>
        <span style={styles.title}>CloudFormation Template</span>
        <button
          onClick={onParse}
          disabled={isParsing || !value.trim()}
          style={{
            ...styles.button,
            opacity: isParsing || !value.trim() ? 0.5 : 1,
            cursor: isParsing || !value.trim() ? "not-allowed" : "pointer",
          }}
        >
          {isParsing ? "Generating…" : "Generate Diagram →"}
        </button>
      </div>

      {/*
        Monaco Editor
        - language: "yaml" enables YAML syntax highlighting
        - theme: "vs-dark" matches our dark UI
        - The editor is fully controlled: value comes from props, changes
          go back up via onChange (standard React controlled component pattern)
      */}
      <MonacoEditor
        height="100%"
        language="yaml"
        theme="vs-dark"
        value={value || EXAMPLE_TEMPLATE}
        onChange={(v) => onChange(v ?? "")}
        options={{
          fontSize: 13,
          minimap: { enabled: false },   // Minimap takes space without adding value here
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          tabSize: 2,
          automaticLayout: true,         // Resizes when the panel resizes
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------
// Using plain style objects keeps this component self-contained.
// In a larger project you'd use CSS Modules or a styling library.
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--bg-surface)",
    borderRight: "1px solid var(--border)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  title: {
    fontWeight: 600,
    fontSize: 13,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  button: {
    padding: "6px 14px",
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    transition: "background 0.15s",
  },
};
