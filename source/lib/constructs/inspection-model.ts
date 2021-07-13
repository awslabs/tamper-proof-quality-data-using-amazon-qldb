// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import { CfnTopicRule } from '@aws-cdk/aws-iot';
import { LambdaFunction } from './lambda-function';

interface InspectionModelProps {
  ledgerArn: string;
  ledgerName: string;
  tableName: string;
  role: iam.Role;
}

export class InspectionModel extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: InspectionModelProps) {
    super(scope, id);

    const lambda = new LambdaFunction(this, `${id}-lambda`, {
      functionName: 'InspectionModelLambda',
      entry: './lambda/inspectionModel.js',
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

    const rule = new CfnTopicRule(this, `${id}-iotcore-rule`, {
      ruleName: 'InspectionModelIoTCoreRule',
      topicRulePayload: {
        actions: [
          {
            lambda: {
              functionArn: lambda.func.functionArn
            }
          }
        ],
        awsIotSqlVersion: '2016-03-23',
        ruleDisabled: false,
        sql: "SELECT * FROM 'iot/inspectionmodel'"
      }
    });

    props.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iot:Publish'],
        effect: iam.Effect.ALLOW,
        resources: [cdk.Stack.of(this).formatArn({ service: 'iot', resource: 'topic', resourceName: 'iot/inspectionmodel' })]
      })
    );

    lambda.func.addPermission(`${id}-iot-invoke`, {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: rule.attrArn
    });
  }
}
