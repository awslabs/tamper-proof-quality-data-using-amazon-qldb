// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as apigateway from '@aws-cdk/aws-apigateway';
import { LambdaFunction } from './lambda-function';

interface ReflowOvenProps {
  ledgerArn: string;
  ledgerName: string;
  tableName: string;
  sessionArn: string;
  vpc: ec2.IVpc;
  role: iam.Role;
}

export class ReflowOven extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ReflowOvenProps) {
    super(scope, id);

    const vpcEndpointSecurityGroup = new ec2.SecurityGroup(this, `${id}-apigw-vpc-endpoint-sg`, {
      vpc: props.vpc,
      allowAllOutbound: false
    });

    vpcEndpointSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(443));
    vpcEndpointSecurityGroup.addEgressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(443));

    const vpcEndpoint = new ec2.InterfaceVpcEndpoint(this, `${id}-api-vpc-endpoint`, {
      vpc: props.vpc,
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      privateDnsEnabled: true,
      securityGroups: [vpcEndpointSecurityGroup]
    });

    const apiLogGroup = new logs.LogGroup(this, `${id}-api-log-group`, {
      retention: logs.RetentionDays.TEN_YEARS
    });

    const api = new apigateway.RestApi(this, `${id}-api`, {
      restApiName: 'LedgerSolutionAPI',
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup)
      },
      endpointTypes: [apigateway.EndpointType.PRIVATE],
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            effect: iam.Effect.ALLOW
          })
        ]
      })
    });

    api.addUsagePlan(`${id}-usage-plan`).addApiStage({
      stage: api.deploymentStage
    });

    vpcEndpoint.addToPolicy(
      new iam.PolicyStatement({
        principals: [new iam.ArnPrincipal(props.sessionArn), new iam.ArnPrincipal(props.role.roleArn)],
        actions: ['execute-api:Invoke'],
        effect: iam.Effect.ALLOW,
        resources: [cdk.Stack.of(this).formatArn({ service: 'execute-api', resource: api.restApiId, resourceName: '*' })]
      })
    );

    new cdk.CfnOutput(this, `${id}-api-endpoint`, {
      value: api.url
    });

    const lambda = new LambdaFunction(this, `${id}-lambda`, {
      functionName: 'ReflowOvenLambda',
      entry: './lambda/reflowOven.js',
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

    const validator = new apigateway.RequestValidator(this, `${id}-validator`, {
      restApi: api,
      validateRequestBody: true
    });

    const product = api.root.addResource('product');
    const createProductModel = api.addModel(`${id}-create-product-model`, {
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          serialNumber: {
            type: apigateway.JsonSchemaType.STRING
          },
          factoryId: {
            type: apigateway.JsonSchemaType.STRING
          },
          lineId: {
            type: apigateway.JsonSchemaType.STRING
          }
        },
        required: ['serialNumber', 'factoryId', 'lineId']
      }
    });
    const registerProductMethod = product.addMethod('POST', new apigateway.LambdaIntegration(lambda.func), {
      authorizationType: apigateway.AuthorizationType.IAM,
      requestValidator: validator,
      requestModels: {
        'application/json': createProductModel
      }
    });

    const serialNumber = product.addResource('{serialNumber}');
    const updateProductModel = api.addModel(`${id}-update-product-model`, {
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT
      }
    });
    const updateProductMethod = serialNumber.addMethod('PUT', new apigateway.LambdaIntegration(lambda.func), {
      authorizationType: apigateway.AuthorizationType.IAM,
      requestValidator: validator,
      requestModels: {
        'application/json': updateProductModel
      }
    });

    props.role.attachInlinePolicy(
      new iam.Policy(this, 'AllowRegisterProduct', {
        statements: [
          new iam.PolicyStatement({
            actions: ['execute-api:Invoke'],
            effect: iam.Effect.ALLOW,
            resources: [registerProductMethod.methodArn, updateProductMethod.methodArn]
          })
        ]
      })
    );

    {
      // CFN NAG SUPPRESSIONS
      (apiLogGroup.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
        cfn_nag: {
          rules_to_suppress: [
            {
              id: 'W84',
              reason: 'This logGroup is encrypted by the default master key.'
            }
          ]
        }
      };

      for (const method of api.methods) {
        (method.node.defaultChild as cdk.CfnResource).cfnOptions.metadata = {
          cfn_nag: {
            rules_to_suppress: [
              {
                id: 'W59',
                reason: "This api doesn't require authorization."
              }
            ]
          }
        };
      }
    }
  }
}
