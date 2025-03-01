// Функция для блокирования пользователя
export const blockUser = async (
    id: number,
): Promise<{ message: string;}> => {
    const response = await fetch(
        `${process.env.api_url}/telegram/block`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.admintoken}`,
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
