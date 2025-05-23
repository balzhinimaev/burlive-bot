import config from "../config";
import { TelegramUser } from "../types/User";

// Функция для создания пользователя
export const createUser = async (
    id: number,
    first_name: string,
    referralCode?: string,
    last_name?: string,
    username?: string,
    botusername?: string
): Promise<{ message: string; userId: number; userMongoId: string }> => {
    const response = await fetch(`${config.api.url}/telegram/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.api.token}`,
        },
        body: JSON.stringify({
            id,
            first_name,
            last_name,
            username,
            referral: referralCode,
            botusername,
        }),
    })

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as {
        message: string
        userId: number
        userMongoId: string
    }
    return data
}
