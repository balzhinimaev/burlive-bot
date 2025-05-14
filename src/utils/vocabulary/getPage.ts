import config from "../../config";

// Функция для создания пользователя
export const getCurrentPage = async (
    id: number,
): Promise<{ page: number; }> => {
    const response = await fetch(
        `${config.api.url}/telegram/users/${id}/page`,
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
        page: number
    }
    return data
}
