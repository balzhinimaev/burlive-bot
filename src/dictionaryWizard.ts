import { Composer, Scenes, Markup } from 'telegraf'
import sendOrEditMessage from './utils/sendOrEditMessage'
import { MyContext } from './types/MyContext'
import { IWordModel } from './types/IWordModel'
import { fetchPaginatedWords } from './utils/vocabulary/fetchConfirmedWords'
import fetchWordsOnApproval from './utils/vocabulary/fetchWordsOnApproval'
import { setLanguage } from './utils/vocabulary/setLanguage'
import { getWord } from './utils/vocabulary/fetchApprovedWord'
import { setWord } from './utils/vocabulary/setWord'
import { fetchProcessedWord } from './utils/vocabulary/fetchProcessedWord'
import { fetchApproval } from './utils/vocabulary/fetchApproval'
import { getCurrentPage } from './utils/vocabulary/getPage'
import { IWordOnApproval } from './types/IWordOnApproval'
import { setPage } from './utils/vocabulary/setPage'
import { getLanguage } from './utils/vocabulary/getLanguage'
import { fetchSuggestedWordById } from './utils/vocabulary/fetchApprovalWord'
import {
    ISuggestedWordDetails,
    ISuggestedWordDetailsResponse,
    ITelegramUserPopulated,
} from './types/apiResponses'
interface ILevel {
    name: string
    icon: string
    minRating: number
    maxRating?: number // undefined для последнего уровня
    createdAt: Date
    updatedAt: Date
    _id: string
}

interface TelegramUser {
    _id: string
    id: number
    username?: string
    rating: number
    referrals_telegram?: string[]
    createdAt: Date
    updatedAt: Date
    email: string
    c_username: string
    theme: 'light' | 'dark'
    level: string | ILevel
    vocabular: {
        selected_language_for_translate: 'russian' | 'buryat'
    }
    platform: string
    via_app: boolean
    photo_url: string
    phone?: string | number
    role: 'admin' | 'user' | 'moderator' | undefined
    subscription: {
        type: 'monthly' | 'quarterly' | 'annual' | null
        startDate: Date | null
        endDate: Date | null
        isActive: boolean
        paymentId: string
    }
}

// Описываем тип для состояния Wizard-сцены
interface WizardState {
    language?: string // target_langauge
    suggestion?: boolean
    selectedWordId?: string // Добавляем свойство для хранения _id выбранного слова
    selectedDialect?: string
    normalized_text?: string
}

// Массив бурятских диалектов
const dialects = [
    { value: 'khori', label: 'Хоринский' },
    { value: 'bulagat', label: 'Булагатский' },
    { value: 'sartul', label: 'Сартульский' },
    { value: 'unknown', label: 'Не знаю' },
]

// Функция для отправки POST-запроса
async function postRequest(url: string, body: object, token: string) {
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    })
}

// Функция для отправки запроса к API и отображения результатов

interface ResponseData {
    burlangdb: string
    burlivedb: any
}

// Сцена "Словарь"
const dictionaryWizard = new Scenes.WizardScene<
    MyContext & { wizard: { state: WizardState } }
>(
    'dictionary-wizard',
    new Composer<MyContext>(),

    // Шаг 1: Получение текста от пользователя и его перевод
    async (ctx) => {
        if (ctx.message && 'text' in ctx.message) {
            const userInput = ctx.message.text
            const language = ctx.wizard.state.language
            console.log(language)
            if (userInput === `/exit`) {
                return await render_select_language_section(ctx, true)
            }

            try {
                const apiUrl = process.env.api_url
                const adminToken = process.env.admintoken || ''

                const requestBody = {
                    userInput: userInput,
                    sourceLanguage: language,
                    targetLanguage:
                        language === 'russian' ? 'buryat' : 'russian',
                    telegramUserId: ctx.from?.id,
                }

                const response = await postRequest(
                    `${apiUrl}/vocabulary/translate`,
                    requestBody,
                    adminToken
                )

                if (response.ok) {
                    const result = (await response.json()) as ResponseData
                    console.log(result)
                    let burlive_translate = ``
                    if (result.burlivedb) {
                        for (let i = 0; i < result.burlivedb.length; i++) {
                            if (result.burlivedb.length - 1 === i) {
                                burlive_translate += `${result.burlivedb[i].text}`
                            } else {
                                burlive_translate += `${result.burlivedb[i].text}, `
                            }
                        }
                    }

                    if (result.burlivedb) {
                        console.log(result.burlivedb.translations)
                    }

                    const message_header = `<b>Словарь — Результат поиска 🔎</b>\n\n`
                    const message_footer = `-------------------------\n| <b>burlive</b>: ${burlive_translate}\n`

                    const message_super_footer = `-------------------------\n| <b>burlang api:</b> ${result.burlangdb}\n-------------------------\n\n`
                    await ctx.reply(
                        `${message_header}${message_footer}${message_super_footer}`,
                        {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [Markup.button.callback('Назад', 'back')],
                                ],
                            },
                        }
                    )
                } else {
                    const errorMsg = await response.text()
                    await ctx.reply(
                        `Ошибка при отправке предложения: ${errorMsg}`
                    )
                }
            } catch (error) {
                console.error('Ошибка при отправке:', error)
                await ctx.reply(
                    'Произошла ошибка при отправке вашего предложения.'
                )
            }

            // if (language) {
            //   await ctx.reply(
            //     `Перевод для "${userInput}" с ${language}: ${userInput}`
            //   );
            // } else {
            //   await ctx.reply("Пожалуйста, выберите язык для перевода.");
            // }

            // ctx.scene.enter("dictionary-wizard"); // Возврат к сцене после обработки
        } else {
            await ctx.reply('Пожалуйста, введите текст.')
        }
    },

    // Шаг 2: Отправка слова на сервер через API
    async (ctx) => {
        if (ctx.message && 'text' in ctx.message) {
            const userInput = ctx.message.text
            const language = ctx.wizard.state.language || 'не указан'

            if (ctx.from) {
                const userId = ctx.from.id
                if (userInput) {
                    try {
                        const apiUrl = process.env.api_url
                        const adminToken = process.env.admintoken || ''

                        const requestBody = {
                            text: userInput,
                            language:
                                language === 'russian' ? 'russian' : 'buryat',
                            telegram_user_id: userId,
                            dialect:
                                ctx.wizard.state.selectedDialect || 'khori',
                        }

                        const response = await postRequest(
                            `${apiUrl}/vocabulary/suggest-words`,
                            requestBody,
                            adminToken
                        )

                        if (response.ok) {
                            await ctx.reply(
                                `Ваше предложение успешно отправлено: ${userInput}`
                            )
                        } else {
                            const errorMsg = await response.text()
                            await ctx.reply(
                                `Ошибка при отправке предложения: ${errorMsg}`
                            )
                        }
                    } catch (error) {
                        console.error('Ошибка при отправке:', error)
                        await ctx.reply(
                            'Произошла ошибка при отправке вашего предложения.'
                        )
                    }

                    ctx.scene.enter('dictionary-wizard') // Возврат к сцене
                }
            } else {
                await ctx.reply('Не удалось определить пользователя.')
            }
        } else {
            await ctx.reply('Пожалуйста, введите текст.')
        }
    },

    // Шаг 3: Модерация предложенных слов (обработка сообщений и callback_query)
    async (ctx) => {
        if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const action = ctx.callbackQuery.data

            if (action === 'approve_word' || action === 'reject_word') {
                const wordId = ctx.wizard.state.selectedWordId
                const userId = ctx.from?.id

                if (!wordId || !userId) {
                    await ctx.reply(
                        'Не удалось определить пользователя или слово.'
                    )
                    return
                }

                const apiUrl = process.env.api_url
                const actionUrl =
                    action === 'approve_word'
                        ? `${apiUrl}/vocabulary/accept-suggested-word`
                        : `${apiUrl}/vocabulary/decline-suggested-word`

                const response = await postRequest(
                    actionUrl,
                    { suggestedWordId: wordId, telegram_user_id: userId },
                    process.env.admintoken!
                )
                if (!response.ok) {
                    let errorMessage = 'Ошибка при выполнении запроса.'
                    try {
                        const errorData = await response.json()

                        if (
                            typeof errorData === 'object' &&
                            errorData !== null &&
                            'message' in errorData
                        ) {
                            errorMessage = (errorData as { message: string })
                                .message
                        }
                    } catch (e) {
                        // В случае, если ответ не JSON, оставляем стандартное сообщение об ошибке
                    }
                    await ctx.reply(`Ошибка: ${errorMessage}`)
                }
            } else if (action === 'skip_word') {
                await ctx.reply('Слово пропущено.')
                ctx.scene.enter('dictionary-wizard')
            }

            await ctx.answerCbQuery()
        }
    },

    // Шаг 4: Секция история поиска
    async (ctx) => {
        if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const action = ctx.callbackQuery.data

            // Обрабатываем выбор слова, используя _id
            if (action.startsWith('suggest_translate_for_')) {
                const selectedWordId = action.split('_').pop()

                if (typeof selectedWordId !== 'string') {
                    ctx.scene.enter('home')
                    return false
                }
                const response = await getWord(selectedWordId)
                let message = `Введите и отправьте ваш вариант перевода для слова ${response.word.normalized_text}`
                ctx.editMessageText(message)
                ctx.wizard.selectStep(6)
            }

            if (action.startsWith('select_word_for_suggest_translate_')) {
                const selectedWordId = action.split('_').pop()
                if (typeof selectedWordId === 'string') {
                    const response = await getWord(selectedWordId)
                    await setWord(ctx.callbackQuery.from.id, selectedWordId)
                    let message = `<b>Слово загружено</b>\n\n`
                    message += `Слово: ${response.word.text}\n`
                    message += `Normalized: ${response.word.normalized_text}\n`
                    if (response.word.dialect) {
                        message += `Диалект: ${response.word.dialect}\n`
                    }
                    if (response.word.translations.length) {
                        message += `Проверенные переводы: `
                        for (
                            let i = 0;
                            i < response.word.translations.length;
                            i++
                        ) {
                            if (response.word.translations.length - 1 == i) {
                                message += `${response.word.translations[i].normalized_text}`
                            } else {
                                message += `${response.word.translations[i].normalized_text}, `
                            }
                        }

                        message += `\n`
                    }

                    message += `Дата создания: ${response.word.createdAt}\n`
                    message += `Дата обновления: ${response.word.createdAt}\n`
                    message += `Автор: ${response.word.author ? response.word.author : 'Не указан'}\n`

                    ctx.editMessageText(message, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Предложить перевод',
                                        callback_data: `suggest_translate_for_${response.word._id}`,
                                    },
                                ],
                                [{ text: 'Назад', callback_data: 'back' }],
                            ],
                        },
                    })
                } else {
                    ctx.scene.enter('home')
                }
                // ctx.editMessageText(`${selectedWordId}`)
            }

            if (action === 'back') {
                await ctx.scene.enter('dictionary-wizard')
            }
        }

        if (ctx.updateType === 'message') {
        }
    },

    // Шаг 5: Выбор языка для получения слов, которые затем будут переведены
    async (ctx) => {
        if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const action = ctx.callbackQuery.data

            if (typeof ctx.callbackQuery.from?.id === 'undefined') {
                return false
            }

            if (
                action === 'select_russian_for_suggest_translate' ||
                action === 'select_buryat_for_suggest_translate'
            ) {
                if (action === 'select_buryat_for_suggest_translate') {
                    await fetchPaginatedWords(ctx, 1, 10, 'buryat')
                    await setLanguage(ctx.callbackQuery.from?.id, 'buryat')
                    // ctx.scene.session.selected_language = "buryat"
                } else {
                    await fetchPaginatedWords(ctx, 1, 10, 'russian')
                    await setLanguage(ctx.callbackQuery.from?.id, 'russian')
                    // ctx.scene.session.selected_language = "russian"
                }

                ctx.wizard.selectStep(4)
            }

            ctx.answerCbQuery()
        }
    }
)

