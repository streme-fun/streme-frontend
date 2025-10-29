// Farcaster usernames of known spammers
export const SPAMMER_BLACKLIST = [
  "nexisdao.eth",
  "caitlynjenner",
  "stockastick",
  "zealous",
  "revoxrexx",
  "ismancuan",
  "colderine",
  "ilhamjr1987",
  "slerfbase",
  "bedik",
  "sekoweed.eth",
  "farcasterintern.eth",
  "fcfsproject.eth",
  "mafa42o",
  "rilas00",
];

// Blacklisted token addresses
export const BLACKLISTED_TOKENS = [
  "0x1efF3Dd78F4A14aBfa9Fa66579bD3Ce9E1B30529",
  "0xe58267cd7299c29a1b77F4E66Cd12Dd24a2Cd2FD",
  "0x8414Ab8C70c7b16a46012d49b8111959Baf2fC42",
  "0x46fd5cfB4c12D87acD3a13e92BAa53240C661D93",
  "0x304989dA2AdC80a6568170567D477Af5E48DBaAe",
  "0xDFd428908909CB5E24F5e79E6aD6BDE10bdf2327",
  "0x58122a048878F25C8C5d4b562419500ED74C6f75",
  "0x4E395eC7b71Dd87A23dD836edb3eFE15A6c2002B",
  "0x09b1AD979d093377e201d804Fa9aC0a9a07cfB0b",
  "0xefbE11336b0008dCE3797C515E6457cC4841645c",
  "0x5f2Fab273F1F64b6bc6ab8F35314CD21501F35C5",
  "0x9097E4A4D75A611b65aB21d98A7D5b1177C050F7",
  "0x1BA8603DA702602A8657980e825A6DAa03Dee93a",
  "0xfe2224bd9c4aFf648F93B036172444C533DbF116",
  "0xd04383398dd2426297da660f9cca3d439af9ce1b",
  "0x2e27296db73efa090c33823b0b637f031d1a1f97",
  "0x7ef392131c3ab326016cf7b560f96c91f4f9d4fa",
  "0x1104ccd840a1adcf5cd2f2451013fc24ed9bb21f",
  "0x34ad3fed2b5a17cc002e3131b72c3d5bf9f4a71f",
  "0x32a3359147872911dd29f46550cbbff51010650d",
  "0x246c54d46e1a799d0aa91f049e13202809c6e38f",
  "0x05876bfc369423f713a3941cc2c32a56dd620dc0",
].map((addr) => addr?.toLowerCase() || "");

// Blacklisted deployer addresses
export const BLACKLISTED_DEPLOYERS = ([] as string[]).map(
  (addr) => addr?.toLowerCase() || ""
);

// Utility function to check if an address is blacklisted (token or deployer)
export const isAddressBlacklisted = (
  address: string | undefined,
  type: "token" | "deployer" | "any" = "any"
): boolean => {
  if (!address) return false;

  const normalizedAddress = address.toLowerCase();

  if (type === "token" || type === "any") {
    if (BLACKLISTED_TOKENS.includes(normalizedAddress)) return true;
  }

  if (type === "deployer" || type === "any") {
    if (BLACKLISTED_DEPLOYERS.includes(normalizedAddress)) return true;
  }

  return false;
};
