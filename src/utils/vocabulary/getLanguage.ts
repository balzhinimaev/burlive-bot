import config from "../../config";

// Функция для создания пользователя
export const getLanguage = async (
    id: number,
): Promise<{ language: 'russian' | 'buryat'; }> => {
    const response = await fetch(
        `${config.api.url}/telegram/users/${id}/language`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.api.token}`,
            },
        }
    )

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as {
        language: 'russian' | 'buryat'
    }
    return data
}
