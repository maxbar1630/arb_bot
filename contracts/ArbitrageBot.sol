//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
	function totalSupply() external view returns (uint);
	function balanceOf(address account) external view returns (uint);
	function decimals() external view returns (uint8);
	function transfer(address recipient, uint amount) external returns (bool);
	function allowance(address owner, address spender) external view returns (uint);
	function approve(address spender, uint amount) external returns (bool);
	function transferFrom(address sender, address recipient, uint amount) external returns (bool);
	event Transfer(address indexed from, address indexed to, uint value);
	event Approval(address indexed owner, address indexed spender, uint value);
}

interface IUniswapV2Router {
  function getAmountsOut(uint256 amountIn, address[] memory path) external view returns (uint256[] memory amounts);
  function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts);
}

contract ArbitrageBot is Ownable {

	function getAmountOut(address router, address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
		address[] memory path;
		path = new address[](2);
		path[0] = tokenIn;
		path[1] = tokenOut;
		uint256[] memory amountOutMins = IUniswapV2Router(router).getAmountsOut(amountIn, path);
		return amountOutMins[path.length -1];
	}

  function estimateTrade(address router1, address router2, address baseToken, address targetToken, uint256 amountIn) external view returns (uint256) {
		uint256 amountOut1 = getAmountOut(router1, baseToken, targetToken, amountIn);
		uint256 amountOut2 = getAmountOut(router2, targetToken, baseToken, amountOut1);
		return amountOut2;
	}
	
	function swap(address router, address tokenIn, address tokenOut, uint256 amountIn) public {
		IERC20(tokenIn).approve(router, amountIn);
		address[] memory path;
		path = new address[](2);
		path[0] = tokenIn;
		path[1] = tokenOut;
		uint256 deadline = block.timestamp + 300;
		IUniswapV2Router(router).swapExactTokensForTokens(amountIn, 1, path, address(this), deadline);
	}

  function trade(address router1, address router2, address baseToken, address targetToken, uint256 amountIn) external onlyOwner returns (uint256) {
    uint256 startBaseTokenBalance = IERC20(baseToken).balanceOf(address(this));
    uint256 startTargetTokenBalance = IERC20(targetToken).balanceOf(address(this));
    swap(router1, baseToken, targetToken, amountIn);
    uint256 targetTokenBalance = IERC20(targetToken).balanceOf(address(this));
    uint256 tradeableTargetTokenAmount = targetTokenBalance - startTargetTokenBalance;
    swap(router2, targetToken, baseToken, tradeableTargetTokenAmount);
    uint256 endBaseTokenBalance = IERC20(baseToken).balanceOf(address(this));
    require(endBaseTokenBalance > startBaseTokenBalance, "Trade reverted");
		return amountIn + endBaseTokenBalance - startBaseTokenBalance;
  }

	function withdrawEth() external onlyOwner {
		payable(msg.sender).transfer(address(this).balance);
	}

	function withdrawToken(address tokenAddress) external onlyOwner {
		IERC20 token = IERC20(tokenAddress);
		token.transfer(msg.sender, token.balanceOf(address(this)));
	}

}
