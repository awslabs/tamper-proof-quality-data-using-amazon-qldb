/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import * as cdk from '@aws-cdk/core';
import { SolutionStack } from '../lib/solution-stack';
import { SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import { version } from '../package.json';

test('snapshot test', () => {
  const app = new cdk.App();
  const stack = new SolutionStack(app, 'SolutionStack', {
    ledgerName: 'ledgerNameTest',
    ledgerTableName: 'tableNameTest'
  });
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('Test to make sure the AWS Resource is there w/ proper configure', () => {
  const app = new cdk.App();
  const stack = new SolutionStack(app, 'SolutionStack', {
    ledgerName: 'ledgerNameTest',
    ledgerTableName: 'tableNameTest'
  });

  // Construct: VPC
  expect(stack).toHaveResource('AWS::EC2::VPC', {
    CidrBlock: '10.0.0.0/16',
    EnableDnsHostnames: true,
    EnableDnsSupport: true,
    InstanceTenancy: 'default'
  });

  // Construct: Qldb
  expect(stack).toHaveResource('AWS::QLDB::Ledger', {
    Name: 'ledgerNameTest',
    PermissionsMode: 'ALLOW_ALL'
  });

  // Construct: InspectionCamera
  expect(stack).toHaveResourceLike('AWS::Lambda::Function', {
    Runtime: 'nodejs14.x',
    Timeout: 60,
    Environment: {
      Variables: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        LEDGER_NAME: 'ledgerNameTest',
        TABLE_NAME: 'tableNameTest',
        CUSTOM_USER_AGENT: `AwsSolution/SO0172/${version}`
      }
    }
  });
  expect(stack).toHaveResource('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true
    }
  });
  expect(stack).toHaveResource('Custom::S3BucketNotifications');

  // Construct: InspectionModel
  expect(stack).toHaveResourceLike('AWS::Lambda::Function', {
    Runtime: 'nodejs14.x',
    Timeout: 60,
    Environment: {
      Variables: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        LEDGER_NAME: 'ledgerNameTest',
        TABLE_NAME: 'tableNameTest',
        CUSTOM_USER_AGENT: `AwsSolution/SO0172/${version}`
      }
    }
  });
  expect(stack).toHaveResource('AWS::IoT::TopicRule');

  // Construct: ReflowOven
  expect(stack).toHaveResourceLike('AWS::Lambda::Function', {
    Runtime: 'nodejs14.x',
    Timeout: 60,
    Environment: {
      Variables: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        LEDGER_NAME: 'ledgerNameTest',
        TABLE_NAME: 'tableNameTest',
        CUSTOM_USER_AGENT: `AwsSolution/SO0172/${version}`
      }
    }
  });
  expect(stack).toHaveResource('AWS::ApiGateway::RestApi');
  expect(stack).toHaveResource('AWS::ApiGateway::Stage');
  expect(stack).toHaveResource('AWS::EC2::VPCEndpoint');
});
