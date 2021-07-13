// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const inspectionCameraHelper = require('./helper/inspectionCameraHelper');

exports.handler = async (event, context) => {
  try {
    const bucketName = event.Records[0].s3.bucket.name;
    const key = event.Records[0].s3.object.key;
    await inspectionCameraHelper.main(bucketName, key);
  } catch (err) {
    return { statusCode: 500, error: err.message };
  }
};