interface getConfirmedWordResponse {
    message: string
    word: IWordModel
}

interface getAllWordsPaginatedResponse {
    message: string
    words: IWordModel[]
    totalWords: number
    currentPage: number
    totalPages: number
}

// Шаг 4: Обработка выбора слова для перевода и навигации
// dictionaryWizard.use(async (ctx, next) => {
//     if (ctx.wizard.cursor === 4) {
//         if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
//             const callbackData = (ctx.callbackQuery as any).data

//             // Обрабатываем выбор слова, используя _id
//             if (callbackData.startsWith('select_word_')) {
//                 const selectedWordId = callbackData.split('_').pop() // Извлекаем _id слова
//                 // Сохраняем _id выбранного слова в состоянии
//                 ctx.wizard.state.selectedWordId = selectedWordId

//                 try {
//                     // Запрос на API для получения данных о выбранном слове
//                     const apiUrl = process.env.api_url
//                     const response = await fetch(
//                         `${apiUrl}/vocabulary/confirmed-word?wordId=${selectedWordId}`,
//                         {
//                             method: 'GET',
//                             headers: {
//                                 Authorization: `Bearer ${process.env.admintoken}`,
//                                 'Content-Type': 'application/json',
//                             },
//                         }
//                     )
//                     const data =
//                         (await response.json()) as getConfirmedWordResponse

//                     if (response.ok) {
//                         const word = data.word // Получаем данные о слове

//                         // Обновляем стейты в wizard
//                         ctx.wizard.state.selectedWordId = selectedWordId
//                         ctx.wizard.state.language =
//                             word.language.toLowerCase() === 'russian' ||
//                             word.language.toLowerCase() === 'русский'
//                                 ? 'russian'
//                                 : 'buryat' // Обновляем язык выбранного слова
//                         ctx.wizard.state.selectedDialect =
//                             ctx.wizard.state.selectedDialect || 'khori' // Обновляем диалект, если он есть
//                         ctx.wizard.state.normalized_text =
//                             word.normalized_text || '' // Обновляем normalized_text, если он есть

//                         let dialectLabeled
//                         if (ctx.wizard.state.language === 'buryat') {
//                             if (word.dialect === 'khori') {
//                                 dialectLabeled = '<b>Хоринский</b>'
//                             }
//                         }

//                         // Проверяем, если язык слова не "русский" или "russian", выводим диалект
//                         const dialectInfo =
//                             ctx.wizard.state.language === 'buryat'
//                                 ? `\nДиалект: ${dialectLabeled || 'не указан'}`
//                                 : ''

//                         // Отображаем информацию о слове пользователю
//                         let wordDetails = `<b>Добавление перевода ✍️</b>\n\nВыбранное слово: <b>${
//                             word.text
//                         }</b>\nЯзык: ${
//                             word.language === 'buryat'
//                                 ? '<b>Бурятский</b>'
//                                 : '<b>Русский</b>'
//                         }${dialectInfo}`

//                         if (word.translations_u.length) {
//                             wordDetails += `\n\n<b>Предложенные переводы </b>\nНа рассмотрении: `
//                             for (
//                                 let i = 0;
//                                 i < word.translations_u.length;
//                                 i++
//                             ) {
//                                 const translation = word.translations_u[i]
//                                 wordDetails += `${translation.text}`
//                                 if (i < word.translations_u.length - 1) {
//                                     wordDetails += ', '
//                                 }
//                             }
//                         }
//                         let sendmessage
//                         // Проверяем язык и формируем клавиатуру в зависимости от языка
//                         let keyboard
//                         console.log(ctx.wizard.state.language)
//                         if (ctx.wizard.state.language !== 'buryat') {
//                             // Для бурятского языка формируем клавиатуру с диалектами
//                             const selectedDialect =
//                                 ctx.wizard.state.selectedDialect ||
//                                 dialects[0].value
//                             const dialectButtons = dialects.map((dialect) =>
//                                 Markup.button.callback(
//                                     `${selectedDialect === dialect.value ? '✅ ' : ''}${
//                                         dialect.label
//                                     }`,
//                                     `select_dialect_for_suggest_translate_"${dialect.value}`
//                                 )
//                             )

