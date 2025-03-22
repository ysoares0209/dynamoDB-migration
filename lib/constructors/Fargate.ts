import { Construct } from "constructs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import {
  ContainerImage,
  FargateTaskDefinition,
  ContainerDefinition,
  LogDriver,
} from "aws-cdk-lib/aws-ecs";

interface Props {
  bucket: Bucket;
  jobName: string;
}

export default class Fargate extends Construct {
  public readonly taskDefinition: FargateTaskDefinition;
  public readonly container: ContainerDefinition;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const { bucket, jobName } = props;

    // CONSTANTS
    const DEFAULT_CPU = 2048;
    const DEFAULT_MEMORY_LIMIT_MIB = 4096;

    this.taskDefinition = new FargateTaskDefinition(this, "TaskDef", {
      cpu: DEFAULT_CPU,
      memoryLimitMiB: DEFAULT_MEMORY_LIMIT_MIB,
    });
    this.container = this.taskDefinition.addContainer("AppContainer", {
      image: ContainerImage.fromAsset(`./src/${jobName}`),
      logging: LogDriver.awsLogs({
        streamPrefix: `${jobName}-logs`,
        logRetention: RetentionDays.TWO_WEEKS,
      }),
    });

    // Permissions
    const dynamoDBScan = new PolicyStatement({
      actions: ["dynamodb:Scan", "dynamodb:BatchWriteItem"],
      resources: [
        `arn:aws:dynamodb:*:*:table/${process.env.EXPORT_TABLE_NAME}`,
        `arn:aws:dynamodb:*:*:table/${process.env.IMPORT_TABLE_NAME}`,
      ],
    });
    this.taskDefinition.addToTaskRolePolicy(dynamoDBScan);
    bucket.grantReadWrite(this.taskDefinition.taskRole);
  }
}
