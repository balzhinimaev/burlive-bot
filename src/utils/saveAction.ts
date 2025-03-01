import { TelegramUser } from "../types/User";

// Функция для создания пользователя
export const saveAction = async (
    userId: number,
    updateType: string,
    data: string,
): Promise<{ message: string } | null> => {

    if (updateType !== 'callback_query' && updateType !== 'message') {
        return null
    }

    const request = await fetch(
        `${process.env.api_url}/telegram/user/save-user-action`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.admintoken}`,
            },
            body: JSON.stringify({
                userId,
                updateType,
                data
            }),
        }
    )

    // Приведение типа результата JSON к ожидаемому типу
    const response = (await request.json()) as {
        message: string
    }
    return response
}
