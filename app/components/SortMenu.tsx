"use client";

export function SortMenu() {
  return (
    <div className="form-control w-[200px]">
      <select className="select select-bordered focus:select-primary transition-all duration-200">
        <option value="marketCap">Market Cap</option>
        <option value="volume">Volume</option>
        <option value="price">Price</option>
        <option value="change">24h Change</option>
        <option value="rewards">Rewards</option>
        <option value="apy">APY</option>
      </select>
    </div>
  );
}
