import logger from './logger'
import config from '../config'

interface MyResponse {
    referralCode: string
    referralLink: string
    referralsCount: number
    subscribedReferralsCount: number
    earnedBonus: number // Assuming 100 rubles per subscription
}

export const fetchUserReferralInfo = async (
    userId: number
): Promise<MyResponse> => {
    try {
        const response = await fetch(
            `${config.api.url}/telegram/user/referral/${userId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.api.token}`,
                },
            }
        )
        if (!response.ok) {
            throw new Error('Failed to fetch user referral info')
        }
        const data = (await response.json()) as MyResponse
        return data
    } catch (error) {
        console.error('Error fetching user referral info:', error)
        throw error
    }
}
