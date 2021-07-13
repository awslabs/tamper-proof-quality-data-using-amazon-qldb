// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const { QldbDriver, RetryConfig } = require('amazon-qldb-driver-nodejs');
const https = require('https');

const serviceConfigurationOptions = {
  region: process.env.AWS_REGION,
  httpOptions: {
    agent: new https.Agent({
      keepAlive: true
    })
  }
};

module.exports = new QldbDriver(process.env.LEDGER_NAME, serviceConfigurationOptions, 0, new RetryConfig(4));
