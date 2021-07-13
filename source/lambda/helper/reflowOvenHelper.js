// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const qldb = require('../lib/qldb');
const reflowOven = (module.exports = {});

reflowOven.validatePostParameter = (doc) => {
  if (!(typeof doc.serialNumber === 'string' && typeof doc.factoryId === 'string' && typeof doc.lineId === 'string')) {
    throw new Error("'serialNumber', 'factoryId' and 'lineId' should all exist, and to be 'string', 'string' and 'string' respectively");
  }
};

reflowOven.validatePostDuplication = async (txn, doc) => {
  const stmt = `SELECT * FROM ${process.env.TABLE_NAME} AS q WHERE q.serialNumber = ?`;
  const res = await txn.execute(stmt, doc.serialNumber);
  if (res['_resultList'].length !== 0) {
    throw new Error('The same serial number already exist');
  }
};

reflowOven.createProduct = async (body) => {
  return qldb.executeLambda(async (txn) => {
    const doc = {
      serialNumber: body.serialNumber,
      factoryId: body.factoryId,
      lineId: body.lineId,
      data: {
        inspectionCamera: {},
        inspectionModel: {},
        reflowOven: {}
      }
    };

    reflowOven.validatePostParameter(doc);
    await reflowOven.validatePostDuplication(txn, doc);

    const stmt = `INSERT INTO ${process.env.TABLE_NAME} ?`;
    const res = await txn.execute(stmt, doc);
    return res.getResultList();
  });
};

reflowOven.updateProduct = async (serialNumber, body) => {
  return qldb.executeLambda(async (txn) => {
    const stmt = `UPDATE ${process.env.TABLE_NAME} AS q SET q.data.reflowOven = ? WHERE q.serialNumber = ?`;
    const res = await txn.execute(stmt, body, serialNumber);
    return res.getResultList();
  });
};
