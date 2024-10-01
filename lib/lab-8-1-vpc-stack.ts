import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ssm from "aws-cdk-lib/aws-ssm";

interface NetworkStackProps extends cdk.StackProps {
  vpcName: string;
}

export class VPCStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    // CIDR block mappings
    const vpcCidr = "10.0.0.0/16";

    // Create the VPC
    this.vpc = new ec2.Vpc(this, "VPC", {
      vpcName: props.vpcName,
      cidr: vpcCidr,
      maxAzs: 2,
      createInternetGateway: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `Lab-8-1-Public`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: `Lab-8-1-Private`,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Outputs;
    new cdk.CfnOutput(this, "VPCId", {
      description: "VPCId of VPC",
      value: this.vpc.vpcId,
      exportName: `VPCId`,
    });

    new cdk.CfnOutput(this, "PublicSubnet1", {
      description: "SubnetId of public subnet 1",
      value: this.vpc.publicSubnets[0].subnetId,
      exportName: `${cdk.Aws.REGION}-${cdk.Aws.STACK_NAME}-PublicSubnet1`,
    });

    new cdk.CfnOutput(this, "PublicSubnet2", {
      description: "SubnetId of public subnet 2",
      value: this.vpc.publicSubnets[1].subnetId,
      exportName: `${cdk.Aws.REGION}-${cdk.Aws.STACK_NAME}-PublicSubnet2`,
    });

    new cdk.CfnOutput(this, "PrivateSubnet1", {
      description: "SubnetId of private subnet 1",
      value: this.vpc.privateSubnets[0].subnetId,
      exportName: `${cdk.Aws.REGION}-${cdk.Aws.STACK_NAME}-PrivateSubnet1`,
    });

    new cdk.CfnOutput(this, "PrivateSubnet2", {
      description: "SubnetId of private subnet 2",
      value: this.vpc.privateSubnets[1].subnetId,
      exportName: `${cdk.Aws.REGION}-${cdk.Aws.STACK_NAME}-PrivateSubnet2`,
    });
  }
}
