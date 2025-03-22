import { Stack, StackProps, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import S3Bucket from "./constructors/S3Bucket";
import VPC from "./constructors/VPC";
import Fargate from "./constructors/Fargate";
import Lambda from "./constructors/Lambda";

export class DynamoDBMigrationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ENVs
    const EXPORT_TABLE_NAME = process.env.EXPORT_TABLE_NAME!;
    const EXPORT_TABLE_REGION = process.env.EXPORT_TABLE_REGION!;
    const IMPORT_TABLE_NAME = process.env.IMPORT_TABLE_NAME!;
    const IMPORT_TABLE_REGION = process.env.IMPORT_TABLE_REGION!;
    const TOTAL_SEGMENTS = process.env.TOTAL_SEGMENTS!;

    if (!EXPORT_TABLE_NAME) throw new Error("EXPORT_TABLE_NAME is required");
    if (!IMPORT_TABLE_NAME) throw new Error("IMPORT_TABLE_NAME is required");
    if (!TOTAL_SEGMENTS) throw new Error("TOTAL_SEGMENTS is required");

    const dataBucket = new S3Bucket(this, "DataBucket");
    const { cluster, securityGroup, subnetIds } = new VPC(this, "VPC");

    const { taskDefinition: exportJobTaskDef, container: exportJobContainer } = new Fargate(
      this,
      "ExportJob",
      { bucket: dataBucket.bucket, jobName: "export-job" }
    );
    const { taskDefinition: importJobTaskDef, container: importJobContainer } = new Fargate(
      this,
      "ImportJob",
      { bucket: dataBucket.bucket, jobName: "import-job" }
    );

    // export job starter lambda
    const { lambda: exportJobLambda } = new Lambda(this, "exportJobLambda", {
      entry: "src/exportJobLambda.ts",
      name: "export-job",
      description: "Lambda to kick-off dynamoDB migration export job",
      lambdaEnvironment: {
        TASK_DEFINITION_ARN: exportJobTaskDef.taskDefinitionArn,
        CONTAINER_NAME: exportJobContainer.containerName,
        CLUSTER_ARN: cluster.clusterArn,
        SUBNETS: subnetIds.join(","),
        SECURITY_GROUP: securityGroup.securityGroupId,
        BUCKET_NAME: dataBucket.bucket.bucketName,
        TABLE_NAME: EXPORT_TABLE_NAME,
        REGION: EXPORT_TABLE_REGION,
        TOTAL_SEGMENTS,
      },
      timeout: 5,
    });
    exportJobTaskDef.grantRun(exportJobLambda);

    // import job starter lambda
    const { lambda: importJobLambda } = new Lambda(this, "importJobLambda", {
      entry: "src/importJobLambda.ts",
      name: "import-job",
      description: "Lambda to kick-off dynamoDB migration import job",
      lambdaEnvironment: {
        TASK_DEFINITION_ARN: importJobTaskDef.taskDefinitionArn,
        CONTAINER_NAME: importJobContainer.containerName,
        CLUSTER_ARN: cluster.clusterArn,
        SUBNETS: subnetIds.join(","),
        SECURITY_GROUP: securityGroup.securityGroupId,
        BUCKET_NAME: dataBucket.bucket.bucketName,
        S3_PREFIX: "dump/", // Update this if export job changes
        TABLE_NAME: IMPORT_TABLE_NAME,
        REGION: IMPORT_TABLE_REGION,
      },
      timeout: 5,
    });
    dataBucket.bucket.grantRead(importJobLambda);
    importJobTaskDef.grantRun(importJobLambda);
  }
}
