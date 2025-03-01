import { TelegramUser } from "../types/User";

// Функция для сохранения номера телефона
export const savePhoneNumber = async (
    userId: number,
    phoneNumber: string
): Promise<{ message: string; }> => {
    const response = await fetch(
        `${process.env.api_url}/telegram/user/save-phone`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.admintoken}`,
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
