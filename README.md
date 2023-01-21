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
```
