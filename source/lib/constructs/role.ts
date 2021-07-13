// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';

export class Role extends cdk.Construct {
  public readonly role: iam.Role;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    this.role = new iam.Role(this, `${id}-role`, {
      roleName: 'TamperProofQualityDataClientRole',
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')]
    });

    new iam.CfnInstanceProfile(this, `${id}-instance-profile`, {
      roles: [this.role.roleName]
    });

    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole', 'iam:GetRole'],
        resources: [this.role.roleArn],
        effect: iam.Effect.ALLOW
      })
    );

    {
      // CFN NAG SUPPRESSIONS
      (this.role.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: 'W28',
              reason: 'This role use for demonstration'
            }
          ]
        }
      };
    }
  }
}
