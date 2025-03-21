import os
import sys
import uuid
import boto3
import json
from botocore.exceptions import BotoCoreError, ClientError

# Validate required environment variables
REQUIRED_ENVS = ["BUCKET_NAME", "TABLE_NAME", "TOTAL_SEGMENTS", "SEGMENT"]

missing_envs = [env for env in REQUIRED_ENVS if not os.getenv(env)]
if missing_envs:
    print(f"Missing required environment variables: {', '.join(missing_envs)}")
    sys.exit(1)

# Read environment variables
BUCKET_NAME = os.getenv("BUCKET_NAME")
TABLE_NAME = os.getenv("TABLE_NAME")
TOTAL_SEGMENTS = int(os.getenv("TOTAL_SEGMENTS"))
SEGMENT = int(os.getenv("SEGMENT"))

# AWS clients
dynamodb = boto3.client("dynamodb")
s3 = boto3.client("s3")

def dump_to_s3(items):
    key = f"dump/{uuid.uuid4()}.json"
    try:
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=key,
            Body=json.dumps(items),
            ContentType="application/json"
        )
        print(f"segment {SEGMENT}/{TOTAL_SEGMENTS - 1} - Uploaded chunk to s3://{BUCKET_NAME}/{key} | items: {len(items)}")
    except (BotoCoreError, ClientError) as e:
        print(f"Failed to upload to S3: {str(e)}")

def scan_segment():
    items = []
    scanned_count = 0
    last_evaluated_key = None

    while True:
        print(f"Scanning segment {SEGMENT}/{TOTAL_SEGMENTS - 1} - current items: {scanned_count}")
        scan_kwargs = {
            "TableName": TABLE_NAME,
            "Segment": SEGMENT,
            "TotalSegments": TOTAL_SEGMENTS,
        }

        if last_evaluated_key:
            scan_kwargs["ExclusiveStartKey"] = last_evaluated_key

        try:
            response = dynamodb.scan(**scan_kwargs)
        except (BotoCoreError, ClientError) as e:
            print(f"Scan failed: {str(e)}")
            break

        scanned_count += response.get("ScannedCount", 0)
        items.extend(response.get("Items", []))

        # If we have more than 10K items, dump to S3 and reset
        if len(items) >= 10000:
            dump_to_s3(items[:10000])
            items = items[10000:]

        last_evaluated_key = response.get("LastEvaluatedKey")
        if not last_evaluated_key:
            print(f"Segment {SEGMENT}/{TOTAL_SEGMENTS - 1} - Done scanning")
            break

    # Final flush
    if items:
        dump_to_s3(items)

if __name__ == "__main__":
    print(f"Starting parallel scan on segment {SEGMENT}/{TOTAL_SEGMENTS - 1} for table {TABLE_NAME}")
    scan_segment()
