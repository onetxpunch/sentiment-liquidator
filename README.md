# sentiment-liquidator

## install

```
git clone https://github.com/onetxpunch/sentiment-liquidator --recursive
cd sentiment-liquidator
cd monitor && yarn && cd .. && cd liquidator && yarn && cd ..
```

## start

```
pm2 start "DEPLOYMENT='' yarn --cwd monitor start"
```

## deploy

```
cd liquidator
forge create src/Contract.sol:Contract
```

## development

### liquidator

```
cd liquidator
yarn
forge test
```

### monitor

```
cd monitor
yarn start
anvil --fork-url https://rpc.ankr.com/arbitrum --fork-block-number 47385920
forge create --rpc-url http://127.0.0.1:8545 src/Counter.sol:SentimentLiquidator -i
private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```
