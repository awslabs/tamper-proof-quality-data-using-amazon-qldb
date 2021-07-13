// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as logs from '@aws-cdk/aws-logs';

export class Vpc extends cdk.Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, id, {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC
        },
        {
          cidrMask: 18,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE
        }
      ]
    });

    const flowLogLogGroup = new logs.LogGroup(this, `${id}-flowlog-log-group`, {
      retention: logs.RetentionDays.TEN_YEARS
    });

    const flowLog = new ec2.FlowLog(this, `${id}-flowlog`, {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogLogGroup)
    });

    (flowLog.logGroup?.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W84',
            reason: 'This logGroup is encrypted by the default master key.'
          }
        ]
      }
    };

    this.vpc.publicSubnets.forEach((subnet) => {
      const hs = subnet.node.defaultChild as cdk.CfnResource;
      hs.cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: 'W33',
              reason: 'This is a public subnet, MapPublicIpOnLaunch is expected.'
            }
          ]
        }
      };
    });
  }
}
