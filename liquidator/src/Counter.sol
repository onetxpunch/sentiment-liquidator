// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
// import "../lib/sentiment-protocol/src/interface/core/IAccountManager.sol";
import "../lib/sentiment-protocol/src/interface/core/IRiskEngine.sol";
import "../lib/sentiment-protocol/src/interface/core/IAccount.sol";
import "../lib/sentiment-protocol/src/interface/core/IRegistry.sol";
import "../lib/sentiment-protocol/src/interface/tokens/ILToken.sol";

contract SentimentLiquidator {
    address owner = msg.sender;
    IUniswapV2Factory factoryV2 =
        IUniswapV2Factory(0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506);

    // IAccountManager manager =
    //     AccountManager(0x62c5aa8277e49b3ead43dc67453ec91dc6826403);
    address manager = 0x62c5AA8277E49B3EAd43dC67453ec91DC6826403;
    IRiskEngine risk = IRiskEngine(0xc0ac97A0eA320Aa1E32e9DEd16fb580Ef3C078Da);
    IRegistry registry = IRegistry(0x17B07cfBAB33C0024040e7C299f8048F4a49679B);

    address weth = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address usdc = 0xff970a61a04b1ca14834a43f5de4533ebddb5cc8;

    function liquidate(address _vault) public {
        if (msg.sender != owner || risk.isAccountHealthy(_vault)) revert();

        // get payback needed
        address[] memory borrowTokens = IAccount(_vault).getBorrows();
        uint borrowLen = borrowTokens.length;
        uint256[] memory borrowAmounts = new uint256[](borrowLen);
        for (uint i; i < borrowLen; i++) {
            address addr = borrowTokens[i];
            ILToken debtToken = ILToken(registry.LTokenFor(addr));
            borrowAmounts[i] = debtToken.getBorrowBalance(_vault);
        }

        // find pair to borrow from
        if (borrowLen == 3) revert();
        address possiblePair;
        if (borrowLen == 2) {
            possiblePair = factory.getPair(borrowTokens[0], borrowTokens[1]);
        } else if (borrowLen == 1) {
            // if its weth or usdc, choose usdc pair
            if (borrowTokens[0] == weth || borrowTokens[0] == usdc) {
                // sushi weth-usdc
                address pair = 0x905dfCD5649217c42684f23958568e533C711Aa3;
                possiblePair = pair;
            } else possiblePair = factory.getPair(borrowTokens[0], weth);
        }

        if (possiblePair == address(0)) revert();

        // determine token order and set borrow amounts
        IUniswapV2Pair pair = IUniswapV2Pair(possiblePair);
        uint256 a0 = 0;
        uint256 a1 = 0;

        // perform flash swap
        bytes memory data = abi.encode(_vault);
        possiblePair.call(
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
        // receive flash swap, validate
        address[] memory accountAssets = _target.getAssets();
        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        assert(msg.sender == factoryV2.getPair(token0, token1));

        bool a0Plus = amount0 > 0;
        bool a1Plus = amount1 > 0;
        IAccount _target = IAccount(abi.decode(data, (address)));
        if (a0Plus) IERC20(token0).approve(address(manager), amount0);
        if (a1Plus) IERC20(token1).approve(address(manager), amount1);
        manager.call(
            abi.encodeWithSignature("liquidate(address)", address(_target))
        );

        if (a0Plus) {
            IERC20(token0).transfer(msg.sender, amount0);
            IERC20(token0).approve(msg.sender, 0);
        }
        if (a1Plus) {
            IERC20(token1).transfer(msg.sender, amount1);
            IERC20(token1).approve(msg.sender, 0);
        }
    }
}
