#!/usr/bin/env node
import { config } from "dotenv";
config();

import * as cdk from "aws-cdk-lib";
import { ImportStack } from "../lib/importStack";
import { ExportStack } from "../lib/exportStack";

const app = new cdk.App();
const importTableRegion = app.node.tryGetContext("importTableRegion");
const exportTableRegion = app.node.tryGetContext("exportTableRegion");

if (!importTableRegion) throw new Error("importTableRegion is required");
if (!exportTableRegion) throw new Error("exportTableRegion is required");

new ExportStack(app, "DynamoDbMigrationExportStack", {
  stackName: "DynamoDbMigrationExportStack",
  description: "Stack with resources responsible for exporting data from dynamoDB to S3",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: exportTableRegion,
  },
});

new ImportStack(app, "DynamoDbMigrationImportStack", {
  stackName: "DynamoDbMigrationImportStack",
  description: "Stack with resources responsible for importing data from S3 to dynamoDB",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: importTableRegion,
  },
});
