// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const inspectionModel = require('../inspectionModel');
const qldb = require('../lib/qldb');

jest.mock('../lib/qldb');

beforeEach(() => {
  jest.resetAllMocks();
});

test('(NORMAL) handler', async () => {
  expect.assertions(5);

  const getResultListMock = jest.fn().mockReturnValue({ documentId: 'docId' });
  const executeMock = jest.fn().mockResolvedValue({ getResultList: getResultListMock });
  const txn = {
    execute: executeMock
  };

  const executeLambdaMock = jest.fn(async (func) => {
    return await func(txn);
  });
  qldb.executeLambda = executeLambdaMock;

  const res = await inspectionModel.handler({}, {});

  expect(executeLambdaMock).toHaveBeenCalledTimes(1);
  expect(executeMock).toHaveBeenCalledTimes(1);
  expect(getResultListMock).toHaveBeenCalledTimes(1);
  expect(executeMock.mock.calls[0][0]).toMatch(/^UPDATE\s.+/);
  expect(res).toEqual({ documentId: 'docId' });
});
