import os
import json
import boto3
import logging
import time
from typing import List

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
TABLE_NAME = os.environ.get("TABLE_NAME")
REGION = os.environ.get("REGION")
BUCKET_NAME = os.environ.get("BUCKET_NAME")

# AWS clients
s3 = boto3.client('s3')
ddb = boto3.client('dynamodb', region_name=REGION)

def chunked(iterable, size):
    for i in range(0, len(iterable), size):
        yield iterable[i:i + size]


def batch_write(items: List[dict]):
    request_items = [{"PutRequest": {"Item": item}} for item in items]

    unprocessed_items = request_items
    attempts = 0
    max_attempts = 10

    while unprocessed_items and attempts < max_attempts:
        attempts += 1
        logger.info(f"Batch write attempt {attempts}, {len(unprocessed_items)} items")

        response = ddb.batch_write_item(RequestItems={TABLE_NAME: unprocessed_items})
        unprocessed_items = response.get('UnprocessedItems', {}).get(TABLE_NAME, [])

        if unprocessed_items:
            logger.warning(f"{len(unprocessed_items)} items not processed, retrying...")
            time.sleep(2 ** attempts)  # exponential backoff
        else:
            logger.info("Batch write successful")

    if unprocessed_items:
        logger.error(f"Failed to write {len(unprocessed_items)} items after {attempts} attempts")



def process_file(s3_key: str):
    logger.info(f"Processing file: {s3_key}")

    response = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
    print(response)
    content = response['Body'].read()
    items = json.loads(content)

    logger.info(f"Loaded {len(items)} items from {s3_key}")

    for batch in chunked(items, 25):
        batch_write(batch)


def main():
    # Expect comma-separated S3 keys passed as env var
    file_list = os.environ.get("S3_KEYS")
    if not file_list:
        logger.error("Missing S3_KEYS environment variable")
        return

    s3_keys = file_list.split(',')
    logger.info(f"Starting import for {len(s3_keys)} files")

    for key in s3_keys:
        try:
            process_file(key.strip())
        except Exception as e:
            logger.exception(f"Error processing file {key}: {e}")


if __name__ == "__main__":
    main()
