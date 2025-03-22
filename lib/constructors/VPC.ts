import { Construct } from "constructs";
import { Cluster } from "aws-cdk-lib/aws-ecs";
import { Vpc, IVpc, SecurityGroup } from "aws-cdk-lib/aws-ec2";

export default class VPC extends Construct {
  public readonly VPC: IVpc;
  public readonly cluster: Cluster;
  public readonly securityGroup: SecurityGroup;
  public readonly subnetIds: string[];

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.VPC = Vpc.fromLookup(this, "DEFAULT_VPC", { isDefault: true });
    this.cluster = new Cluster(this, "Cluster", { vpc: this.VPC });
    this.securityGroup = new SecurityGroup(this, "MigrationSG", {
      vpc: this.VPC,
      allowAllOutbound: true,
      description: "Security group for migration tasks",
    });
    this.subnetIds = this.VPC.publicSubnets.map((subnet) => subnet.subnetId);
  }
}
