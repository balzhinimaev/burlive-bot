import config from "../config";

// Функция для блокирования пользователя
export const blockUser = async (
    id: number,
): Promise<{ message: string;}> => {
    const response = await fetch(
        `${config.api.url}/telegram/block`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.api.token}`,
            },
            body: JSON.stringify({
                id
            }),
        }
    )

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as {
        message: string
    }
    return data
}
