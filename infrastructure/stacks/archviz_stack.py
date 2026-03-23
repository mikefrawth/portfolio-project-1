"""
ArchViz CDK Stack
==================
This file defines ALL the AWS resources for the ArchViz application.
CDK will synthesize this into a CloudFormation template and deploy it.

Resources created:
  1. DynamoDB Table         — stores saved diagrams
  2. Lambda Function        — runs the Python/FastAPI backend
  3. API Gateway (HTTP API) — routes HTTP requests to Lambda
  4. S3 Bucket              — hosts the compiled React frontend
  5. CloudFront Distribution — CDN that serves the frontend globally
                              and proxies /api/* to API Gateway

Architecture overview:

  Browser
    │
    ├─► CloudFront (CDN)
    │       ├─► S3 (for / static files)
    │       └─► API Gateway (for /api/* requests)
    │                   │
    │                   └─► Lambda (FastAPI backend)
    │                               │
    │                               └─► DynamoDB (saved diagrams)
    │
    └── All traffic goes through CloudFront, even API calls.
        This means one domain for everything — no CORS issues in production.
"""

import os
import aws_cdk as cdk
from aws_cdk import (
    Stack,
    RemovalPolicy,
    CfnOutput,
    Duration,
    aws_dynamodb as dynamodb,
    aws_lambda as lambda_,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as integrations,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_iam as iam,
)
from constructs import Construct


