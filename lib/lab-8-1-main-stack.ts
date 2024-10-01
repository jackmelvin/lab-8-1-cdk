import * as cdk from "aws-cdk-lib";
import { Stack, StackProps, CfnParameter, CfnOutput, Fn } from "aws-cdk-lib";
import { Construct } from "constructs";
import { VPCStack } from "./lab-8-1-vpc-stack";
import { ASGStack } from "./lab-8-1-asg-stack";
import { InstanceType, Vpc } from "aws-cdk-lib/aws-ec2";
import * as dotenv from "dotenv";

dotenv.config();

export class MainStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Environment variables
    const vpcName = process.env.VPC_NAME || "lab-8-1-vpc";
    const instanceKeyPairName =
      process.env.INSTANCE_KEY_PAIR_NAME || "lab-4-1-key-pair";
    const instanceAmiId =
      process.env.INSTANCE_AMI_ID || "ami-00889393050a8cd9b";
    const instanceType = process.env.INSTANCE_TYPE || "t2.micro";
    const sshLocation = process.env.SSH_LOCATION || "0.0.0.0/0";

    // Create the VPC Nested Stack
    const vpcStack = new VPCStack(this, "VpcStack", {
      vpcName: vpcName,
    });

    // Create the AutoScaling Nested Stack
    const asgStack = new ASGStack(this, "AutoScalingStack", {
      vpc: vpcStack.vpc,
      instanceKeyPairName: instanceKeyPairName,
      instanceAmiId: instanceAmiId,
      instanceType: new InstanceType(instanceType),
      sshLocation: sshLocation,
    });

    // Output the URL of the Load Balancer
    // new CfnOutput(this, "WebUrl", {
    //   description: "URL of the external load balancer of the web",
    //   value: Fn.importValue("LoadBalancerDNS"),
    // });
  }
}
