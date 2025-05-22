export const truncateAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 14)}...${address.slice(-12)}`;
};

export const truncateAddressShort = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
