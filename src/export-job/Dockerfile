# Use an official Python runtime
FROM python:3.11-slim

# Set workdir
WORKDIR /app

# Copy script
COPY index.py .

# Install AWS SDK
RUN pip install boto3

# Default command
CMD ["python", "index.py"]
