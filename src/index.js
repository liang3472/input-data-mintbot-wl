import { createAlchemyWeb3 } from '@alch/alchemy-web3';
import Web3 from 'web3';
import axios from 'axios';
import abi from './abi.js';
import PKS from './pks.js';
import { getExtraData, privateToAddress, saveAsFile } from './utils.js';
import schedule from 'node-schedule';

// ******************** 注意修改这块 ********************
const CONTRACT = '0x3fb44e80f24789aa5d41b4c14f56940dd11004ab'; // 这里现在是测试合约
// mint 价格(eth), 注意要根据自己mint的数量去计算
const PRICE = 0; // 注意了单位是 eth
// mint开关函数
const MAX_PRIORITY_FEE_PER_GAS = 85;
const MAX_FEE_PER_GAS = 85;
// 去alchemy 申请的appkey
const ALCHEMY_AK = '申请的alchemy key'; // 多注册点 alchemy appkey
const PROOF_URL = 'https://backend.yu-gi-yn.com/merkle-proof.json' // 接口可能会换

const JOB_DATE = new Date(
  2022, // 年
  9,    // 月 从 0（1月）到 11（12月）
  12,   // 日
  22,    // 时(24小时制)
  0,    // 分
  0);   // 秒

// test测试网， main主网
const currENV = 'test';
// *****************************************************

const RPC_ENV = {
  main: 'wss://eth-mainnet.alchemyapi.io',
  test: 'wss://eth-goerli.ws.alchemyapi.io'
};

const WALLETS = (PKS || []).map(pk => ({ address: privateToAddress(pk), pk }));

// https://backend.yu-gi-yn.com/merkle-proof.json?stageNumber=1&address=你的地址
const getMerkleProof = (address) => {
  // return new Promise((resolve, reject) => {
  //   axios.get(PROOF_URL, {
  //     params: {
  //       stageNumber: 1,
  //       address: address,
  //     }
  //   })
  //     .then(res => {
  //       // 测试, 到时候要去掉
  //       resolve(res?.data || []);
  //     })
  //     .catch(err => {
  //       resolve(null);
  //     })
  // });

  // 这里是模拟签名返回, 真实的要用到上面代码去后端请求的
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(["0xb1a47173eb9239c340db27e7048882d7bb5695491922958eb1d56c6fd5a93d5f", "0x379e301a8f1da417c066712cc502633ce27f48343108959986cad96a2128db21", "0x454bbbd81807c5be602451fc44924f1f00fb0d611dc498b3419b6376c62b25bb", "0x8daf7faf1b62768cc85b6128ec752eb7b593fb92300ae28ac51d2b7c185d701c", "0x1047438e68effdae4d99ecd2c62c488aa8c6c988cf19f93fa3c708c7d026d9df", "0x367feadf90efaf814b41f3711df9ac3765b52145633bc32219af420fbe58d626", "0x06ac15b990dbb42e479e553fe9d52fe036a06b28a35caf10ea11609fbdf01645", "0x3a13d8ddc8a7eea538be8f8658f8cc7ece2928df4ed75ffe7d9e87baa495ac75", "0x0b58b5f93a169914e6a9a13c76bfc88a6c76584e74ce333ef9b3e6ebfe195d88", "0x388bc4f6b78c5d9c24828a7578938b586c55ba7bec550def3dbfa1379d76ce9e", "0xd93080b5abf73a78030305e1a2803c7b1ade12b80c316bd08b9cdbaa310d5afa", "0x8e2a6beb34a088299c099c551dfb4f2a6b4397512e08f3d6218694af43b3b990", "0x4969b3d83295ef1ac1739154f05120dcb5b7876ca7d5105a2b5772529e4e635b"]);
      // resolve([]);
    }, 1000);
  });
}

if (!ALCHEMY_AK) {
  console.log('请设置alchemy ak');
}
console.log(`${RPC_ENV[currENV]}/v2/${ALCHEMY_AK}`);
// const web3 = createAlchemyWeb3(`${RPC_ENV[currENV]}/v2/${ALCHEMY_AK}`);
const web3 = new Web3('https://goerli-eth.compound.finance'); // 该节点限制50内没问题

