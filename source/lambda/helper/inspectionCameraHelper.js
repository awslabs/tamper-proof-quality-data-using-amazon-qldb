// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const path = require('path');
const AWS = require('aws-sdk');
AWS.config.update({ region: process.env.AWS_REGION });
if (process.env.SEND_ANONYMOUS_DATA == 'Yes') {
  AWS.config.update({ customUserAgent: process.env.CUSTOM_USER_AGENT });
}

const qldb = require('../lib/qldb');
const crypto = require('crypto');

const inspectionCamera = (module.exports = {});

inspectionCamera.getHash = async (params) => {
  const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
  const data = await s3.getObject(params).promise();
  return crypto.createHash('md5').update(data.Body).digest('hex'); //NOSONAR
};

inspectionCamera.main = async (bucketName, key) => {
  const serialNumber = path.basename(key, path.extname(key));
  const url = `s3://${bucketName}/${key}`;

  const hash = await inspectionCamera.getHash({
    Bucket: bucketName,
    Key: key
  });

  return qldb.executeLambda(async (txn) => {
    const stmt = `UPDATE ${process.env.TABLE_NAME} AS q SET q.data.inspectionCamera.url = ?, q.data.inspectionCamera.hash = ? WHERE q.serialNumber = ?`;
    const res = await txn.execute(stmt, url, hash, serialNumber);
    return res.getResultList();
  });
};
