import config from '../../config' // Убедитесь, что путь к конфигу правильный
// Импортируем новый тип ответа
import { ISuggestedWordDetailsResponse } from '../../types/apiResponses' // Путь к вашим типам

/**
 * @function fetchSuggestedWordById
 * @description Fetches a single suggested word by its ID from the API.
 * @param wordId - The ID of the suggested word to fetch.
 * @param language - The language of the word ('russian' или 'buryat').
 * @returns - A promise that resolves to an object containing a message and the suggested word details.
 * @throws Will throw an error if the fetch operation fails or the response is not OK.
 */
export const fetchSuggestedWordById = async (
    wordId: string, // ID предложенного слова (из URL)
    language: 'russian' | 'buryat' // Язык как query параметр
): Promise<ISuggestedWordDetailsResponse> => {
    // Убедимся, что language - один из допустимых вариантов для URL
    if (language !== 'russian' && language !== 'buryat') {
        throw new Error(
            "Invalid language parameter. Must be 'russian' or 'buryat'."
        )
    }
    if (!wordId) {
        throw new Error('wordId parameter is required.')
    }

    const apiUrl = `${config.api.url}/vocabulary/suggested/${wordId}?language=${language}`
    console.log(`Fetching suggested word from: ${apiUrl}`) // Логирование URL для отладки

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.api.token}`, // Убедитесь, что токен есть и валиден
        },
    })

    if (!response.ok) {
        // Если ответ не OK, пытаемся получить текст ошибки с сервера
        let errorBody = 'Unknown error'
        try {
            errorBody = await response.text() // или response.json() если сервер всегда возвращает JSON с ошибкой
            console.error(`API Error (${response.status}): ${errorBody}`)
        } catch (e) {
            console.error(
                `API Error (${response.status}): Could not parse error response body.`
            )
        }
        throw new Error(
            `Failed to fetch suggested word. Status: ${response.status}. Body: ${errorBody}`
        )
    }

    // Парсим JSON ответ и кастуем к нашему новому типу ISuggestedWordDetailsResponse
    const data = (await response.json()) as ISuggestedWordDetailsResponse

    // Дополнительная проверка, что полученные данные соответствуют ожиданиям (опционально, но полезно)
    if (!data || !data.word || !data.message) {
        console.error('Received malformed data from API:', data)
        throw new Error('Received malformed data from API for suggested word.')
    }

    return data
}

// Пример использования (в другом файле):
// async function getWord() {
//     try {
//         const wordDetailsResponse = await fetchSuggestedWordById('6825237a260ffb49ac1764e5', 'buryat');
//         console.log('Message:', wordDetailsResponse.message);
//         console.log('Word Text:', wordDetailsResponse.word.text);
//         console.log('Author Username:', wordDetailsResponse.word.author.username);
//         // ... и так далее
//     } catch (error) {
//         console.error('Error fetching word:', error);
//     }
// }
// getWord();
