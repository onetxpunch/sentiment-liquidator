// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

contract SentimentLiquidator {
    IUniswapV2Factory factoryV2 =
        IUniswapV2Factory(0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506);

    // sushi weth-usdc
    // address pair = 0x905dfCD5649217c42684f23958568e533C711Aa3;

    function liquidate(address _vault) public {
        // get vault info

        // perform flash swap
        bytes memory data = abi.encode(_vault);

        // pair.call(
        //     abi.encodeWithSignature(
        //         "swap(uint256,uint256,address,bytes)",
        //         0,
        //         0,
        //         address(this),
        //         data
        //     )
        // );
    }

    function uniswapV2Call(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) public {
        address token0 = IUniswapV2Pair(msg.sender).token0(); // fetch the address of token0
        address token1 = IUniswapV2Pair(msg.sender).token1(); // fetch the address of token1
        assert(msg.sender == factoryV2.getPair(token0, token1)); // ensure that msg.sender is a V2 pair
    }
}
