import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";

interface EC2StackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  keyName: string;
  instanceType?: string;
  sourceCodeBucketName: string;
}

export class AMIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EC2StackProps) {
    super(scope, id, props);

    // Get the latest Amazon Linux 2 AMI ID from SSM Parameter Store
    const latestAmiId = ssm.StringParameter.valueForStringParameter(
      this,
      "/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2"
    );

    // Create a Security Group for the EC2 instance
    const securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc: new ec2.Vpc(this, "VPC", { maxAzs: 2, natGateways: 0 }),
      description: "Enable SSH and HTTP access",
      allowAllOutbound: true,
    });

    // Add ingress rules to the security group
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH access"
    );
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP access"
    );

    // IAM Role for EC2 with S3 read-only access
    const role = new iam.Role(this, "S3AccessRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess"),
      ],
    });

    // IAM Instance Profile
    const instanceProfile = new iam.CfnInstanceProfile(
      this,
      "InstanceProfile",
      {
        roles: [role.roleName],
      }
    );

    // User Data Script
    const userDataScript = `
      #!/bin/bash
      export HOME=~
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
      source ~/.bashrc
      nvm install 16
      nvm use 16
      cd ~/
      aws s3 cp s3://${props.sourceCodeBucketName}/web-tier/ web-tier --recursive
      cd ~/web-tier
      npm install 
      npm run build
      mkdir /var/www /var/www/html /var/www/html/web-tier
      cp -r ~/web-tier/build /var/www/html/web-tier/
      sudo amazon-linux-extras install nginx1 -y
      cd /etc/nginx
      sudo rm nginx.conf
      sudo aws s3 cp s3://${props.sourceCodeBucketName}/nginx.conf .
      sudo service nginx restart
      chown -R ec2-user /var/www/html/web-tier
      chmod -R 755 /var/www/html/web-tier
      sudo chkconfig nginx on
    `;

    // EC2 Instance
    const instance = new ec2.Instance(this, "EC2Instance", {
      vpc: props.vpc,
      instanceType: new ec2.InstanceType(props.instanceType || "t2.micro"),
      machineImage: ec2.MachineImage.genericLinux({ "us-east-1": latestAmiId }),
      securityGroup: securityGroup,
      keyName: props.keyName,
      role: role,
      userData: ec2.UserData.custom(userDataScript),
      instanceName: "WebServerInstance",
    });

    // Wait for instance to be ready before creating AMI
    const cfnInstance = instance.node.defaultChild as ec2.CfnInstance;
    cfnInstance.cfnOptions.creationPolicy = {
      resourceSignal: {
        count: 1,
        timeout: "PT15M",
      },
    };

    // Outputs
    new cdk.CfnOutput(this, "InstanceId", {
      value: instance.instanceId,
      description: "InstanceId of the newly created EC2 instance",
    });

    new cdk.CfnOutput(this, "AZ", {
      value: instance.instanceAvailabilityZone,
      description: "Availability Zone of the newly created EC2 instance",
    });

    new cdk.CfnOutput(this, "PublicDNS", {
      value: instance.instancePublicDnsName,
      description: "Public DNSName of the newly created EC2 instance",
    });

    new cdk.CfnOutput(this, "PublicIP", {
      value: instance.instancePublicIp,
      description: "Public IP address of the newly created EC2 instance",
    });
  }
}
