# EVM Wallet Listener

Services which will constantly listen to configured EVM chain and detects any transaction involving accounts setup on DB.

### Setup

- Run `setup.sh`

### Check the Functionality 

1. After connecting to mongodb locally go to db **tokensale** and to collection **wallets** copy the **public address** from any of the wallets.
2. Do a small ether transfer from metamask to the copied address on specified network
3. After some time check balance of the **ADMIN_WALLET** address provided

### Troubleshooting

1. Issue 1:
   error: Error: Number can only safely store up to 53 bits,"

- Fix:
  Open file .\node_modules\number-to-bn\node_modules\bn.js\lib\bn.js
  Go to line 506 assert(false, 'Number can only safely store up to 53 bits');
  Replace it with ret = Number.MAX_SAFE_INTEGER

### Test Report

1. Setup - Test completed.
2. Functionality - Need to be tested.
3. Different Chains - Need to be tested.
4. Different Environments:
   - Development - Test completed.
   - Staging - Need to be tested.
   - Production - Need to be tested.
5. Co-existence of applications on multiple chains on same server/system - Need to be tested.

### To Do

1. Storing detected transaction on DB along with status. So that application won't be stuck on a single transaction if it fails.
2. Functions to retry the failed transactions again after sometime.
3. Notification if CUSTODIAL_WALLET don't have enough balance.
4. Configuring AWS QUEUE service instead of RabbitMQ.