//                             // Группируем кнопки по две в ряд
//                             const groupedDialectButtons: any = []
//                             for (let i = 0; i < dialectButtons.length; i += 2) {
//                                 groupedDialectButtons.push(
//                                     dialectButtons.slice(i, i + 2)
//                                 )
//                             }

//                             // Добавляем кнопку "Назад" в отдельную строку
//                             // groupedDialectButtons.push([
//                             //   Markup.button.callback("Назад", "back"),
//                             // ]);

//                             keyboard = Markup.inlineKeyboard(
//                                 groupedDialectButtons
//                             )
//                             sendmessage = `${wordDetails}\n\n<b>Выберите диалект и Введите перевод для этого слова</b>`
//                             // Отправляем сообщение с информацией о слове и клавиатурой
//                             await sendOrEditMessage(ctx, sendmessage, keyboard)
//                         } else {
//                             console.log('else')
//                             sendmessage = `${wordDetails}\n\n<b>Отправьте перевод для этого слова на русском языке</b>`
//                             // Отправляем сообщение с информацией о слове и клавиатурой
//                             await sendOrEditMessage(ctx, sendmessage)
//                         }

//                         // Переход на следующий шаг (5), где будет вводиться перевод
//                         ctx.wizard.selectStep(5)
//                     } else {
//                         await ctx.reply('Ошибка при получении данных о слове.')
//                     }
//                 } catch (error) {
//                     console.error('Ошибка при получении данных о слове:', error)
//                     await ctx.reply('Произошла ошибка при запросе.')
//                 }
//             }

//             // Обработка пагинации для кнопки "⬅️" (предыдущая страница)
//             if (callbackData === 'back') {
//                 await ctx.scene.enter('dictionary-wizard')
//             }

//             if (callbackData === 'prev_page') {
//                 const currentPage = ctx.session.page || 1
//                 if (currentPage > 1) {
//                     const prevPage = currentPage - 1

//                     ctx.session.page = prevPage
//                     if (ctx.session.selected_language) {
//                         await fetchPaginatedWords(ctx, prevPage, 10, ctx.session.selected_language)
//                     } else {
//                         ctx.reply(`Выберите пожалуйста язык, с которого переводить. Похоже сессия истекла.`)
//                         await renderSelectLanguageForSuggestTranslate(ctx, true)
//                     }
//                 } else {
//                     await ctx.answerCbQuery('Это первая страница.')
//                 }
//             }

//             // Обработка пагинации для кнопки "➡️" (следующая страница)
//             if (callbackData === 'next_page') {
//                 const currentPage = ctx.session.page || 1
//                 const limit = 10

//                 const apiUrl = process.env.api_url
//                 const response = await fetch(
//                     `${apiUrl}/vocabulary/paginated?page=${currentPage}&limit=${limit}`,
//                     {
//                         method: 'GET',
//                         headers: {
//                             Authorization: `Bearer ${process.env.admintoken}`,
//                             'Content-Type': 'application/json',
//                         },
//                     }
//                 )
//                 const data =
//                     (await response.json()) as getAllWordsPaginatedResponse

//                 if (response.ok) {
//                     const totalWords = data.totalWords
//                     const totalPages = Math.ceil(totalWords / limit)

//                     if (currentPage < totalPages) {
//                         const nextPage = currentPage + 1
//                         ctx.session.page = nextPage
//                         if (ctx.session.selected_language) {
//                             await fetchPaginatedWords(
//                                 ctx,
//                                 nextPage,
//                                 10,
//                                 ctx.session.selected_language
//                             )
//                         } else {
//                             ctx.reply(
//                                 `Выберите пожалуйста язык, с которого переводить. Похоже сессия истекла.`
//                             )
//                             await renderSelectLanguageForSuggestTranslate(
//                                 ctx,
//                                 true
//                             )
//                         }
//                     } else {
//                         await ctx.answerCbQuery('Это последняя страница.')
//                     }
//                 } else {
//                     await ctx.reply('Ошибка при получении данных.')
//                 }
//             }

//             await ctx.answerCbQuery()
//         }
//     } else {
//         return next()
//     }
// })

interface getUserResponse {
    message: string
    is_exists: boolean
    user: TelegramUser
}

