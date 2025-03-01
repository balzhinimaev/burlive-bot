import { TelegramUser } from "../types/User";

// Функция для оформления подписки пользователя
export const createSubscribeUrl = async (
    userId: string,
    subscriptionType: 'monthly' | 'quarterly' | 'annual'
): Promise<{ confirmation_url: string; payment_id: string, amount: string }> => {
    const response = await fetch(`${process.env.api_url}/telegram/subscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.admintoken}`,
        },
        body: JSON.stringify({
            userId,
            subscriptionType,
        }),
    })

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as {
        confirmation_url: string
        payment_id: string
        amount: string
    }
    return data
}
