// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const qldb = require('./lib/qldb');

exports.handler = async (event, context) => {
  const data = await qldb.executeLambda(async (txn) => {
    const stmt = `UPDATE ${process.env.TABLE_NAME} AS q SET q.data.inspectionModel = ? WHERE q.serialNumber = ?`;
    const res = await txn.execute(stmt, event.data, event.serialNumber);
    return res.getResultList();
  });

  console.log(data);

  return data;
};