// Шаг 6: Обработка действий с выбранным словом
dictionaryWizard.use(async (ctx, next) => {
    if (ctx.wizard.cursor === 6) {
        if (ctx.message && 'text' in ctx.message) {
            const translation = ctx.message.text
            console.log(ctx.from)
            //@ts-ignore
            const wordId = await fetchProcessedWord(ctx.from.id)

            // Проверка наличия перевода и выбранного слова
            if (!translation || !wordId) {
                await ctx.reply(
                    'Ошибка: перевод не введен или слово не выбрано.'
                )
                return
            }

            try {
                // Отправка перевода через API
                const apiUrl = process.env.api_url

                if (ctx.from) {
                    if (ctx.from.id) {
                        // Подготовка тела запроса
                        const requestBody = {
                            wordId: wordId.processed_word_id,
                            translateLanguage:
                                wordId.language === 'russian'
                                    ? 'russian'
                                    : 'buryat', // Язык перевода
                            translationText: translation, // Введенный перевод
                            targetLanguage:
                                wordId.language === 'russian'
                                    ? 'buryat'
                                    : 'russian',
                            // dialect: ctx.wizard.state.selectedDialect,
                            // normalized_text:
                            // translation.trim().toLowerCase() || '',
                            telegramUserId: ctx.from.id,
                        }

                        const response = await fetch(
                            `${apiUrl}/vocabulary/suggest-translate`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${process.env.admintoken}`,
                                },
                                body: JSON.stringify(requestBody),
                            }
                        )

                        if (response.ok) {
                            const infoUserSuccesSuggest = await ctx.reply(
                                `Ваш перевод для слова успешно отправлен: ${translation}`
                            )
                            if (infoUserSuccesSuggest.from) {
                                if (infoUserSuccesSuggest.from.id) {
                                    setTimeout(async () => {
                                        if (infoUserSuccesSuggest.from) {
                                            if (infoUserSuccesSuggest.from.id) {
                                                await ctx.telegram.deleteMessage(
                                                    infoUserSuccesSuggest.chat
                                                        .id,
                                                    infoUserSuccesSuggest.message_id
                                                )
                                            }
                                        }
                                    }, 2000) // Удалит сообщение через 2 секунды
                                }
                            }
                        } else {
                            const errors = await response.json()
                            console.log(errors)
                            let message = `Ошибки: `
                            for (let i = 0; i < errors.errors.length; i++) {
                                if (errors.errors.length - 1 === i) {
                                    message += `${errors.errors[i].msg}`
                                } else {
                                    message += `${errors.errors[i].msg}, `
                                }
                            }
                            await ctx.reply(message)
                            await ctx.reply(`Ошибка при отправке перевода`)
                        }

                        ctx.wizard.state.language = ''

                        // Возврат к началу после успешного перевода
                        ctx.scene.enter('dictionary-wizard')
                    } else {
                        // Возврат к началу если ID не найден
                        ctx.scene.enter('dictionary-wizard')
                    }
                } else {
                    // Возврат к началу если ctx.from нет
                    ctx.scene.enter('dictionary-wizard')
                }
            } catch (error) {
                console.error('Ошибка при отправке перевода:', error)
                await ctx.reply(
                    'Произошла ошибка при отправке вашего перевода.'
                )
            }
        } else if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const callbackData = (ctx.callbackQuery as any).data

            // Обрабатываем выбор слова, используя _id
            if (
                callbackData.startsWith('select_dialect_for_suggest_translate_')
            ) {
                const selectedDialect: string = callbackData
                    .split('_')
                    .pop()
                    .replace('"', '') // Извлекаем выбранный диалект
                // Сохраняем диалект в состоянии
                ctx.wizard.state.selectedDialect = selectedDialect

                // Получаем предыдущее сообщение, мне лень править типы
                // @ts-ignore
                const message = ctx.update.callback_query.message
                const dialectButtons = dialects.map((dialect) =>
                    Markup.button.callback(
                        `${selectedDialect === dialect.value ? '✅ ' : ''}${dialect.label}`,
                        `select_dialect_for_suggest_translate_"${dialect.value}`
                    )
                )
                // Группируем кнопки по две в ряд
                const groupedDialectButtons: any = []
                for (let i = 0; i < dialectButtons.length; i += 2) {
                    groupedDialectButtons.push(dialectButtons.slice(i, i + 2))
                }

                // Отправляем клавиатуру с диалектами
                await sendOrEditMessage(
                    ctx,
                    message.text,
                    Markup.inlineKeyboard([
                        ...groupedDialectButtons,
                        // [Markup.button.callback("Назад", "back")],
                    ])
                )
            }

            if (callbackData === 'back') {
                await renderSelectLanguageForSuggestTranslate(ctx)
            }

            ctx.answerCbQuery()
        } else {
            await ctx.reply('Пожалуйста, введите перевод для выбранного слова.')
        }
    } else {
        return next()
    }
})
async function renderWordsConsiderList(id: number, language: string) {
    try {
        const currentPage = await getCurrentPage(id)
        const limit = 10
        const data = await fetchApproval('', currentPage.page, limit, language)

        const totalPages = Math.ceil(data.totalItems / 10)

        let message = `<b>Словар — модерация ✍️</b>\n\n`
        console.log(data.items)
        if (data.items.length === 0) {
            message += '\nНа этой странице нет слов.'
            return {
                message,
                selectionKeyboard: [
                    [Markup.button.callback('Назад', 'back-to-dictionary')],
                ],
            }
        }
        message += `Всего слов: ${data.totalItems}\n`
        message += `Страница: ${currentPage.page}/${totalPages}\n\n`
        message += `<i>Показано  ${data.currentPage * limit - limit + 1}-${Math.min(
            data.currentPage * limit,
            data.totalItems
        )} из ${data.totalItems} слов которые надо рассмотреть</i>\n\n`
        for (let i = 0; i < data.items.length; i++) {
            message += `${i + 1}. ${data.items[i].text}\n`
        }

        // Формируем клавиатуру, используя word._id
        const selectionButtons: any = data.items.map(
            (word: IWordOnApproval, index: number) =>
                Markup.button.callback(
                    `${index + 1}`,
                    `select_word_for_consider_${word._id}`
                )
        )

        // Разбиваем кнопки по два ряда (по 5 кнопок на ряд)
        const rows: any = []
        for (let i = 0; i < selectionButtons.length; i += 5) {
            rows.push(selectionButtons.slice(i, i + 5))
        }
        const paginationButtons = []
        if (currentPage.page > 1) {
            paginationButtons.push(Markup.button.callback('⬅️', 'prev_page'))
        }
        paginationButtons.push(
            Markup.button.callback('Назад', 'back-to-dictionary')
        )
        if (currentPage.page < totalPages) {
            paginationButtons.push(Markup.button.callback('➡️', 'next_page'))
        }

        // Добавляем пагинацию в отдельный ряд
        rows.push(paginationButtons)

        return {
            message,
            selectionKeyboard: rows,
        }
    } catch (error) {
        return false
    }
}

// Шаг 7: Обработка действий с выбранным словом
dictionaryWizard.use(async (ctx, next) => {
    if (ctx.wizard.cursor === 7) {
        if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const callbackData:
                | 'words-consider-russian'
                | 'words-consider-buryat'
                | 'next_page'
                | 'prev_page'
                | 'back-to-dictionary' = (ctx.callbackQuery as any).data

            if (callbackData.startsWith('select_word_for_consider_')) {
                const wordId = callbackData.substring(
                    'select_word_for_consider_'.length
                )

                if (!ctx.from?.id) {
                    await ctx.answerCbQuery(
                        'Не удалось определить пользователя.'
                    )
                    return
                }
                const userId = ctx.from.id

                try {
                    // 1. Устанавливаем слово, которое пользователь будет рассматривать, через API
                    await setWord(userId, wordId) // Используем вашу функцию

                    // 2. Получаем язык, на котором пользователь модерирует
                    const languageData = await getLanguage(userId) // Используем вашу функцию
                    if (!languageData || !languageData.language) {
                        await ctx.answerCbQuery(
                            'Не удалось определить язык для модерации.'
                        )
                        await renderModerationSection(ctx)
                        return
                    }
                    const language = languageData.language

                    // 3. Получаем детали этого слова для отображения
                    await ctx.answerCbQuery('Загрузка слова...')
                    const wordDetailsResponse = await fetchSuggestedWordById(
                        wordId,
                        language
                    ) // Используем вашу API-функцию для деталей

                    if (wordDetailsResponse && wordDetailsResponse.word) {
                        await renderSuggestedWordForConsiderationScreen(
                            ctx,
                            wordDetailsResponse
                        )
                        // Перенаправляем пользователя на шаг 8 (шаг модерации)
                        ctx.wizard.selectStep(8)
                    } else {
                        await ctx.editMessageText(
                            'Не удалось загрузить детали слова. Попробуйте позже.'
                        )
                    }
                } catch (error) {
                    console.error(
                        'Ошибка на шаге 7 при выборе слова для рассмотрения:',
                        error
                    )
                    let errorMessage = 'Произошла ошибка при выборе слова.'
                    if (error instanceof Error)
                        errorMessage += ` (${error.message})`
                    await ctx.editMessageText(errorMessage).catch(() => {})
                    // Можно вернуть к списку
                    const currentLanguageData = await getLanguage(userId)
                    const result = await renderWordsConsiderList(
                        userId,
                        currentLanguageData?.language || 'russian'
                    )
                    if (result && ctx.callbackQuery.message) {
                        await ctx
                            .editMessageText(result.message, {
                                parse_mode: 'HTML',
                                reply_markup: {
                                    inline_keyboard: result.selectionKeyboard,
                                },
                            })
                            .catch(() => {
                                ctx.scene.enter("dictionary-wizard")
                            })
                    }
                }
                return
            }

            if (
                callbackData === 'words-consider-russian' ||
                callbackData === 'words-consider-buryat'
            ) {
                setPage(ctx.callbackQuery.from.id, 1)

                if (callbackData === 'words-consider-russian') {
                    await setLanguage(ctx.callbackQuery.from.id, 'russian')
                } else {
                    await setLanguage(ctx.callbackQuery.from.id, 'buryat')
                }

                const result = await renderWordsConsiderList(
                    ctx.callbackQuery.from.id,
                    callbackData.split('-')[2]
                )

                if (!result) {
                    return ctx.scene.enter('dictionary-wizard')
                }

                ctx.editMessageText(result.message, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: result.selectionKeyboard,
                    },
                })

                // ctx.wizard.selectStep(8)
            }

            if (callbackData === 'next_page') {
                const currentPage = await getCurrentPage(
                    ctx.callbackQuery.from.id
                )
                const language = await getLanguage(ctx.callbackQuery.from.id)

                // Исправлено: limit = 10
                const dataCheck = await fetchApproval(
                    '',
                    currentPage.page,
                    10,
                    language.language
                )
                const totalPages = Math.ceil(dataCheck.totalItems / 10)

                if (currentPage.page >= totalPages) {
                    await ctx.answerCbQuery('Это последняя страница!')
                    return
                }

                await setPage(ctx.callbackQuery.from.id, currentPage.page + 1)
                const result = await renderWordsConsiderList(
                    ctx.callbackQuery.from.id,
                    language.language
                )

                if (!result) {
                    return ctx.scene.enter('dictionary-wizard')
                }

                ctx.editMessageText(result.message, {
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: result.selectionKeyboard },
                })
            }

            if (callbackData === 'prev_page') {
                const currentPage = await getCurrentPage(
                    ctx.callbackQuery.from.id
                )
                const language = await getLanguage(ctx.callbackQuery.from.id)

                if (currentPage.page <= 1) {
                    await ctx.answerCbQuery('Это первая страница!')
                    return
                }

                await setPage(ctx.callbackQuery.from.id, currentPage.page - 1)
                const result = await renderWordsConsiderList(
                    ctx.callbackQuery.from.id,
                    language.language
                )

                if (!result) {
                    return ctx.scene.enter('dictionary-wizard')
                }

                ctx.editMessageText(result.message, {
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: result.selectionKeyboard },
                })
            }

            if (callbackData === 'back-to-dictionary') {
                await ctx.scene.enter('dictionary-wizard')
            }

            ctx.answerCbQuery()
        } else {
            await ctx.reply('Пожалуйста, введите перевод для выбранного слова.')
        }
    } else {
        return next()
    }
})

