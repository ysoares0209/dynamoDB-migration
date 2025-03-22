import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";

export const handler = async () => {
  const ecsClient = new ECSClient({});

  const TASK_DEFINITION_ARN = process.env.TASK_DEFINITION_ARN!;
  const CONTAINER_NAME = process.env.CONTAINER_NAME!;
  const CLUSTER_ARN = process.env.CLUSTER_ARN!;
  const SUBNETS = process.env.SUBNETS!.split(","); // Comma-separated in env
  const SECURITY_GROUP = process.env.SECURITY_GROUP!;
  const BUCKET_NAME = process.env.BUCKET_NAME!;
  const TABLE_NAME = process.env.TABLE_NAME!;
  const REGION = process.env.REGION!;
  const TOTAL_SEGMENTS = parseInt(process.env.TOTAL_SEGMENTS!);

  if (!TASK_DEFINITION_ARN) throw new Error("TASK_DEFINITION_ARN is required");
  if (!CONTAINER_NAME) throw new Error("CONTAINER_NAME is required");
  if (!CLUSTER_ARN) throw new Error("CLUSTER_ARN is required");
  if (!SUBNETS || !SUBNETS.length) throw new Error("SUBNETS is required");
  if (!SECURITY_GROUP) throw new Error("SECURITY_GROUP is required");
  if (!BUCKET_NAME) throw new Error("BUCKET_NAME is required");
  if (!TABLE_NAME) throw new Error("TABLE_NAME is required");
  if (!REGION) throw new Error("REGION is required");
  if (!TOTAL_SEGMENTS) throw new Error("TOTAL_SEGMENTS is required");

  console.log(`${TOTAL_SEGMENTS} tasks will be started`);

  const promises = [];
  for (let segment = 0; segment < TOTAL_SEGMENTS; segment++) {
    const command = new RunTaskCommand({
      taskDefinition: TASK_DEFINITION_ARN,
      launchType: "FARGATE",
      cluster: CLUSTER_ARN,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: SUBNETS,
          assignPublicIp: "ENABLED",
          securityGroups: [SECURITY_GROUP],
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: CONTAINER_NAME,
            environment: [
              { name: "BUCKET_NAME", value: BUCKET_NAME },
              { name: "TABLE_NAME", value: TABLE_NAME },
              { name: "REGION", value: REGION },
              { name: "TOTAL_SEGMENTS", value: TOTAL_SEGMENTS.toString() },
              { name: "SEGMENT", value: segment.toString() },
            ],
          },
        ],
      },
    });
    promises.push(ecsClient.send(command));
  }

  await Promise.all(promises);
  console.log("All tasks have been started");
};
