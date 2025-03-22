import { Construct } from "constructs";
import { Duration, Tags } from "aws-cdk-lib";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";

export interface Props {
  name: string;
  description: string;
  entry: string;
  runtime?: Runtime;
  lambdaEnvironment?: Record<string, string>;
  timeout?: number;
  memorySize?: number;
  logRetention?: RetentionDays;
  // add more as needed
}

export default class NodeJSLambda extends Construct {
  readonly lambda: NodejsFunction;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const {
      name,
      logRetention = RetentionDays.TWO_WEEKS,
      description,
      entry,
      runtime = Runtime.NODEJS_20_X,
      lambdaEnvironment = {},
      timeout = 3,
      memorySize = 128,
    } = props;

    this.lambda = new NodejsFunction(this, id, {
      entry,
      handler: "handler",
      functionName: `dynamoDBMigration-${name}`,
      description,
      runtime,
      logRetention,
      environment: lambdaEnvironment,
      timeout: Duration.seconds(timeout),
      memorySize,
    });
  }
}