// Шаг 8: Обработка действий модерации (Принять/Отклонить)
dictionaryWizard.use(async (ctx, next) => {
    if (ctx.wizard.cursor === 8) {
        if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const callbackData: string = (ctx.callbackQuery as any).data;

            if (!ctx.from?.id) {
                await ctx.answerCbQuery('Не удалось определить пользователя.');
                return;
            }
            const userId = ctx.from.id;

            // 1. Получаем ID слова, которое пользователь обрабатывает, с бэкенда
            let processedWordData;
            try {
                processedWordData = await fetchProcessedWord(userId); // Используем вашу функцию
            } catch (error) {
                console.error("Ошибка при получении обрабатываемого слова на шаге 8:", error);
                await ctx.editMessageText("Не удалось получить информацию о слове на рассмотрении. Попробуйте выбрать слово заново.").catch(() => {});
                await renderModerationSection(ctx); // Возврат к выбору языка модерации
                ctx.wizard.selectStep(7);
                return;
            }
            
            if (!processedWordData || !processedWordData.processed_word_id) {
                await ctx.answerCbQuery('Ошибка: слово для модерации не найдено в вашем текущем состоянии.');
                await renderModerationSection(ctx);
                ctx.wizard.selectStep(7);
                return;
            }

            const wordIdToModerate = processedWordData.processed_word_id;
            // Язык слова, который был сохранен вместе с processed_word_id,
            // или можно снова запросить getLanguage(userId), если это язык модерации, а не слова.
            // Для API принятия/отклонения обычно нужен язык самого слова.
            // В вашем fetchProcessedWord возвращается language - это язык самого слова.
            const wordLanguage = processedWordData.language as 'russian' | 'buryat';


            let actionUrl = '';
            let successMessage = '';
            let requestBody: any = {
                suggestedWordId: wordIdToModerate,
                telegramUserId: userId,
                language: wordLanguage // Передаем язык самого слова
            };

            if (callbackData.startsWith('consider_action_accept_')) {
                actionUrl = `${process.env.api_url}/vocabulary/accept-suggested-word`;
                successMessage = 'Слово успешно принято! 👍';
            } else if (callbackData.startsWith('consider_action_decline_')) {
                actionUrl = `${process.env.api_url}/vocabulary/decline-suggested-word`;
                successMessage = 'Слово успешно отклонено. 👎';
                // requestBody.reason = "Причина (если нужна)";
            } else if (callbackData === 'back_to_consider_list') {
                // Очищаем "обрабатываемое слово" на бэкенде, если пользователь решил вернуться, не завершив действие
                // Это опционально, зависит от вашей логики. Если не очищать, он вернется к тому же слову.
                // Для примера, давайте очистим:
                try {
                    // Предположим, у вас есть API для очистки или вы передаете null/пустую строку в setWord
                    await setWord(userId, ""); // Передаем пустую строку или специальное значение для очистки
                } catch (clearError) {
                    console.error("Ошибка при попытке очистить обрабатываемое слово:", clearError);
                }

                const currentModerationLanguageData = await getLanguage(userId); // Язык, на котором пользователь модерирует
                const listRenderLang = currentModerationLanguageData?.language || 'russian';
                const result = await renderWordsConsiderList(userId, listRenderLang);
                if (result) {
                    await sendOrEditMessage(ctx, result.message, Markup.inlineKeyboard(result.selectionKeyboard));
                } else {
                    await ctx.editMessageText('Не удалось загрузить список слов.');
                }
                ctx.wizard.selectStep(7);
                await ctx.answerCbQuery();
                return;
            } else {
                await ctx.answerCbQuery('Неизвестное действие.');
                return;
            }

            if (!actionUrl) { // Должно быть обработано выше, но на всякий случай
                await ctx.answerCbQuery('Действие не определено.');
                return;
            }

            try {
                await ctx.answerCbQuery('Обработка...');
                const response = await postRequest(actionUrl, requestBody, process.env.admintoken!);

                if (response.ok) {
                    await ctx.editMessageText(successMessage);
                    // После успешного действия, "обрабатываемое слово" на бэкенде должно быть очищено
                    // либо самим API принятия/отклонения, либо отдельным вызовом setWord(userId, "")
                    // Если API не очищает, то:
                    // await setWord(userId, ""); // Очищаем состояние на бэкенде

                    const currentModerationLanguageData = await getLanguage(userId);
                    const listRenderLang = currentModerationLanguageData?.language || 'russian';
                    const listResult = await renderWordsConsiderList(userId, listRenderLang);
                    if (listResult) {
                        await ctx.reply(listResult.message, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: listResult.selectionKeyboard }
                        });
                    }
                    ctx.wizard.selectStep(7); // Возвращаемся на шаг списка
                } else {
                    const errorData = await response.json().catch(() => ({ message: 'Не удалось разобрать ошибку сервера.' }));
                    const errorMessage = errorData.message || `Ошибка: ${response.status}.`;
                    await ctx.editMessageText(`⚠️ ${errorMessage}`);
                }

            } catch (error) {
                console.error('Ошибка при модерации слова на шаге 8:', error);
                await ctx.editMessageText('Произошла серьезная ошибка при модерации.');
            }
        } else if (ctx.message) {
            await ctx.reply('Пожалуйста, используйте кнопки.');
        }
    } else {
        return next();
    }
});

const dictionaryKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Найти слово', 'select_language')],
    // [
    //   Markup.button.callback("Русский", "select_russian"),
    //   Markup.button.callback("Бурятский", "select_buryat"),
    // ],
    [Markup.button.callback('Модерация', 'consider_suggested_words')], // Новая кнопка
    [Markup.button.callback('Предложить слово', 'suggest_word')],
    [Markup.button.callback('Предложить переводы', 'suggest_translate')], // Новая кнопка
    [Markup.button.callback('Назад', 'home')],
])

const historyKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Удалить историю', 'delete_history')],
    [Markup.button.callback('Назад', 'back_to_dictionary')],
])

const link = 'https://t.me/bur_live'
const how_to_use_dict =
    'https://telegra.ph/Kak-vospolzovatsya-slovarem-httpstmeburlive-bot-09-08'
const hot_to_vote = 'https://telegra.ph/Kak-progolosovat-za-perevod-09-08'
const how_to_suggest_translate =
    'https://telegra.ph/Kak-dobavit-perevoda-k-slovu-09-08'
