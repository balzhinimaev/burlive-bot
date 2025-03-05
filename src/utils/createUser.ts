import { TelegramUser } from "../types/User";

// Функция для создания пользователя
export const createUser = async (
    id: number,
    first_name: string,
    referralCode?: string,
    last_name?: string,
    username?: string
): Promise<{ message: string; user: number }> => {
    const response = await fetch(
        `${process.env.api_url}/telegram/create-user`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.admintoken}`,
            },
            body: JSON.stringify({
                id,
                first_name,
                last_name,
                username,
                referral: referralCode,
            }),
        }
    )

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as {
        message: string
        user: number
    }
    return data
}
