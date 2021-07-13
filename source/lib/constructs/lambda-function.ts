// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaNodejs from '@aws-cdk/aws-lambda-nodejs';
import * as logs from '@aws-cdk/aws-logs';
import { version } from '../../package.json';

interface LambdaFunctionProps extends lambdaNodejs.NodejsFunctionProps {
  functionName: string;
  entry: string;
  handler: string;
}

export class LambdaFunction extends cdk.Construct {
  public readonly func: lambdaNodejs.NodejsFunction;

  constructor(scope: cdk.Construct, id: string, props: LambdaFunctionProps) {
    super(scope, id);

    const defaultProps: lambdaNodejs.NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_14_X,
      timeout: cdk.Duration.minutes(1),
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        externalModules: ['aws-sdk', 'jest'],
        nodeModules: ['amazon-qldb-driver-nodejs', 'ion-js', 'jsbi']
      },
      logRetention: logs.RetentionDays.TEN_YEARS
    };

    this.func = new lambdaNodejs.NodejsFunction(this, props.functionName, {
      ...defaultProps,
      ...props,
      environment: {
        ...props.environment,
        SEND_ANONYMOUS_DATA: cdk.Fn.findInMap('Solution', 'Data', 'SendAnonymousUsageData'),
        CUSTOM_USER_AGENT: `AwsSolution/SO0172/${version}`
      }
    });

    {
      // CFN NAG SUPPRESSIONS
      (this.func.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
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

      const lambdaRolePolicy = this.func.role!.node.findChild('DefaultPolicy');
      (lambdaRolePolicy.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: 'W12',
              reason: 'We have not defined any specific tracing requirements, so leave it the default value.'
            }
          ]
        }
      };
    }
  }
}
