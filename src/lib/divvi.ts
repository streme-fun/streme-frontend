import { getReferralTag, submitReferral } from '@divvi/referral-sdk'
import { type Hash } from 'viem'

const DIVVI_IDENTIFIER = '0xB897559f4dcEa628B48376e969bD0F81cF4b1DEA' as `0x${string}`
const CAMPAIGN_PROVIDERS = ['0xc95876688026be9d6fa7a7c33328bd013effa2bb'] as const

export function getDivviReferralTag(userAddress: `0x${string}`) {
  return getReferralTag({
    user: userAddress,
    consumer: DIVVI_IDENTIFIER,
    providers: CAMPAIGN_PROVIDERS,
  })
}

export async function appendReferralTag(
  calldata: `0x${string}` | undefined,
  userAddress: `0x${string}`
): Promise<`0x${string}`> {
  const referralTag = getDivviReferralTag(userAddress)
  
  if (!calldata) {
    return `0x${referralTag}` as `0x${string}`
  }
  
  return `${calldata}${referralTag}` as `0x${string}`
}

export async function submitDivviReferral(txHash: Hash, chainId: number) {
  try {
    await submitReferral({
      txHash,
      chainId,
    })
    console.log(`Divvi referral submitted for tx: ${txHash}`)
  } catch (error) {
    console.error('Failed to submit Divvi referral:', error)
  }
}