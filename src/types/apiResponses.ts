// src/types/apiResponses.ts или в вашем файле типов

// Тип для автора и контрибьютора (предполагаем, что это пользователь Telegram)
// Адаптируйте этот тип под точную структуру вашей модели пользователя
export interface ITelegramUserPopulated {
    _id: string
    id: number // Telegram ID
    username?: string
    custom_username?: string
    first_name?: string
    email?: string | null
    phone?: string | null
    // currentQuestion?: { questionPosition?: number }; // Можно раскомментировать, если нужно
    // bot?: { currentPage?: number }; // Можно раскомментировать, если нужно
    rating?: number
    dailyRating?: number
    level?: string // ID уровня
    via_app?: boolean
    photo_url?: string | null
    role?: string // Например, 'user', 'admin'
    // vocabular?: { // Можно раскомментировать, если нужно
    //     selected_language_for_translate?: string;
    //     proccesed_word_id?: string;
    //     page?: number;
    // };
    // theme?: string; // Можно раскомментировать, если нужно
    // subscription?: { // Можно раскомментировать, если нужно
    //     type?: string | null;
    //     startDate?: string | null;
    //     endDate?: string | null;
    //     isActive?: boolean;
    // };
    // referred_by?: string | null; // ID пользователя
    // referrals?: string[]; // Массив ID пользователей
    botusername?: string
    blocked?: boolean
    referral_code?: string
    createdAt: string // Дата в формате ISO
    updatedAt: string // Дата в формате ISO
    __v?: number
}

// Тип для предварительного перевода (pre_translation)
// Адаптируйте под структуру вашей модели AcceptedWord или аналогичной
export interface IPreTranslationPopulated {
    _id: string
    text: string
    normalized_text: string
    translations?: string[] // Массив ID других слов/переводов
    translations_u?: string[] // Массив ID других слов/переводов
    author?: string | ITelegramUserPopulated // Может быть ID или заполненный объект
    contributors?: (string | ITelegramUserPopulated)[] // Массив ID или заполненных объектов
    themes?: string[] // Массив ID тем
    createdAt: string
    updatedAt: string
    __v?: number
    // Добавьте другие поля, если они есть в вашей модели AcceptedWord (или что там у вас для pre_translations)
}

// Тип для самого предложенного слова в ответе API
export interface ISuggestedWordDetails {
    _id: string
    text: string // Или `word` в зависимости от вашей модели на бэкенде
    normalized_text: string // Или `normalized_word`
    author: ITelegramUserPopulated // Заполненный объект автора
    contributors: ITelegramUserPopulated[] // Массив заполненных объектов контрибьюторов
    status: 'new' | 'pending' | 'accepted' | 'declined' // Возможные статусы
    dialect: {
        _id: string
        name: string /* ...другие поля диалекта... */
    } | null // Если диалект заполнен, или null
    pre_translations: IPreTranslationPopulated[] // Массив заполненных предварительных переводов
    themes: string[] // Массив ID тем
    createdAt: string
    updatedAt?: string // Может быть опциональным, если это новое слово без updatedAt
    __v?: number
    // Добавьте другие поля, если они есть в вашей модели SuggestedWord
}

// Общий тип ответа для одного предложенного слова
export interface ISuggestedWordDetailsResponse {
    message: string
    word: ISuggestedWordDetails
}
