import config from "../../config";

// Функция для создания пользователя
export const setLanguage = async (
    id: number,
    language: string
): Promise<{ message: string; }> => {
    const response = await fetch(`${config.api.url}/telegram/users/${id}/set-language`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.api.token}`,
        },
        body: JSON.stringify({
            language,
        }),
    })

    console.log(response)

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as {
        message: string
    }
    return data
}
