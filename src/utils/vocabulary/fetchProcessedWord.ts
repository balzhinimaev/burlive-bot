import config from "../../config";

// Функция для создания пользователя
export const fetchProcessedWord = async (
    id: number
): Promise<{ processed_word_id: string; language: string }> => {
    const response = await fetch(
        `${config.api.url}/telegram/processed-word/${id}`,
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
        processed_word_id: string
        language: string
    }
    console.log(data)
    return data
}
