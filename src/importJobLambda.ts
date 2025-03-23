import { S3Client, ListObjectsV2Command, ListObjectsV2Output } from "@aws-sdk/client-s3";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";

const s3 = new S3Client({});
const ecs = new ECSClient({});

// Helper to chunk an array into batches of size `size`
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export const handler = async () => {
  const {
    TASK_DEFINITION_ARN,
    CONTAINER_NAME,
    CLUSTER_ARN,
    SUBNETS,
    SECURITY_GROUP,
    BUCKET_NAME,
    S3_PREFIX,
    TABLE_NAME,
    REGION,
  } = process.env;

  if (!TASK_DEFINITION_ARN) throw new Error("Missing TASK_DEFINITION_ARN");
  if (!CONTAINER_NAME) throw new Error("Missing CONTAINER_NAME");
  if (!CLUSTER_ARN) throw new Error("Missing CLUSTER_ARN");
  if (!SUBNETS) throw new Error("Missing SUBNETS");
  if (!SECURITY_GROUP) throw new Error("Missing SECURITY_GROUP");
  if (!BUCKET_NAME) throw new Error("Missing BUCKET_NAME");
  if (!S3_PREFIX) throw new Error("Missing S3_PREFIX");
  if (!TABLE_NAME) throw new Error("Missing TABLE_NAME");
  if (!REGION) throw new Error("Missing REGION");

  const subnetList = SUBNETS.split(",");

  const allKeys: string[] = [];

  let continuationToken: string | undefined = undefined;

  do {
    const listResp: ListObjectsV2Output = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: S3_PREFIX,
        ContinuationToken: continuationToken,
      })
    );

    const keys = listResp.Contents?.map((obj) => obj.Key!).filter(Boolean) ?? [];
    allKeys.push(...keys);
    continuationToken = listResp.IsTruncated ? listResp.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`Found ${allKeys.length} keys in s3://${BUCKET_NAME}/${S3_PREFIX}`);

  const batches = chunkArray(allKeys, 3);

  const taskPromises = batches.map((batch) => {
    const command = new RunTaskCommand({
      taskDefinition: TASK_DEFINITION_ARN,
      launchType: "FARGATE",
      cluster: CLUSTER_ARN,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: subnetList,
          assignPublicIp: "ENABLED",
          securityGroups: [SECURITY_GROUP],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: CONTAINER_NAME,
            environment: [
              { name: "S3_KEYS", value: batch.join(",") },
              { name: "BUCKET_NAME", value: BUCKET_NAME },
              { name: "TABLE_NAME", value: TABLE_NAME },
              { name: "REGION", value: REGION },
            ],
          },
        ],
      },
    });

    return ecs.send(command);
  });

  await Promise.all(taskPromises);
  console.log("All tasks have been started");
};
