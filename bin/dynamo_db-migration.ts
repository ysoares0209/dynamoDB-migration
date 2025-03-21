#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DynamoDbMigrationStack } from "../lib/dynamo_db-migration-stack";

const app = new cdk.App();

new DynamoDbMigrationStack(app, "DynamoDbMigrationStack", {});
