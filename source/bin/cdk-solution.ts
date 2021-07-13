#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { SolutionStack } from '../lib/solution-stack';

const app = new cdk.App();
const ledgerName: string = app.node.tryGetContext('ledgerName');
const ledgerTableName: string = app.node.tryGetContext('ledgerTableName');

new SolutionStack(app, 'tamper-proof-quality-data-using-amazon-qldb', {
  ledgerName,
  ledgerTableName
});
