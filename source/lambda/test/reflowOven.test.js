// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const reflowOven = require('../reflowOven');
const reflowOvenHelper = require('../helper/reflowOvenHelper');
const qldb = require('../lib/qldb');

jest.mock('../lib/qldb');

beforeEach(() => {
  jest.resetAllMocks();
});

test('(NORMAL) validatePostParameter: no error', async () => {
  expect.assertions(1);

  const docTest = {
    serialNumber: 'serialNumber',
    factoryId: 'factoryId',
    lineId: 'lineId'
  };
  expect(reflowOvenHelper.validatePostParameter(docTest)).toBeUndefined();
});

test('(ERROR) validatePostParameter: error', async () => {
  expect.assertions(1);

  const docTest = {
    serialNumber: 1,
    factoryId: 'factoryId',
    lineId: 'lineId'
  };
  const errorFn = () => {
    reflowOvenHelper.validatePostParameter(docTest);
  };
  expect(errorFn).toThrowError(
    new Error("'serialNumber', 'factoryId' and 'lineId' should all exist, and to be 'string', 'string' and 'string' respectively")
  );
});

test('(NORMAL) validatePostDuplication: no error', async () => {
  expect.assertions(2);

  const executeMock = jest.fn().mockReturnValue({ _resultList: [] });
  const txn = {
    execute: executeMock
  };
  const docTest = {
    serialNumber: 'serialNumber',
    factoryId: 'factoryId',
    lineId: 'lineId'
  };

  await expect(reflowOvenHelper.validatePostDuplication(txn, docTest)).toMatchObject({});
  expect(executeMock).toHaveBeenCalledTimes(1);
});

test('(ERROR) validatePostDuplication: error', async () => {
  expect.assertions(2);

  const executeMock = jest.fn().mockReturnValue({ _resultList: [{ serialNumber: 'serialNumber' }] });
  const txn = {
    execute: executeMock
  };
  const docTest = {
    serialNumber: 'serialNumber',
    factoryId: 'factoryId',
    lineId: 'lineId'
  };
  const errorFn = async () => {
    await reflowOvenHelper.validatePostDuplication(txn, docTest);
  };

  await expect(errorFn).rejects.toThrowError(new Error('The same serial number already exist'));
  expect(executeMock).toHaveBeenCalledTimes(1);
});

test('(NORMAL) createProduct', async () => {
  expect.assertions(8);

  const getResultListMock = jest.fn().mockReturnValue({ documentId: 'docId' });
  const executeMock = jest.fn().mockResolvedValue({ getResultList: getResultListMock });
  const txn = {
    execute: executeMock
  };
  const executeLambdaMock = jest.fn(async (func) => {
    return await func(txn);
  });
  qldb.executeLambda = executeLambdaMock;

  // Mock two validation functions
  const validatePostParameterMock = jest.fn().mockReturnValue();
  reflowOvenHelper.validatePostParameter = validatePostParameterMock;
  const validatePostDuplicationMock = jest.fn().mockReturnValue();
  reflowOvenHelper.validatePostDuplication = validatePostDuplicationMock;

  const bodyTest = {
    serialNumber: 'serialNumber',
    factoryId: 'factoryId',
    lineId: 'lineId'
  };
  const res = await reflowOvenHelper.createProduct(bodyTest);

  expect(getResultListMock).toHaveBeenCalledTimes(1);
  expect(executeMock).toHaveBeenCalledTimes(1);
  expect(executeLambdaMock).toHaveBeenCalledTimes(1);
  expect(validatePostParameterMock).toHaveBeenCalledTimes(1);
  expect(validatePostDuplicationMock).toHaveBeenCalledTimes(1);

  const expectedSecondCall = {
    serialNumber: 'serialNumber',
    factoryId: 'factoryId',
    lineId: 'lineId',
    data: {
      inspectionCamera: {},
      inspectionModel: {},
      reflowOven: {}
    }
  };
  expect(executeMock.mock.calls[0][0]).toMatch(/^INSERT INTO\s.+/);
  expect(executeMock.mock.calls[0][1]).toMatchObject(expectedSecondCall);
  expect(res).toEqual({ documentId: 'docId' });
});

test('(NORMAL) updateProduct', async () => {
  expect.assertions(7);

  const getResultListMock = jest.fn().mockReturnValue({ documentId: 'docId' });
  const executeMock = jest.fn().mockResolvedValue({ getResultList: getResultListMock });
  const txn = {
    execute: executeMock
  };
  const executeLambdaMock = jest.fn(async (func) => {
    return await func(txn);
  });
  qldb.executeLambda = executeLambdaMock;

  const bodyTest = {
    serialNumber: 'serialNumber',
    factoryId: 'factoryId',
    lineId: 'lineId'
  };
  const res = await reflowOvenHelper.updateProduct('serial', bodyTest);

  expect(getResultListMock).toHaveBeenCalledTimes(1);
  expect(executeMock).toHaveBeenCalledTimes(1);
  expect(executeLambdaMock).toHaveBeenCalledTimes(1);

  expect(executeMock.mock.calls[0][0]).toMatch(/^UPDATE\s.+/);
  expect(executeMock.mock.calls[0][1]).toMatchObject(bodyTest);
  expect(executeMock.mock.calls[0][2]).toMatch('serial');
  expect(res).toEqual({ documentId: 'docId' });
});

test('(NORMAL) handler: POST', async () => {
  expect.assertions(2);

  const eventTest = {
    httpMethod: 'POST',
    body: '{ "serialNumber": "serialNumber", "factoryId": "factoryId", "lineId": "lineId" }'
  };
  const createProductMock = jest.fn().mockReturnValue({ documentId: 'docId' });
  reflowOvenHelper.createProduct = createProductMock;
  const res = await reflowOven.handler(eventTest, {});
  const expectedRes = {
    statusCode: 200,
    body: JSON.stringify({ documentId: 'docId' }, null, 2),
    headers: { 'Content-Type': 'application/json' }
  };

  expect(createProductMock).toHaveBeenCalledTimes(1);

  expect(res).toMatchObject(expectedRes);
});

test('(NORMAL) handler: PUT', async () => {
  expect.assertions(2);

  const eventTest = {
    httpMethod: 'PUT',
    body: '{ "serialNumber": "serialNumber", "factoryId": "factoryId", "lineId": "lineId" }'
  };
  const updateProductMock = jest.fn().mockReturnValue({ documentId: 'docId' });
  reflowOvenHelper.updateProduct = updateProductMock;
  const res = await reflowOven.handler(eventTest, {});
  const expectedRes = {
    statusCode: 200,
    body: JSON.stringify({ documentId: 'docId' }, null, 2),
    headers: { 'Content-Type': 'application/json' }
  };

  expect(updateProductMock).toHaveBeenCalledTimes(1);

  expect(res).toMatchObject(expectedRes);
});

test('(ERROR) handler: unsupported http method', async () => {
  expect.assertions(1);

  const eventTest = {
    httpMethod: 'GET',
    body: '{ "serialNumber": "serialNumber", "factoryId": "factoryId", "lineId": "lineId" }'
  };
  const res = await reflowOven.handler(eventTest, {});
  const expectedRes = {
    statusCode: 500,
    body: JSON.stringify({ error: 'unsupported http method' }, null, 2),
    headers: { 'Content-Type': 'application/json' }
  };
  expect(res).toMatchObject(expectedRes);
});
