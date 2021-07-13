// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as cdk from '@aws-cdk/core';
import { Qldb } from './constructs/qldb';
import { InspectionCamera } from './constructs/inspection-camera';
import { InspectionModel } from './constructs/inspection-model';
import { ReflowOven } from './constructs/reflow-oven';
import { Vpc } from './constructs/vpc';
import { Role } from './constructs/role';

interface SolutionStackProps extends cdk.StackProps {
  ledgerName: string;
  ledgerTableName: string;
}

const SESSION_NAME = 'DeviceSession';

export class SolutionStack extends cdk.Stack {
  private clientRole: Role;

  constructor(scope: cdk.Construct, id: string, props: SolutionStackProps) {
    super(scope, id, props);

    new cdk.CfnMapping(this, `Solution`, {
      mapping: {
        Data: {
          SendAnonymousUsageData: 'Yes'
        }
      }
    });

    this.clientRole = new Role(this, 'Role');
    const vpc = new Vpc(this, 'VPC');

    const qldb = new Qldb(this, 'QLDB', {
      ledgerName: props.ledgerName
    });

    new InspectionCamera(this, 'InspectionCamera', {
      ledgerArn: qldb.ledgerArn,
      ledgerName: props.ledgerName,
      tableName: props.ledgerTableName,
      sessionArn: this.sessionArn,
      role: this.clientRole.role,
      vpc: vpc.vpc
    });

    new InspectionModel(this, 'InspectionModel', {
      ledgerArn: qldb.ledgerArn,
      ledgerName: props.ledgerName,
      tableName: props.ledgerTableName,
      role: this.clientRole.role
    });

    new ReflowOven(this, 'ReflowOven', {
      ledgerArn: qldb.ledgerArn,
      ledgerName: props.ledgerName,
      tableName: props.ledgerTableName,
      sessionArn: this.sessionArn,
      vpc: vpc.vpc,
      role: this.clientRole.role
    });

    {
      const logRetentionHandler = this.node.findChild('LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a');
      // id is defined here:
      // https://github.com/aws/aws-cdk/blob/7966f8d48c4bff26beb22856d289f9d0c7e7081d/packages/%40aws-cdk/aws-logs/lib/log-retention.ts
      (logRetentionHandler.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
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

      (logRetentionHandler.node.findChild('ServiceRole').node.findChild('DefaultPolicy').node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
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

  get sessionArn(): string {
    return `arn:aws:sts::${this.account}:assumed-role/${this.clientRole.role.roleName}/${SESSION_NAME}`;
  }
}
