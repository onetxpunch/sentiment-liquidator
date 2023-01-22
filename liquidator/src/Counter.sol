// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
// import "../lib/sentiment-protocol/src/interface/core/IAccountManager.sol";
import "../lib/sentiment-protocol/src/interface/core/IRiskEngine.sol";
import "../lib/sentiment-protocol/src/interface/core/IAccount.sol";
import "../lib/forge-std/src/interfaces/IERC20.sol";

contract SentimentLiquidator {
    address owner = msg.sender;
    IUniswapV2Factory factoryV2 =
        IUniswapV2Factory(0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506);

    // IAccountManager manager =
    //     AccountManager(0x62c5aa8277e49b3ead43dc67453ec91dc6826403);

    IRiskEngine risk = IRiskEngine(0xc0ac97A0eA320Aa1E32e9DEd16fb580Ef3C078Da);

    // sushi weth-usdc
    address pair = 0x905dfCD5649217c42684f23958568e533C711Aa3;

    function liquidate(address _vault) public {
        if (msg.sender != owner || risk.isAccountHealthy(_vault)) revert();

        // get payback needed
        address[] memory accountBorrows = IAccount(_vault).getBorrows();

        // perform flash swap
        bytes memory data = abi.encode(_vault);
        pair.call(
            abi.encodeWithSignature(
                "swap(uint256,uint256,address,bytes)",
                0,
                0,
                address(this),
                data
            )
        );
    }

    function uniswapV2Call(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) public {
        IAccount _target = IAccount(abi.decode(data, (address)));

        address token0 = IUniswapV2Pair(msg.sender).token0(); // fetch the address of token0
        address token1 = IUniswapV2Pair(msg.sender).token1(); // fetch the address of token1
        assert(msg.sender == factoryV2.getPair(token0, token1)); // ensure that msg.sender is a V2 pair

        address manager = 0x62c5AA8277E49B3EAd43dC67453ec91DC6826403;
        if (amount0 > 0) IERC20(token0).approve(address(manager), amount0);
        if (amount1 > 0) IERC20(token1).approve(address(manager), amount1);
        manager.call(
            abi.encodeWithSignature("liquidate(address)", address(_target))
        );

        if (amount0 > 0) IERC20(token0).transfer(msg.sender, amount0);
        if (amount1 > 0) IERC20(token1).transfer(msg.sender, amount1);
    }
}
