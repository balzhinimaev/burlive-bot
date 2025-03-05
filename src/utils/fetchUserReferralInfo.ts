import logger from './logger'

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
            `${process.env.api_url}/api/telegram/user/referral/${userId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.admintoken}`,
                },
            }
        )
        logger.info(`Запрос реферального кода`)
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
