import config from "../../config";

// Функция для создания пользователя
export const setWord = async (
    id: number,
    wordId: string
): Promise<{ message: string; }> => {
    const response = await fetch(
        `${config.api.url}/telegram/users/${id}/proccess-word-id`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.api.token}`,
            },
            body: JSON.stringify({
                wordId,
            }),
        }
    )

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as {
        message: string
    }
    return data
}
