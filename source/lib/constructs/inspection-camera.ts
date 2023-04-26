// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as s3n from '@aws-cdk/aws-s3-notifications';
import { LambdaFunction } from './lambda-function';

interface InspectionCameraProps {
  ledgerArn: string;
  ledgerName: string;
  tableName: string;
  sessionArn: string;
  role: iam.Role;
  vpc: ec2.IVpc;
}

export class InspectionCamera extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: InspectionCameraProps) {
    super(scope, id);

    const logBucket = new s3.Bucket(this, `${id}-log-bucket`, {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    const bucket = new s3.Bucket(this, `${id}-bucket`, {
      versioned: true,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.KMS_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: 'inspectionCameraLog'
    });

    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      actions: ["s3:*"],
      principals: [new iam.AnyPrincipal()],
      resources: [
        bucket.bucketArn, bucket.bucketArn + '/*'
      ],
      conditions: {
        Bool: {
          "aws:SecureTransport": "false",
        },
      }
    }))

    const vpcEndpointSecurityGroup = new ec2.SecurityGroup(this, `${id}-s3-vpc-endpoint-sg`, {
      vpc: props.vpc,
      allowAllOutbound: false
    });

    vpcEndpointSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(443));
    vpcEndpointSecurityGroup.addEgressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(443));

    const vpcEndpoint = new ec2.InterfaceVpcEndpoint(this, `${id}-s3-vpc-endpoint`, {
      vpc: props.vpc,
      service: new ec2.InterfaceVpcEndpointAwsService('s3'),
      privateDnsEnabled: false,
      securityGroups: [vpcEndpointSecurityGroup]
    });

    props.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
        effect: iam.Effect.ALLOW,
        resources: [bucket.bucketArn + '/*'],
        conditions: {
          StringEquals: { 'aws:sourceVpce': vpcEndpoint.vpcEndpointId }
        }
      })
    );

    vpcEndpoint.addToPolicy(
      new iam.PolicyStatement({
        principals: [new iam.ArnPrincipal(props.sessionArn), new iam.ArnPrincipal(props.role.roleArn)],
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
        effect: iam.Effect.ALLOW,
        resources: [bucket.bucketArn + '/*']
      })
    );

    const lambda = new LambdaFunction(this, `${id}-lambda`, {
      functionName: 'InspectionCameraLambda',
      entry: './lambda/inspectionCamera.js',
      handler: 'handler',
      environment: {
        LEDGER_NAME: props.ledgerName,
        TABLE_NAME: props.tableName
      }
    });

    lambda.func.role!.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [props.ledgerArn],
        actions: ['qldb:SendCommand']
      })
    );

    bucket.grantRead(lambda.func);

    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(lambda.func));

    {
      // CFN NAG SUPPRESSIONS
      (logBucket.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: 'W51',
              reason: "This bucket doesn't need any bucket policy."
            },
            {
              id: 'W35',
              reason: 'This is a logs bucket, no logging desired.'
            }
          ]
        }
      };

      (bucket.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: 'W51',
              reason: "This bucket doesn't need any bucket policy."
            }
          ]
        }
      };

      // The logical id for the handler is defined here:
      // https://github.com/aws/aws-cdk/blob/master/packages/@aws-cdk/aws-s3/lib/notifications-resource/notifications-resource-handler.ts
      const root = cdk.Stack.of(this);
      const customHandler = root.node.findChild('BucketNotificationsHandler050a0587b7544547bf325f094a3db834');
      const customHandlerLambda = customHandler.node.findChild('Resource') as cdk.CfnResource;
      customHandlerLambda.cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: 'W58',
              reason: 'Invalid warning: function has access to cloudwatch'
            },
            {
              id: 'W89',
              reason: 'Invalid warning: function does not access VPC resources'
            },
            {
              id: 'W92',
              reason: 'We do not define any specific access amount, so leave it the default value.'
            }
          ]
        }
      };

      const customHandlerRole = customHandler.node.findChild('Role');
      const customHandlerPolicy = customHandlerRole.node.findChild('DefaultPolicy');
      (customHandlerPolicy.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: 'W12',
              reason: 'This policy is used for custom resource handler.'
            }
          ]
        }
      };
    }
  }
}
