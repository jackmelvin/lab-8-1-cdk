import * as cdk from "aws-cdk-lib";
import {
  aws_autoscaling as autoscaling,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export interface ASGStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  instanceAmiId: string;
  instanceKeyPairName: string;
  instanceType: ec2.InstanceType;
  sshLocation: string;
}

export class ASGStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ASGStackProps) {
    super(scope, id, props);

    // Security Group for the load balancer
    const loadBalancerSecurityGroup = new ec2.SecurityGroup(
      this,
      "LoadBalancerSG",
      {
        vpc: props.vpc,
        description: "Allows inbound traffic on port 80",
        allowAllOutbound: true,
      }
    );

    loadBalancerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP traffic from anywhere"
    );

    // Security Group for EC2 instances
    const instanceSecurityGroup = new ec2.SecurityGroup(this, "InstanceSG", {
      vpc: props.vpc,
      description: "Enable SSH access and HTTP from the load balancer only",
      allowAllOutbound: true,
    });

    instanceSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.sshLocation),
      ec2.Port.tcp(22),
      "Allow SSH access from anywhere"
    );
    instanceSecurityGroup.addIngressRule(
      loadBalancerSecurityGroup,
      ec2.Port.tcp(80),
      "Allow HTTP traffic from Load Balancer"
    );

    // Launch Template
    const launchTemplate = new ec2.LaunchTemplate(this, "LaunchTemplate", {
      launchTemplateName: `${this.stackName}-LaunchTemplate`,
      machineImage: ec2.MachineImage.genericLinux({
        "us-east-1": props.instanceAmiId,
      }), // Use the provided AMI ID
      instanceType: props.instanceType,
      securityGroup: instanceSecurityGroup,
      keyName: props.instanceKeyPairName,
    });

    // Load Balancer
    const loadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "LoadBalancer",
      {
        vpc: props.vpc,
        internetFacing: true,
        securityGroup: loadBalancerSecurityGroup,
      }
    );

    // Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: "/",
      },
    });

    // Listener
    loadBalancer.addListener("Listener", {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    // Auto Scaling Group
    const asg = new autoscaling.AutoScalingGroup(this, "ASG", {
      vpc: props.vpc,
      launchTemplate: launchTemplate,
      minCapacity: 1,
      maxCapacity: 3,
      desiredCapacity: 1,
    });

    // Add ASG to Target Group
    targetGroup.addTarget(asg);

    // Scaling Policies
    asg.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 50,
      cooldown: cdk.Duration.seconds(60),
    });

    // Output Load Balancer URL
    new cdk.CfnOutput(this, "LoadBalancerDNS", {
      value: `http://${loadBalancer.loadBalancerDnsName}`,
      description: "The URL of the website",
      exportName: "LoadBalancerDNS",
    });
  }
}
