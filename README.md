# sentiment-liquidator

## install

```
git clone https://github.com/onetxpunch/sentiment-liquidator --recursive
cd monitor && yarn
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
cd liquiator
forge test
```

### monitor

```
cd monitor
yarn start
```
