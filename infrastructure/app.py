#!/usr/bin/env python3
"""
CDK Application Entry Point
=============================
This file is the CDK "app" — the root of the infrastructure definition.
Running `cdk deploy` from the infrastructure/ directory executes this file,
which instantiates our stack and synthesizes it into a CloudFormation template.

CDK flow:
  Python code (this file + stacks/)
      → cdk synth → CloudFormation template (JSON)
         → cdk deploy → CloudFormation creates/updates real AWS resources

Why CDK over writing CloudFormation directly?
  - We write Python, CDK generates the CloudFormation
  - CDK handles boilerplate (IAM policies, logical IDs, exports)
  - We can use loops, conditionals, and variables — CF is just JSON/YAML
  - CDK Constructs are reusable components (like React components for infra)
"""
import aws_cdk as cdk
from stacks.archviz_stack import ArchVizStack

app = cdk.App()

ArchVizStack(
    app,
    "ArchVizStack",
    # env tells CDK which AWS account and region to deploy into.
    # cdk.Environment reads from your AWS CLI credentials / environment vars:
    #   AWS_ACCOUNT_ID and AWS_DEFAULT_REGION (or ~/.aws/credentials)
    env=cdk.Environment(
        account=app.node.try_get_context("account"),
        region=app.node.try_get_context("region") or "us-east-1",
    ),
    description="ArchViz — CloudFormation diagram generator (portfolio project)",
)

app.synth()
