import config from "../../config";
import { IWordModel } from "../../types/IWordModel";

/**
 * @function getWord
 * @description Функция для получения подтвержденного слова из БД
 * @param id - ID слова, которое нужно получить
 * @returns - Promise, который возвращает объект { message: string }
 */
export const getWord = async (
    id: string
): Promise<{ message: string; word: IWordModel }> => {
    /**
     * Создаем запрос на API для получения подтвержденного слова
     * @param method - HTTP метод (GET)
     * @param url - URL API (config.api.url) + /vocabulary/confirmed-word + query string (wordId)
     * @param headers - заголовки запроса (Content-Type, Authorization)
     */
    const response = await fetch(
        `${config.api.url}/vocabulary/confirmed-word?wordId=${id}`,
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
        message: string
        word: IWordModel
    }

    return data
}
