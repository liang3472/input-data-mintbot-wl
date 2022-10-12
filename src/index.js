import { createAlchemyWeb3 } from '@alch/alchemy-web3';
import Web3 from 'web3';
import axios from 'axios';
import abi from './abi.js';
import PKS from './pks.js';
import { getExtraData, privateToAddress, saveAsFile } from './utils.js';
import schedule from 'node-schedule';


// ******************** 注意修改这块 ********************
const CONTRACT = '0x477F885f6333317f5B2810ECc8AfadC7d5b69dD2'; // 这里现在是测试合约
// mint 价格(eth), 注意要根据自己mint的数量去计算
const PRICE = 0.1554; // 注意了单位是 eth
// mint开关函数
const MAX_PRIORITY_FEE_PER_GAS = 85;
const MAX_FEE_PER_GAS = 85;
const PROOF_URL = 'https://backend.yu-gi-yn.com/merkle-proof.json' // 接口可能会换

const JOB_DATE = new Date(
  2022, // 年
  9,    // 月 从 0（1月）到 11（12月）
  12,   // 日
  22,    // 时(24小时制)
  0,    // 分
  0);   // 秒

// test测试网， main主网
const currENV = 'main';
// *****************************************************

const RPC_ENV = {
  main: 'https://mainnet-eth.compound.finance',
  test: 'https://goerli-eth.compound.finance'
};

const WALLETS = (PKS || []).map(pk => ({ address: privateToAddress(pk), pk }));

// https://backend.yu-gi-yn.com/merkle-proof.json?stageNumber=1&address=你的地址
const getMerkleProof = (address) => {
  return new Promise((resolve, reject) => {
    axios.get(PROOF_URL, {
      params: {
        stageNumber: 1,
        address: address,
      }
    })
      .then(res => {
        resolve(res?.data || []);
      })
      .catch(err => {
        resolve(null);
      })
  });
}

console.log(RPC_ENV[currENV]);
const web3 = new Web3(RPC_ENV[currENV]); // 该节点限制50内没问题

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
        gasLimit: 150000,
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
