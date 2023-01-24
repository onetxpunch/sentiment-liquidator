// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "../lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "../lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
// import "../lib/sentiment-protocol/src/interface/core/IAccountManager.sol";
import "../lib/sentiment-protocol/src/interface/core/IRiskEngine.sol";
import "../lib/sentiment-protocol/src/interface/core/IAccount.sol";
import "../lib/sentiment-protocol/src/interface/core/IRegistry.sol";
import "../lib/sentiment-protocol/src/interface/tokens/ILToken.sol";

import {FixedPointMathLib} from "../lib/solmate/src/utils/FixedPointMathLib.sol";


contract SentimentLiquidator {
    using FixedPointMathLib for uint;
    address owner = msg.sender;
    IUniswapV2Factory public factory =
        IUniswapV2Factory(0xc35DADB65012eC5796536bD9864eD8773aBc74C4);

    // IAccountManager manager =
    //     AccountManager(0x62c5aa8277e49b3ead43dc67453ec91dc6826403);
    address public manager = 0x62c5AA8277E49B3EAd43dC67453ec91DC6826403;
    IRiskEngine public risk =
        IRiskEngine(0xc0ac97A0eA320Aa1E32e9DEd16fb580Ef3C078Da);
    IRegistry public registry =
        IRegistry(0x17B07cfBAB33C0024040e7C299f8048F4a49679B);

    address public weth = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address public usdc = 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8;

    receive() external payable {}

    function liquidate(address _vault) public {
        if (msg.sender != owner /* || risk.isAccountHealthy(_vault)*/) revert();

        // get payback needed
        address[] memory borrowTokens = IAccount(_vault).getBorrows();
        uint borrowLen = borrowTokens.length;
        uint256[] memory borrowAmounts = new uint256[](borrowLen);
        for (uint i; i < borrowLen; i++) {
            address addr = borrowTokens[i];
            ILToken debtToken = ILToken(registry.LTokenFor(addr));
            borrowAmounts[i] = debtToken.getBorrowBalance(_vault);
        }

        address possiblePair;
        // find pair to borrow from
        if (borrowLen == 3)
            revert(); // todo
        else if (borrowLen == 2) {
            possiblePair = factory.getPair(borrowTokens[0], borrowTokens[1]);
        } else if (borrowLen == 1) {
            possiblePair = factory.getPair(borrowTokens[0], weth);
        }
        if (possiblePair == address(0)) revert();

        // determine token order and set borrow amounts
        IUniswapV2Pair pair = IUniswapV2Pair(possiblePair);
        address token0 = pair.token0();
        address token1 = pair.token1();
        uint256 a0 = 0;
        uint256 a1 = 0;
        for (uint i; i < borrowLen; i++) {
            if (borrowTokens[i] == token0) a0 = borrowAmounts[i];
            else if (borrowTokens[i] == token1) a1 = borrowAmounts[i];
        }

        // perform flash swap
        bytes memory data = abi.encode(_vault);
        pair.swap(a0, a1, address(this), data);
    }

    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) public {
        IUniswapV2Pair pair = IUniswapV2Pair(msg.sender);
        address token0 = pair.token0();
        address token1 = pair.token1();
        address canonPool = factory.getPair(token0, token1);
        if (msg.sender != canonPool || sender != address(this)) revert();

        bool a0Plus = amount0 > 0;
        bool a1Plus = amount1 > 0;
        if (a0Plus) IERC20(token0).approve(address(manager), amount0);
        if (a1Plus) IERC20(token1).approve(address(manager), amount1);

        address _targetAddr = abi.decode(data, (address));
        manager.call(
            abi.encodeWithSignature("liquidate(address)", _targetAddr)
        );

        if (a0Plus) {
            uint256 balance0 = IERC20(token0).balanceOf(address(this));
            bool repaidWeth = false;
            if (balance0 < amount0) {
                IUniswapV2Pair wethTokenPair = IUniswapV2Pair(
                    factory.getPair(weth, token0)
                );
                weth.call{value: address(this).balance}("");
                if (address(wethTokenPair) == msg.sender) {
                    // can replenish with weth
                    ERC20(weth).transfer(
                        msg.sender,
                        ERC20(weth).balanceOf(address(this))
                    );
                    repaidWeth = true;
                }
                // wethTokenPair.swap(0, 0, address(pair), "");
            }
            if (!repaidWeth) IERC20(token0).transfer(msg.sender, amount0);
            IERC20(token0).approve(msg.sender, 0);
        }
        if (a1Plus) {
            uint256 balance1 = IERC20(token1).balanceOf(address(this));
            bool repaidWeth = false;
            if (balance1 < amount1) {
                IUniswapV2Pair wethTokenPair = IUniswapV2Pair(
                    factory.getPair(weth, token1)
                );
                weth.call{value: address(this).balance}("");
                if (address(wethTokenPair) == msg.sender) {
                    // can replenish with weth
                    ERC20(weth).transfer(
                        msg.sender,
                        ERC20(weth).balanceOf(address(this))
                    );
                    repaidWeth = true;
                }
                // wethTokenPair.swap(0, 0, address(pair), "");
            }
            if (!repaidWeth) IERC20(token1).transfer(msg.sender, amount1);
            IERC20(token1).approve(msg.sender, 0);
        }
    }

    function healthFactor(address _acc) public returns (uint256) {
        uint256 bal = risk.getBalance(_acc);
        uint256 borrows = risk.getBorrows(_acc);
        
        // 
        uint balanceToBorrowThreshold = 1.2e18;
        return bal.divWadDown(borrows);
    }

}
