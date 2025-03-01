import { TelegramUser } from "../types/User";

// Функция для проверки существования пользователя
export const fetchUser = async (
    id: number
): Promise<{ is_exists: boolean; user: TelegramUser }> => {
    const response = await fetch(
        `${process.env.api_url}/telegram/user/is-exists/${id}`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.admintoken}`,
            },
        }
    )

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as { is_exists: boolean; user: TelegramUser }
    return data
}
