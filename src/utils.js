import fs from 'fs';
import { Point } from '@noble/secp256k1';
import {
  keccak_256,
} from '@noble/hashes/sha3';
import assert from '@noble/hashes/_assert';

export const getExtraData = async (funcName = '', params = {}, contract) => {
  return new Promise(async (resolve, reject) => {
    try {
      const extraData = await contract?.methods?.[funcName](...params);
      resolve(extraData?.encodeABI());
    } catch (error) {
      resolve(null);
    }
  });
}

const assertIsBuffer = (input) => {
  if (!Buffer.isBuffer(input)) {
    const msg = `This method only supports Buffer but input was: ${input}`
    throw new Error(msg)
  }
}

const wrapHash = (hash) => {
  return (msg) => {
    assert.bytes(msg);
    return hash(msg);
  };
}

const keccak256 = (() => {
  const k = wrapHash(keccak_256);
  k.create = keccak_256.create;
  return k;
})();

const publicToAddress = function (pubKey, sanitize) {
  assertIsBuffer(pubKey)
  if (sanitize && pubKey.length !== 64) {
    pubKey = Buffer.from(Point.fromHex(pubKey).toRawBytes(false).slice(1))
  }
  if (pubKey.length !== 64) {
    throw new Error('Expected pubKey to be of length 64')
  }
  // Only take the lower 160bits of the hash
  return Buffer.from(keccak256(pubKey)).slice(-20)
}

const privateToPublic = (privateKey) => {
  assertIsBuffer(privateKey)
  // skip the type flag and use the X, Y points
  return Buffer.from(Point.fromPrivateKey(privateKey).toRawBytes(false).slice(1))
}

export const privateToAddress = (privateKey) => {
  const address = publicToAddress(privateToPublic(new Buffer(privateKey, 'hex'))).toString('hex');
  return '0x'+address;
}

const logQueue = [];
let timer = null;
const path = 'errorlist.txt';
export const saveAsFile = (msg) => {
  logQueue.push(msg);
  if (timer) {
    clearTimeout(timer);
    timer = null;
  } else {
    timer = setTimeout(() => {
      logQueue.forEach(log => {
        fs.appendFileSync(path, log + '\n', (err) => {
          if (err) {
            Logger.showError(`保存失败! ${err}`);
          } else {
            Logger.showInfo('保存成功!');
          }
        });
      });
      logQueue.length = 0;
    }, 200);
  }
}