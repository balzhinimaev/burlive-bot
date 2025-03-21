import config from "../config";
import { TelegramUser } from "../types/User";

export const fetchUser = async (
    id: number
): Promise<{ is_exists: boolean; user: TelegramUser } | any> => {
    try {
        // console.log(config.api.token)

        const response = await fetch(
            `${config.api.url}/telegram/user/is-exists/${id}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.api.token}`,
                },
            }
        )

        // console.log(response)

        // Проверяем статус ответа перед парсингом JSON
        if (!response.ok) {
            const errorText = await response.text() // Читаем текст ошибки
            throw new Error(
                `API request failed with status ${response.status}: ${errorText}`
            )
        }

        const data = (await response.json()) as {
            is_exists: boolean
            user: TelegramUser
        }
        return data
    } catch (error) {
        console.error('Fetch user error:', error)
        return { is_exists: false, user: null } // Возвращаем дефолтные значения
    }
}
