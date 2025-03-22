import { Construct } from "constructs";
import { RemovalPolicy, Duration } from "aws-cdk-lib";
import { Bucket, BucketEncryption, BlockPublicAccess } from "aws-cdk-lib/aws-s3";

export default class S3Bucket extends Construct {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.bucket = new Bucket(this, "DynamoDbMigrationDataBucket", {
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
  }
}
