// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "../src/Counter.sol";

contract SentimentLiquidatorTest is Test {
    SentimentLiquidator public self;

    function setUp() public {
        self = new SentimentLiquidator();
    }

    function testLiquidate() public {
        // block 47385920
        vm.label(address(self.risk()), "risk");

        vm.label(address(self.manager()), "manager");
        vm.label(address(self.registry()), "registry");
        vm.label(self.weth(), "weth");
        vm.label(self.usdc(), "usdc");
        vm.label(address(self.factory()), "factory");
        self.liquidate(0x291e91886052B958Cc64859a85eD6B3Ed3355d90);
    }
}