// Убираем `ctx.wizard.next()` из `enter`
dictionaryWizard.enter(async (ctx) => {
    sendOrEditMessage(
        ctx,
        `<b>Словарь</b> \n\nВыберите раздел для начала работ\n\n<i><a href='${how_to_use_dict}'>Как воспользоваться словарем?</a>\n<a href='${hot_to_vote}'>Как проголосовать за перевод?</a>\n<a href='${link}'>Как предложить слово на перевод?</a>\n<a href='${how_to_suggest_translate}'>Как добавить перевод к слову?</a></i>`,
        dictionaryKeyboard
    )
})

const messageContentSelectRussianForTranslate = `<b>Словарь — Найти слово 🔎\n\n</b><i>Введите слово для перевода с русского:</i>`
const messageContentSelectBuryatForTranslate = `<b>Словарь — Найти слово 🔎\n\n</b><i>Введите слово для перевода с бурятского:</i>`

// Обработчики выбора языка
dictionaryWizard.action('select_russian', async (ctx) => {
    ctx.wizard.state.language = 'russian'
    await sendOrEditMessage(ctx, messageContentSelectRussianForTranslate)
    return ctx.wizard.selectStep(1) // Переход к шагу 1
})

// Обработчики выбора языка
dictionaryWizard.action('select_buryat', async (ctx) => {
    ctx.wizard.state.language = 'buryat'
    await sendOrEditMessage(ctx, messageContentSelectBuryatForTranslate)
    return ctx.wizard.selectStep(1) // Переход к шагу 1
})

// Обработчик для предложения перевода к словам
dictionaryWizard.action('suggest_translate', async (ctx) =>
    renderSelectLanguageForSuggestTranslate(ctx)
)
async function renderSelectLanguageForSuggestTranslate(
    ctx: MyContext,
    reply?: boolean
) {
    let message = 'Выберите язык, с которого хотите переводить'
    const suggestTranslateKeyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(
                'Русский',
                'select_russian_for_suggest_translate'
            ),
            Markup.button.callback(
                'Бурятский',
                'select_buryat_for_suggest_translate'
            ),
        ],
    ])
    await sendOrEditMessage(ctx, message, suggestTranslateKeyboard, reply)
    ctx.wizard.selectStep(5)
    // await fetchPaginatedWords(ctx, 1, 10)
}

