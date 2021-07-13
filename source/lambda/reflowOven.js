// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const reflowOvenHelper = require('./helper/reflowOvenHelper');

exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);
    let data;

    if (event.httpMethod === 'POST') {
      data = await reflowOvenHelper.createProduct(body);
    } else if (event.httpMethod === 'PUT') {
      data = await reflowOvenHelper.updateProduct(event.pathParameters != null ? event.pathParameters.serialNumber : null, body);
    } else {
      throw new Error('unsupported http method');
    }

    console.log(data);
    return {
      statusCode: 200,
      body: JSON.stringify(data, null, 2),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }, null, 2),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
