import config from "../../config";

// Функция для создания пользователя
export const setPage = async (
    id: number,
    page: number
): Promise<{ message: string; }> => {
    const response = await fetch(
        `${config.api.url}/telegram/users/${id}/current-page`,
        {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.api.token}`,
            },
            body: JSON.stringify({
                "page": page,
            }),
        }
    )

    // Приведение типа результата JSON к ожидаемому типу
    const data = (await response.json()) as {
        message: string
    }
    return data
}
