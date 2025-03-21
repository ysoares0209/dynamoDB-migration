import { Stack, StackProps, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Bucket, BucketEncryption, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { ContainerImage, FargateTaskDefinition, LogDriver } from "aws-cdk-lib/aws-ecs";
import { Runtime, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, BundlingOptions } from "aws-cdk-lib/aws-lambda-nodejs";

export class ImportStack extends Stack {
  public readonly dataBucket: Bucket;
  public readonly importFargateTaskDefinition: FargateTaskDefinition;
  public readonly orchestratorLambda: NodejsFunction;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    
  }
}
