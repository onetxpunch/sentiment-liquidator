// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/Counter.sol";

contract SentimentLiquidatorTest is Test {
    SentimentLiquidator public self;

    function setUp() public {
        self = new SentimentLiquidator();
    }

    function testIncrement() public {
    }
}
