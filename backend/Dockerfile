# ────────────────────────────────────────────────────────────────────────────
# Dockerfile for the ArchViz Lambda function
# ────────────────────────────────────────────────────────────────────────────
# AWS provides official base images for Lambda that include the Lambda runtime.
# We use the Python 3.12 image as our starting point.
#
# When Lambda runs a container image, it calls the CMD specified here.
# Mangum's handler (app.main.handler) receives the Lambda event and
# translates it into a FastAPI-compatible ASGI request.
# ────────────────────────────────────────────────────────────────────────────

FROM public.ecr.aws/lambda/python:3.12

# Set the working directory inside the container
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy dependency list first (before copying code).
# Docker caches each layer — if requirements.txt hasn't changed,
# Docker reuses the cached pip install layer, making rebuilds faster.
COPY requirements.txt .

# Install Python dependencies
# --no-cache-dir keeps the image size smaller (no pip cache stored)
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
# We copy after pip install so code changes don't invalidate the pip cache
COPY app/ ./app/

# Tell Lambda which function to invoke when a request arrives.
# Format: <module_path>.<function_name>
# app.main     → the file app/main.py
# handler      → the Mangum(app) instance at the bottom of main.py
CMD ["app.main.handler"]
