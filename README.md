#检查清单
###src/index.js
- [ ] 检查合约地址是不是: 0x477F885f6333317f5B2810ECc8AfadC7d5b69dD2
- [ ] 检查金额是不是: 0.1554 eth (2个的价格)
- [ ] 检查 MAX_PRIORITY_FEE_PER_GAS 和 MAX_FEE_PER_GAS 有没有设置
```
// mint开关函数
const MAX_PRIORITY_FEE_PER_GAS = 85;
const MAX_FEE_PER_GAS = 85;
```
- [ ] 检查定时器设置 JOB_DATE
```
const JOB_DATE = new Date(
  2022, // 年
  9,    // 月 从 0（1月）到 11（12月）
  12,   // 日
  22,    // 时(24小时制)
  0,    // 分
  0);   // 秒
```
- [ ] 检查网络是否是main 主网
```
const currENV = 'main';
```

###src/pks.js
- [ ] 检查pks.js中的私钥是否填写了
- [ ] 检查私钥前缀,不要带 “0x” 开头
```
const PKS = [
  // 这里填写你的私钥 例如: '12311231....3123', 注意不要带0x开头
];
```