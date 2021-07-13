// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { CfnLedger } from '@aws-cdk/aws-qldb';
import * as cdk from '@aws-cdk/core';

interface QldbProps {
  ledgerName: string;
}

export class Qldb extends cdk.Construct {
  public readonly ledger: CfnLedger;
  public readonly ledgerArn: string;

  constructor(scope: cdk.Construct, id: string, props: QldbProps) {
    super(scope, id);

    this.ledger = new CfnLedger(this, `${id}-qldb`, {
      permissionsMode: 'ALLOW_ALL',
      name: props.ledgerName
    });

    this.ledgerArn = cdk.Stack.of(this).formatArn({
      service: 'qldb',
      resource: 'ledger',
      resourceName: props.ledgerName
    });
  }
}
