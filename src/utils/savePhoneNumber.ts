import config from "../config";
import { TelegramUser } from "../types/User";

// Функция для сохранения номера телефона
export const savePhoneNumber = async (
    userId: number,
    phoneNumber: string
): Promise<{ message: string; }> => {
    const response = await fetch(
        `${config.api.url}/telegram/users/${userId}/phone`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.api.token}`,
            },
            body: JSON.stringify({
                userId,
                phoneNumber,
            }),
        }
    )

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as {
        message: string
    }
    return data
}