const estimateGas = (wallet, data) => {
  if (!wallet.address || !wallet.pk) {
    return Promise.reject(new Error('❌ 请检查钱包配置'))
  }
  return new Promise((resolve, reject) => {
    const address = wallet.address.toLocaleLowerCase();
    console.log(`♻️ ${address}正在同步当前gas...`);
    console.log({
      from: address,
      data: data,
      to: CONTRACT,
      value: web3.utils.toWei(String(PRICE), 'ether'),
    });

    web3.eth.estimateGas({
      from: address,
      data: data,
      to: CONTRACT,
      value: web3.utils.toWei(String(PRICE), 'ether'),
    }).then(async (estimatedGas) => {
      const fields = {
        from: address,
        gas: estimatedGas,
        gasLimit: 500000,
        maxPriorityFeePerGas: web3.utils.toHex(web3.utils.toWei(String(MAX_PRIORITY_FEE_PER_GAS), 'gwei')),
        maxFeePerGas: web3.utils.toHex(web3.utils.toWei(String(MAX_FEE_PER_GAS), 'gwei')),
        to: CONTRACT,
        value: web3.utils.toWei(String(PRICE), 'ether'),
        data: web3.utils.toHex(data)
      };
      const signedTx = await signTx(wallet.pk, fields);
      const hash = await sendTx(signedTx);
      if (hash) {
        resolve(wallet);
      } else {
        reject(new Error('❌ 发送交易异常'));
      }
    }).catch(err => {
      console.log('操作异常:', err);
      reject(err);
    });
  });
}

const signTx = async (pk, fields = {}) => {
  const transaction = {
    ...fields,
  };
  console.log(`✍️ 签名中...`);
  return await web3.eth.accounts.signTransaction(transaction, pk);
}

const sendTx = async (signedTx) => {
  if (!signedTx?.rawTransaction) {
    console.log('❌ 交易异常!');
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    console.log(`📧 发送交易中...`);
    web3.eth.sendSignedTransaction(signedTx.rawTransaction, (error, hash) => {
      if (!error) {
        console.log(`✅ 交易发送成功 ${hash}`);
        resolve(hash);
      } else {
        console.log('❌ 发生异常', error);
        resolve(null);
      }
    });
  });
}

const successList = [];
const Contract = web3.eth.Contract;

const buildInputData = (merkleProof) => {
  if (!merkleProof?.length) {
    return Promise.resolve(null);
  };
  return new Promise(async (resolve, reject) => {
    const params = {
      merkleProof,
      quantity: 2,
    }
    const abiObj = abi[0];
    const array = [];
    (abiObj?.inputs || []).forEach(input => {
      console.log(params?.[input.name]);
      let parseObj = '';
      try {
        parseObj = JSON.parse(params?.[input.name]) || '';
      } catch (error) {
        console.error('解析失败,降级为字符串');
        parseObj = params?.[input.name] || ''
      }
      array.push(parseObj);
    });
    console.log('构建 InputData');
    const contract = new Contract(abi, CONTRACT);
    const inputData = await getExtraData(abiObj.name, array, contract);
    if (!inputData) {
      resolve(null);
    } else {
      resolve(inputData);
    }
  });
}

// 循环查询签名,一旦成功就开始打
const loopWhenOpen = async () => {
  if (WALLETS.length > 0) {
    const proof = await getMerkleProof(WALLETS[0].address);
    if (proof && proof.length > 0) {
      runWL();
    } else {
      console.log('⌛️ 继续等待签名下发...')
      setTimeout(loopWhenOpen, 1000);
    }
  } else {
    console.error('❌ 没有配置钱包私钥');
  }
}

const runWL = async () => {
  WALLETS.forEach(async (wallet) => {
    console.log(`请求${wallet?.address}的 Proof`);
    const res = await getMerkleProof(wallet?.address);
    if (!res || !res.length) {
      console.error('❌ Proof 请求失败');
      saveAsFile(wallet.pk);
    } else {
      console.log('✅ Proof 请求成功');
      const inputData = await buildInputData(res);
      if (!inputData) {
        console.error('❌ 计算InputData失败');
        saveAsFile(wallet.pk);
      } else {
        console.log('✅ 计算InputData成功');
        console.log(inputData);
        try {
          const successWallet = await estimateGas(wallet, inputData);
          console.log(`✅ ${successWallet.address} 发起mint 成功`);
          successList.push(successWallet);
        } catch (error) {
          console.error('❌ mint失败');
          saveAsFile(`'${wallet.pk}',`);
        }
      }
    }
  });
};

// 这里是定时mint
console.log('⏰ 等待脚本执行...');
schedule.scheduleJob(JOB_DATE, () => {
  console.log('⏰ 时间到了，开始执行脚本...');
  loopWhenOpen();
});