// Обработчики для выбора слова по индексу для перевода
for (let i = 0; i < 10; i++) {
    dictionaryWizard.action(`select_word_for_translation_${i}`, async (ctx) => {
        const page = ctx.session.page || 1
        const limit = 10

        // Получаем данные заново, чтобы выбрать правильный элемент
        const apiUrl = process.env.api_url
        const response: any = await fetch(
            `${apiUrl}/vocabulary/get-words-for-translation?page=${page}&limit=${limit}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${process.env.admintoken}`,
                    'Content-Type': 'application/json',
                },
            }
        )
        const data = await response.json()

        if (response.ok) {
            const selectedWord = data.words[i] // Выбираем нужное слово по индексу

            // Сохраняем _id выбранного слова в сессии
            ctx.wizard.state.selectedWordId = selectedWord._id

            // Просим пользователя ввести перевод для выбранного слова
            await ctx.reply(`Введите перевод для слова: ${selectedWord.text}`)

            // Переходим на следующий шаг для ввода перевода
            ctx.wizard.selectStep(5)

            // Обработчик для получения перевода от пользователя
            dictionaryWizard.on('text', async (ctx) => {
                const translationInput = ctx.message?.text
                if (!translationInput) {
                    await ctx.reply('Пожалуйста, введите корректный перевод.')
                    return
                }

                // Отправляем перевод на сервер
                const requestBody = {
                    word_id: selectedWord._id,
                    translation: translationInput,
                    telegram_user_id: ctx.from?.id,
                }

                const response = await fetch(
                    `${apiUrl}/vocabulary/suggest-translate`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${process.env.admintoken}`,
                        },
                        body: JSON.stringify(requestBody),
                    }
                )

                if (response.ok) {
                    await ctx.reply(
                        `Ваш перевод для слова "${selectedWord.text}" успешно предложен: ${translationInput}`
                    )
                } else {
                    await ctx.reply(`Ошибка при предложении перевода`)
                }

                // Возвращаемся к главной сцене после обработки перевода
                return ctx.scene.enter('dictionary-wizard')
            })
        } else {
            await ctx.reply('Ошибка при получении данных.')
        }
    })
}

const suggesWordHandlerMessageContent =
    '<b>Предложение слова — Выбор языка ✍️</b>\n\nУкажите язык, на котором вы будете добавлять слово/слова для дальнейшего перевода нашим сообществом'
const suggesWordHandlerSelectedLanguageBuryat =
    '<b>Предложение слова — Выбор диалекта ✍️</b>\n\nУкажите диалект, на котором хотите добавить слово для дальнейшего перевода нашим сообществом'

// Обработчик для предложения слова
dictionaryWizard.action('suggest_word', async (ctx) => {
    const languageSelectionKeyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('Русский', 'suggest_russian'),
            Markup.button.callback('Бурятский', 'suggest_buryat'),
        ],
        [Markup.button.callback('Назад', 'back')],
    ])

    await sendOrEditMessage(
        ctx,
        suggesWordHandlerMessageContent,
        languageSelectionKeyboard
    )
})

// Обработчик для предложения слова на русском языке
dictionaryWizard.action('suggest_russian', async (ctx) => {
    ctx.wizard.state.language = 'russian'
    await sendOrEditMessage(
        ctx,
        'Введите слово или фразу, которую хотите отправить на перевод с русского:'
    )
    return ctx.wizard.selectStep(2) // Переход к шагу 2
})

// Обработчик для предложения слова на бурятском языке с диалектами
dictionaryWizard.action('suggest_buryat', async (ctx) => {
    ctx.wizard.state.language = 'buryat'

    // Если диалект уже выбран, получаем его из состояния, иначе используем первый по умолчанию
    const selectedDialect =
        ctx.wizard.state.selectedDialect || dialects[0].value

    // Формируем клавиатуру с диалектами, где выбранный помечен значком ✅
    const dialectButtons = dialects.map((dialect) =>
        Markup.button.callback(
            `${selectedDialect === dialect.value ? '✅ ' : ''}${dialect.label}`,
            `select_dialect_for_suggest_translate_${dialect.value}`
        )
    )

    // Группируем кнопки по две в строке
    const groupedDialectButtons: any = []
    for (let i = 0; i < dialectButtons.length; i += 2) {
        groupedDialectButtons.push(dialectButtons.slice(i, i + 2))
    }

    // Добавляем кнопку "Далее" в отдельную строку
    groupedDialectButtons.push([
        Markup.button.callback('Далее', 'continue_with_dialect'),
    ])

    // Отправляем клавиатуру с диалектами
    await sendOrEditMessage(
        ctx,
        suggesWordHandlerSelectedLanguageBuryat,
        Markup.inlineKeyboard(groupedDialectButtons)
    )
})

// Обработчик для выбора диалекта
dialects.forEach((dialect) => {
    dictionaryWizard.action(
        `select_dialect_for_suggest_translate_${dialect.value}`,
        async (ctx) => {
            // Обновляем выбранный диалект в состоянии
            ctx.wizard.state.selectedDialect = dialect.value

            // Повторно отправляем сообщение с обновлённой клавиатурой
            const selectedDialect = ctx.wizard.state.selectedDialect

            // Формируем кнопки с диалектами, где выбранный помечен значком ✅
            const dialectButtons = dialects.map((dialect) =>
                Markup.button.callback(
                    `${selectedDialect === dialect.value ? '✅ ' : ''}${dialect.label}`,
                    `select_dialect_for_suggest_translate_${dialect.value}`
                )
            )

            // Группируем кнопки по две в строке
            const groupedDialectButtons: any = []
            for (let i = 0; i < dialectButtons.length; i += 2) {
                groupedDialectButtons.push(dialectButtons.slice(i, i + 2))
            }

            // Добавляем кнопку "Далее" в отдельную строку
            groupedDialectButtons.push([
                Markup.button.callback('Далее', 'continue_with_dialect'),
            ])

            // Отправляем обновлённое сообщение с клавиатурой
            await sendOrEditMessage(
                ctx,
                suggesWordHandlerSelectedLanguageBuryat,
                Markup.inlineKeyboard(groupedDialectButtons)
            )
        }
    )
})

// Обработчик для продолжения после выбора диалекта
dictionaryWizard.action('continue_with_dialect', async (ctx) => {
    const selectedDialect =
        ctx.wizard.state.selectedDialect || dialects[0].value

    let message = `<b>Предложение слова — Ввод слова или фразы ✍️</b>\n\n`

    message += `Вы выбрали язык: <b>Бурятский</b>\n`
    // Проверяем, выбрал ли пользователь "Не знаю"
    message +=
        selectedDialect === 'unknown'
            ? '<b>Вы не выбрали диалект</b>'
            : `Вы выбрали диалект: <b>${
                  dialects.find((d) => d.value === selectedDialect)?.label
              } </b>\n\n<i>Введите слово или фразу:</i>`

    // const actionKeyboard = Markup.inlineKeyboard([
    // Markup.button.callback("Назад", "suggest_buryat"),
    // ]);

    await sendOrEditMessage(ctx, message)

    return ctx.wizard.selectStep(2) // Переход к следующему шагу для ввода слова
})

dictionaryWizard.action(
    'select_language',
    async (ctx) => await render_select_language_section(ctx)
)
async function render_select_language_section(ctx: MyContext, reply?: boolean) {
    try {
        let message = `<b>Словарь — Найти слово 🔎\n\n</b>`
        message += `<i>Выберите язык, на котором хотите найти слово</i>`
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('Русский', 'select_russian'),
                Markup.button.callback('Бурятский', 'select_buryat'),
            ],
            [Markup.button.callback('История поиска', 'my_history')],
            [Markup.button.callback('Назад', 'back')],
        ])
        await sendOrEditMessage(ctx, message, keyboard, reply)
    } catch (error) {
        console.log(error)
    }
}

dictionaryWizard.action('my_history', async (ctx) => {
    const message = `<b>Словарь — История поиска 🔎</b>\n\n`
    // ${await getHistory(ctx.from.id)}
    ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [Markup.button.callback('Удалить историю', 'delete_history')],
                [Markup.button.callback('Назад', 'back')],
            ],
        },
    })
    ctx.wizard.selectStep(4)
    ctx.answerCbQuery()
})

dictionaryWizard.action('home', async (ctx) => {
    ctx.scene.enter('home')
})

dictionaryWizard.action('back', async (ctx) => {
    ctx.scene.enter('dictionary-wizard')
})

// Обработчик для кнопки "Модерация"
dictionaryWizard.action('consider_suggested_words', async (ctx: MyContext) =>
    renderModerationSection(ctx)
)
async function renderModerationSection(ctx: MyContext) {
    const message = `<b>Модерация</b>\nВыберите язык на котором хотите модерировать контент`

    // Создаем клавиатуру
    const consider_suggested_words_keyboard = Markup.inlineKeyboard([
        // Каждый ряд кнопок - это отдельный массив внутри основного массива
        [Markup.button.callback('Русский', 'words-consider-russian')],
        [Markup.button.callback('Бурятский', 'words-consider-buryat')],
        // Кнопка "Назад" на отдельной строке
        [Markup.button.callback('Назад', 'back-to-dictionary')],
    ])

    try {
        if (ctx.callbackQuery && ctx.callbackQuery.message) {
            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                reply_markup: consider_suggested_words_keyboard.reply_markup, // Клавиатура передается в reply_markup
            })
            // Важно ответить на callbackQuery, чтобы убрать "часики" с кнопки
            await ctx.answerCbQuery()
        } else {
            // Фоллбэк, если вдруг нет callbackQuery (маловероятно для action)
            await ctx.reply(message, {
                parse_mode: 'HTML',
                reply_markup: consider_suggested_words_keyboard.reply_markup,
            })
        }

        ctx.wizard.selectStep(7)
    } catch (error) {
        console.error('Ошибка при отправке сообщения модерации:', error)
        // Можно отправить сообщение об ошибке пользователю
        await ctx
            .reply('Произошла ошибка. Попробуйте позже.')
            .catch((err) =>
                console.error('Не удалось отправить сообщение об ошибке:', err)
            )
        // Если это сцена, возможно, стоит ее прервать
        await ctx.scene?.leave()
    }
}
// Обработчики для выбора слова по индексу
for (let i = 0; i < 10; i++) {
    dictionaryWizard.action(`select_word_${i}`, async (ctx) => {
        const page = ctx.session.page || 1
        const limit = 10

        // Получаем данные заново, чтобы выбрать правильный элемент
        const apiUrl = process.env.api_url
        const response = await fetch(
            `${apiUrl}/vocabulary/approval?page=${page}&limit=${limit}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${process.env.admintoken}`,
                    'Content-Type': 'application/json',
                },
            }
        )
        const data: any = await response.json()

        if (response.ok) {
            const selectedWord = data.words[i] // Выбираем нужное слово по индексу

            // Сохраняем _id выбранного слова в сессии
            ctx.wizard.state.selectedWordId = selectedWord._id

            // Переход на следующий шаг и предоставление кнопок действий
            await ctx.editMessageText(
                `Вы выбрали слово для рассмотрения: ${selectedWord.text} (${selectedWord.language})`
            )

            const actionKeyboard = Markup.inlineKeyboard([
                Markup.button.callback('Принять', 'approve_word'),
                Markup.button.callback('Отклонить', 'reject_word'),
                // Ошибся :)
                Markup.button.callback('Назад', 'skip_word'),
            ])

            await ctx.reply(
                'Что вы хотите сделать с этим словом?',
                actionKeyboard
            )
        } else {
            await ctx.reply('Ошибка при получении данных.')
        }
    })
}

dictionaryWizard.action('skip_word', async (ctx) => {
    const currentPage = ctx.session.page ? ctx.session.page : 1
    await fetchWordsOnApproval(ctx, currentPage)
})
dictionaryWizard.action('approve_word', async (ctx) => {
    const wordId = ctx.wizard.state.selectedWordId
    const userId = ctx.from?.id

    if (!wordId || !userId) {
        await ctx.reply('Ошибка: отсутствуют данные для принятия слова.')
        return
    }

    try {
        const apiUrl = process.env.api_url
        const response = await fetch(
            `${apiUrl}/vocabulary/accept-suggested-word`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.admintoken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    suggestedWordId: wordId,
                    telegram_user_id: userId,
                }),
            }
        )

        if (response.ok) {
            await ctx.editMessageText(
                'Слово успешно принято и добавлено в словарь.'
            )
            const page = ctx.session.page || 1 // Инициализируем page если он еще не определён
            const limit = 10 // Количество элементов на страницу

            await fetchWordsOnApproval(ctx, page, limit, true)
        } else {
            console.log(await response.json())
            await ctx.reply(`Ошибка при принятии слова`)
        }
    } catch (error) {
        console.error('Ошибка при принятии слова:', error)
        await ctx.reply('Произошла ошибка при принятии слова.')
    }

    return ctx.wizard.selectStep(2) // Возвращаемся к просмотру предложенных слов
})
dictionaryWizard.action('reject_word', async (ctx) => {
    const wordId = ctx.wizard.state.selectedWordId // ID выбранного слова
    const userId = ctx.from?.id // ID пользователя в Телеграм

    if (!wordId || !userId) {
        await ctx.reply('Ошибка: отсутствуют данные для отклонения слова.')
        return ctx.wizard.selectStep(2) // Возвращаемся к предыдущему шагу
    }

    try {
        const apiUrl = process.env.api_url // URL вашего API
        const response = await fetch(
            `${apiUrl}/vocabulary/decline-suggested-word`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.admintoken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    suggestedWordId: wordId, // ID отклоняемого слова
                    telegram_user_id: userId, // ID текущего пользователя
                }),
            }
        )

        if (response.ok) {
            await ctx.editMessageText(
                `Слово успешно отклонено и добавлено в архив отклонённых слов.`
            )
            const page = ctx.session.page || 1 // Инициализируем page если он еще не определён
            const limit = 10 // Количество элементов на страницу

            await fetchWordsOnApproval(ctx, page, limit, true)
        } else {
            await ctx.reply(`Ошибка при отклонении слова`)
        }
    } catch (error) {
        console.error('Ошибка при отклонении слова:', error)
        await ctx.reply('Произошла ошибка при отклонении слова.')
    }

    return ctx.wizard.selectStep(2) // Возвращаемся к просмотру предложенных слов
})

// Обработчик для кнопки "⬅️" (предыдущая страница)
dictionaryWizard.action('prev_page', async (ctx) => {
    try {
        // Если значение страницы не определено, инициализируем его как 1
        const currentPage = ctx.session.page ? ctx.session.page : 1

        // Переход на предыдущую страницу, минимальное значение — 1
        const prevPage = Math.max(1, currentPage - 1)

        // Обновляем значение текущей страницы в сессии
        ctx.session.page = prevPage

        if (currentPage === 1) {
            ctx.answerCbQuery()
            return false
        }

        // Запрашиваем данные для предыдущей страницы
        return await fetchWordsOnApproval(ctx, prevPage, 10)
    } catch (error) {
        return ctx.reply(`Ошибка при обработке action`)
    }
})

dictionaryWizard.action('next_page', async (ctx) => {
    try {
        // Получаем данные о текущей странице из сессии
        const currentPage = ctx.session.page ? ctx.session.page : 1
        const limit = 10

        // Запрашиваем данные для текущей страницы, чтобы узнать общее количество слов
        const apiUrl = process.env.api_url
        const response = await fetch(
            `${apiUrl}/vocabulary/approval?page=${currentPage}&limit=${limit}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${process.env.admintoken}`,
                    'Content-Type': 'application/json',
                },
            }
        )
        const data: any = await response.json()

        if (response.ok) {
            const totalWords = data.total_count // Общее количество слов
            const totalPages = Math.ceil(totalWords / limit) // Общее количество страниц

            // Проверяем, находится ли пользователь на последней странице
            if (currentPage >= totalPages) {
                // Сообщаем пользователю, что он на последней странице
                await ctx.answerCbQuery('Вы уже на последней странице.')
                return false
            }

            // Если это не последняя страница, переходим на следующую
            const nextPage = currentPage + 1
            ctx.session.page = nextPage

            // Запрашиваем данные для следующей страницы
            return await fetchWordsOnApproval(ctx, nextPage, limit)
        } else {
            return await ctx.reply('Ошибка при получении данных.')
        }
    } catch (error) {
        return ctx.answerCbQuery(`Ошибка при обработке запроса`)
    }
})

/**
 * Форматирует информацию о предложенном слове для отображения пользователю.
 * @param wordDetails - Детали предложенного слова.
 * @returns - Строка с отформатированным сообщением.
 */
function formatSuggestedWordDetails(
    wordDetails: ISuggestedWordDetails
): string {
    let message = `<b>Слово на рассмотрении 📝</b>\n\n`
    message += `<b>Слово:</b> ${wordDetails.text}\n`
    if (
        wordDetails.normalized_text &&
        wordDetails.normalized_text !== wordDetails.text
    ) {
        message += `<b>Нормализовано:</b> ${wordDetails.normalized_text}\n`
    }
    // message += `<b>Язык:</b> ${wordDetails.language === 'russian' ? 'Русский' : 'Бурятский'}\n`;

    if (wordDetails.dialect) {
        message += `<b>Диалект:</b> ${wordDetails.dialect.name || 'Не указан'}\n` // Предполагаем, что у диалекта есть поле name
    }

    message += `<b>Статус:</b> ${wordDetails.status}\n` // 'new', 'pending' и т.д.
    // --- ИСПРАВЛЕНИЕ ДЛЯ АВТОРА ---
    if (wordDetails.author && typeof wordDetails.author === 'object') {
        // Проверяем, что автор не null и это объект
        message += `<b>Автор:</b> ${wordDetails.author.username || wordDetails.author.first_name || `ID ${wordDetails.author.id}` || 'Неизвестный автор'}\n`
    } else {
        message += `<b>Автор:</b> Не указан или удален\n`
    }

    // --- ИСПРАВЛЕНИЕ ДЛЯ КОНТРИБЬЮТОРОВ ---
    if (wordDetails.contributors && wordDetails.contributors.length > 0) {
        const contributorNames = wordDetails.contributors
            .filter((c) => c && typeof c === 'object') // Отфильтровываем null/undefined и не-объекты
            .map(
                (c) =>
                    (c as ITelegramUserPopulated).username ||
                    (c as ITelegramUserPopulated).first_name ||
                    `ID ${(c as ITelegramUserPopulated).id}` ||
                    'Неизвестный контрибьютор'
            )
            .join(', ')
        if (contributorNames) {
            // Если после фильтрации и маппинга остались имена
            message += `<b>Контрибьюторы:</b> ${contributorNames}\n`
        }
    }
    if (
        wordDetails.pre_translations &&
        wordDetails.pre_translations.length > 0
    ) {
        message += `\n<b>Предварительные переводы/связанные слова:</b>\n`
        wordDetails.pre_translations.forEach((pt, index) => {
            message += `  ${index + 1}. ${pt.text}`
            // Можно добавить больше деталей о pt, если нужно
            message += `\n`
        })
    }

    // Отображение дат в удобочитаемом формате
    const createdAtDate = new Date(wordDetails.createdAt)
    message += `<b>Предложено:</b> ${createdAtDate.toLocaleString('ru-RU')}\n`

    if (
        wordDetails.updatedAt &&
        wordDetails.updatedAt !== wordDetails.createdAt
    ) {
        const updatedAtDate = new Date(wordDetails.updatedAt)
        message += `<b>Обновлено:</b> ${updatedAtDate.toLocaleString('ru-RU')}\n`
    }

    return message
}

/**
 * Рендерит экран с деталями выбранного слова и кнопками для модерации.
 * @param ctx - Контекст Telegraf.
 * @param wordDetailsResponse - Ответ от API с деталями слова.
 */
async function renderSuggestedWordForConsiderationScreen(
    ctx: MyContext,
    wordDetailsResponse: ISuggestedWordDetailsResponse
) {
    const word = wordDetailsResponse.word
    const messageText = formatSuggestedWordDetails(word)

    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback(
                '✅ Принять',
                `consider_action_accept_${word._id}`
            ),
            Markup.button.callback(
                '❌ Отклонить',
                `consider_action_decline_${word._id}`
            ),
        ],
        [Markup.button.callback('⬅️ Назад к списку', 'back_to_consider_list')],
    ])

    // Используем sendOrEditMessage для обновления существующего сообщения или отправки нового
    await sendOrEditMessage(ctx, messageText, keyboard)
}

// async function renderKeyboardDialects(_ctx: MyContext, selectedDialect: string) {
//   try {
//     // Формируем клавиатуру с диалектами, где выбранный помечен значком ✅
//     const dialectButtons = dialects.map((dialect) => [
//       Markup.button.callback(
//         `${selectedDialect === dialect.value ? "✅ " : ""}${dialect.label}`,
//         `select_dialect_for_suggest_translate_${dialect.value}`
//       ),
//     ]);

//     return dialectButtons;
//   } catch (error) {
//     console.log(error);
//     return [];
//   }
// }

export default dictionaryWizard