class ArchVizStack(Stack):
    """
    A CDK Stack is a deployable unit — everything defined inside this class
    becomes a single CloudFormation stack. Resources can reference each other
    directly using Python variables (CDK resolves the references at synth time).
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        # ──────────────────────────────────────────────────────────────────
        # 1. DynamoDB Table
        # ──────────────────────────────────────────────────────────────────
        # DynamoDB is AWS's managed NoSQL key-value database.
        # It's serverless — you pay per read/write, not per hour.
        # Perfect for storing diagram documents (JSON blobs).
        #
        # PAY_PER_REQUEST (On-Demand) billing means:
        #   - No capacity planning needed
        #   - $0 when idle (good for a portfolio project)
        #   - Automatically scales on traffic spikes
        diagrams_table = dynamodb.Table(
            self,
            "DiagramsTable",
            table_name="archviz-diagrams",
            # partition_key is the primary key — every item must have this attribute
            # We use 'id' (a UUID string) as our partition key
            partition_key=dynamodb.Attribute(
                name="id",
                type=dynamodb.AttributeType.STRING,
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            # DESTROY means CDK will delete this table when we run `cdk destroy`.
            # Use RETAIN in production so you don't accidentally lose data.
            removal_policy=RemovalPolicy.DESTROY,
        )

        # ──────────────────────────────────────────────────────────────────
        # 2. Lambda Function
        # ──────────────────────────────────────────────────────────────────
        # The Lambda function runs our FastAPI backend.
        # We use a Docker container image because we have Python dependencies
        # (FastAPI, PyYAML, boto3) that are easier to bundle as a container
        # than as a Lambda layer.
        #
        # The Dockerfile will:
        #   1. Start from the AWS Lambda Python 3.12 base image
        #   2. Copy our backend/ code
        #   3. pip install requirements.txt
        #   4. Set the handler to app.main.handler (the Mangum adapter)
        backend_function = lambda_.DockerImageFunction(
            self,
            "BackendFunction",
            function_name="archviz-backend",
            # DockerImageCode.from_image_asset tells CDK to:
            #   1. Build the Docker image from backend/ directory
            #   2. Push it to ECR (AWS's container registry)
            #   3. Configure Lambda to run that image
            code=lambda_.DockerImageCode.from_image_asset(
                os.path.join(os.path.dirname(__file__), "../../backend")
            ),
            # Memory and timeout — tune these based on real usage
            # The CF parser is CPU-light, 512MB is plenty
            memory_size=512,
            timeout=Duration.seconds(30),
            # Environment variables are injected into the Lambda runtime
            # The FastAPI app reads these with os.environ.get(...)
            environment={
                "DIAGRAMS_TABLE_NAME": diagrams_table.table_name,
                "AWS_ACCOUNT_ID": self.account,
                # CORS_ORIGINS will be updated to the CloudFront URL after deploy.
                # We set a placeholder here; update it in a second deploy or
                # pass it as a CDK context variable.
                "CORS_ORIGINS": self.node.try_get_context("frontend_url") or "*",
            },
        )

        # Grant the Lambda function permission to read/write the DynamoDB table.
        # CDK generates the least-privilege IAM policy automatically.
        # This is the "principle of least privilege" — Lambda can only touch
        # this specific table, nothing else.
        diagrams_table.grant_read_write_data(backend_function)

        # ──────────────────────────────────────────────────────────────────
        # 3. API Gateway (HTTP API)
        # ──────────────────────────────────────────────────────────────────
        # API Gateway sits in front of Lambda and handles:
        #   - HTTP routing (which URL paths trigger which Lambda)
        #   - Request/response format translation
        #   - TLS termination (HTTPS)
        #   - Throttling and quotas
        #
        # We use HTTP API (v2) rather than REST API (v1) because:
        #   - Lower latency (~60% faster cold starts)
        #   - Simpler configuration for Lambda integrations
        #   - Cheaper ($1/million requests vs $3.50/million)
        http_api = apigwv2.HttpApi(
            self,
            "HttpApi",
            api_name="archviz-api",
            # CORS is configured here too (belt and suspenders with FastAPI's middleware)
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_origins=["*"],      # Tightened to CloudFront URL post-deploy
                allow_methods=[apigwv2.CorsHttpMethod.ANY],
                allow_headers=["*"],
            ),
        )

        # Wire all routes to our Lambda function.
        # The catch-all route {proxy+} means "match any path".
        # FastAPI (via Mangum) handles the internal routing.
        lambda_integration = integrations.HttpLambdaIntegration(
            "LambdaIntegration",
            backend_function,
        )
        http_api.add_routes(
            path="/{proxy+}",
            methods=[apigwv2.HttpMethod.ANY],
            integration=lambda_integration,
        )

        # ──────────────────────────────────────────────────────────────────
        # 4. S3 Bucket — frontend static hosting
        # ──────────────────────────────────────────────────────────────────
        # S3 stores our compiled React app (HTML, JS, CSS files).
        # The bucket is NOT public — CloudFront is the only thing that can
        # read from it. This is more secure than enabling public website hosting.
        frontend_bucket = s3.Bucket(
            self,
            "FrontendBucket",
            bucket_name=f"archviz-frontend-{self.account}-{self.region}",
            # Block all public access — CloudFront uses an OAC (Origin Access Control)
            # to access the bucket without making it public
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,   # Empty the bucket before deleting it
        )

        # ──────────────────────────────────────────────────────────────────
        # 5. CloudFront Distribution
        # ──────────────────────────────────────────────────────────────────
        # CloudFront is AWS's CDN (Content Delivery Network).
        # It has 400+ edge locations globally — users get the frontend
        # served from the nearest location, not from us-east-1.
        #
        # Our distribution has two origins:
        #   a) S3 bucket  — serves / (the React SPA)
        #   b) API Gateway — serves /api/* (the backend)
        #
        # This single-domain setup means:
        #   - No CORS issues (frontend and API are on the same domain)
        #   - One HTTPS certificate covers everything
        #   - API responses can be cached at the edge if needed

        # Origin Access Control allows CloudFront to read from the private S3 bucket
        oac = cloudfront.S3OriginAccessControl(
            self,
            "FrontendOAC",
            description="ArchViz frontend bucket OAC",
        )

        distribution = cloudfront.Distribution(
            self,
            "Distribution",
            comment="ArchViz CloudFront distribution",
            # Default behavior: serve the React app from S3
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(
                    frontend_bucket,
                    origin_access_control=oac,
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            # Additional behavior: proxy /api/* to API Gateway
            additional_behaviors={
                "/api/*": cloudfront.BehaviorOptions(
                    origin=origins.HttpOrigin(
                        # Strip "https://" from the API Gateway URL to get just the host
                        f"{http_api.api_id}.execute-api.{self.region}.amazonaws.com",
                    ),
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    # API responses must NOT be cached — always hit the backend
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                    origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                ),
            },
            # React Router uses client-side routing — if a user refreshes on
            # /diagram/123, CloudFront would get a 403/404 from S3.
            # We catch these and redirect to index.html so React Router takes over.
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_page_path="/index.html",
                    response_http_status=200,
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_page_path="/index.html",
                    response_http_status=200,
                ),
            ],
            default_root_object="index.html",
        )

        # ──────────────────────────────────────────────────────────────────
        # 6. Deploy frontend build to S3
        # ──────────────────────────────────────────────────────────────────
        # BucketDeployment uploads files from a local directory to S3 and
        # invalidates the CloudFront cache so users get the new version.
        # This runs as part of `cdk deploy` — no separate upload step needed.
        #
        # NOTE: The frontend must be built BEFORE running `cdk deploy`.
        # Run: cd frontend && npm run build
        # This creates frontend/dist/ which is what we upload here.
        s3deploy.BucketDeployment(
            self,
            "FrontendDeployment",
            sources=[
                s3deploy.Source.asset(
                    os.path.join(os.path.dirname(__file__), "../../frontend/dist")
                )
            ],
            destination_bucket=frontend_bucket,
            # Invalidate the CloudFront cache after upload so users get fresh files
            distribution=distribution,
            distribution_paths=["/*"],
        )

        # ──────────────────────────────────────────────────────────────────
        # 7. Stack Outputs
        # ──────────────────────────────────────────────────────────────────
        # CfnOutput prints values to the terminal after `cdk deploy` completes.
        # These are also visible in the CloudFormation console.
        CfnOutput(
            self, "FrontendUrl",
            value=f"https://{distribution.distribution_domain_name}",
            description="ArchViz frontend URL (CloudFront)",
        )
        CfnOutput(
            self, "ApiUrl",
            value=http_api.url or "",
            description="API Gateway URL (direct, bypasses CloudFront)",
        )
        CfnOutput(
            self, "DynamoTableName",
            value=diagrams_table.table_name,
            description="DynamoDB table for saved diagrams",
        )
