#!/usr/bin/env node
import { config } from "dotenv";
config();

import * as cdk from "aws-cdk-lib";
import { DynamoDBMigrationStack } from "../lib/DynamoDBMigrationStack";

const app = new cdk.App();

new DynamoDBMigrationStack(app, "DynamoDBMigrationStack", {
  stackName: "DynamoDBMigrationStack",
  description: "Stack with responsible for migrating data between DynamoDB tables at scale",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
