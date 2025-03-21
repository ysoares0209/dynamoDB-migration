import { Stack, StackProps, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Bucket, BucketEncryption, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { Vpc, SecurityGroup } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, FargateTaskDefinition, LogDriver } from "aws-cdk-lib/aws-ecs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export class ExportStack extends Stack {
  public readonly dataBucket: Bucket;
  public readonly exportFargateTaskDefinition: FargateTaskDefinition;
  public readonly orchestratorLambda: NodejsFunction;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ENVs
    const EXPORT_TABLE_NAME = process.env.EXPORT_TABLE_NAME!;
    const TOTAL_SEGMENTS = process.env.TOTAL_SEGMENTS!;

    if (!EXPORT_TABLE_NAME) throw new Error("EXPORT_TABLE_NAME is required");
    if (!TOTAL_SEGMENTS) throw new Error("TOTAL_SEGMENTS is required");

    // CONSTANTS
    const DEFAULT_CPU = 2048;
    const DEFAULT_MEMORY_LIMIT_MIB = 4096;

    // Import dynamoDB table
    const exportTable = TableV2.fromTableName(this, "ExportTable", EXPORT_TABLE_NAME);

    // S3 bucket to store data
    this.dataBucket = new Bucket(this, "DynamoDbMigrationDataBucket", {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true, // require HTTPS for access
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL, // no public exposure
      lifecycleRules: [
        {
          id: "ExpireOldMigrationFiles",
          expiration: Duration.days(30), // auto-cleanup after 30 days
        },
      ],
    });

    // ECS tasks definition
    const vpc = Vpc.fromLookup(this, "DEFAULT_VPC", { isDefault: true });
    const cluster = new Cluster(this, "Cluster", { vpc });
    const securityGroup = new SecurityGroup(this, "MigrationSG", {
      vpc,
      allowAllOutbound: true,
      description: "Security group for migration tasks",
    });
    const subnetIds = vpc.publicSubnets.map((subnet) => subnet.subnetId);
    console.log(`Subnets: ${subnetIds.join(", ")}`);

    this.exportFargateTaskDefinition = new FargateTaskDefinition(this, "TaskDef", {
      cpu: DEFAULT_CPU,
      memoryLimitMiB: DEFAULT_MEMORY_LIMIT_MIB,
    });

    const mainContainer = this.exportFargateTaskDefinition.addContainer("AppContainer", {
      image: ContainerImage.fromAsset("./src/export-job"),
      logging: LogDriver.awsLogs({
        streamPrefix: "export-job-logs",
        logRetention: RetentionDays.TWO_WEEKS,
      }),
    });
    this.dataBucket.grantReadWrite(this.exportFargateTaskDefinition.taskRole);
    exportTable.grantReadData(this.exportFargateTaskDefinition.taskRole);

    // lambda to kick-off process
    this.orchestratorLambda = new NodejsFunction(this, "OrchestratorLambda", {
      entry: "src/importJobOrchestrator.ts",
      handler: "handler",
      functionName: "import-job-orchestrator",
      description: "Lambda to kick-off dynamoDB migration import job",
      runtime: Runtime.NODEJS_20_X,
      environment: {
        TASK_DEFINITION_ARN: this.exportFargateTaskDefinition.taskDefinitionArn,
        CONTAINER_NAME: mainContainer.containerName,
        CLUSTER_ARN: cluster.clusterArn,
        SUBNETS: subnetIds.join(","),
        SECURITY_GROUP: securityGroup.securityGroupId,
        BUCKET_NAME: this.dataBucket.bucketName,
        TABLE_NAME: EXPORT_TABLE_NAME,
        TOTAL_SEGMENTS,
      },
      logRetention: RetentionDays.TWO_WEEKS,
      timeout: Duration.seconds(5),
    });
    this.exportFargateTaskDefinition.grantRun(this.orchestratorLambda);
  }
}
