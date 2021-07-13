// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
const awsMock = require('aws-sdk-mock');
const aws = require('aws-sdk');
awsMock.setSDKInstance(aws);

const inspectionCamera = require('../inspectionCamera');
const inspectionCameraHelper = require('../helper/inspectionCameraHelper');
const qldb = require('../lib/qldb');

jest.mock('../lib/qldb');

beforeEach(() => {
  jest.resetAllMocks();
});

test('(NORMAL) getHash', async () => {
  expect.assertions(1);

  awsMock.mock('S3', 'getObject', (params, callback) => {
    callback(null, {
      Body: 'aaa'
    });
  });
  const testParam = {
    Bucket: 'bucket',
    Key: 'key'
  };
  const res = await inspectionCameraHelper.getHash(testParam);
  expect(res).toEqual('47bce5c74f589f4867dbd57e9ca9f808');
  awsMock.restore();
});

test('(NORMAL) main', async () => {
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

  const getHashMock = jest.fn().mockReturnValue('returnedHash');
  inspectionCameraHelper.getHash = getHashMock;

  const res = await inspectionCameraHelper.main('bucket', 'key');

  expect(getResultListMock).toHaveBeenCalledTimes(1);
  expect(executeMock).toHaveBeenCalledTimes(1);
  expect(executeLambdaMock).toHaveBeenCalledTimes(1);
  expect(getHashMock).toHaveBeenCalledTimes(1);

  expect(getHashMock.mock.calls[0][0]).toMatchObject({
    Bucket: 'bucket',
    Key: 'key'
  });
  expect(executeMock.mock.calls[0][0]).toMatch(/^UPDATE\s.+/);
  expect(res).toEqual({ documentId: 'docId' });
});

test('(NORMAL) handler', async () => {
  expect.assertions(4);

  const mainMock = jest.fn().mockReturnValue({ documentId: 'docId' });
  inspectionCameraHelper.main = mainMock;
  const eventTest = {
    Records: [
      {
        s3: {
          bucket: {
            name: 'bucket'
          },
          object: {
            key: 'key'
          }
        }
      }
    ]
  };
  const res = await inspectionCamera.handler(eventTest, {});

  expect(mainMock).toHaveBeenCalledTimes(1);

  expect(mainMock.mock.calls[0][0]).toMatch('bucket');
  expect(mainMock.mock.calls[0][1]).toMatch('key');
  expect(res).toBeUndefined();
});

test('(ERROR) handler: event is undefined', async () => {
  expect.assertions(2);

  const res = await inspectionCamera.handler({}, {});
  expect(res.statusCode).toEqual(500);
  expect(res.error).toMatch(/^Cannot read property '0' of\s.+/);
});
