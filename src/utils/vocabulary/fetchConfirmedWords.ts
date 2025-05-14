import { Markup } from "telegraf"
import { MyContext } from "../../types/MyContext"
import sendOrEditMessage from "../sendOrEditMessage"
import { IWordModel } from "../../types/vocabulary/IWordModel"
import { createResultMessage } from "./fetchWordsOnApproval"

interface fetchPaginatedWordsResponse {
    message: string
    items: IWordModel[]
    totalItems: number
    currentPage: number
    totalPages: number
}

/**
 * Fetches paginated confirmed words from the API and sends them to the user.
 *
 * @param {MyContext} ctx - The context of the bot.
 * @param {number} [page=1] - The page number to fetch.
 * @param {number} [limit=10] - The number of items per page.
 * @param {'russian' | 'buryat'} language - The language of the words to fetch.
 * @param {boolean} [reply=false] - Whether to reply to the user or edit the message.
 * @return {Promise<void>}
 */
export async function fetchPaginatedWords(
    ctx: MyContext,
    page = 1,
    limit = 10,
    language: 'russian' | 'buryat',
    reply = false
) {
    try {
        const apiUrl = process.env.api_url
        const response = await fetch(
            `${apiUrl}/vocabulary/confirmed-words?page=${page}&limit=${limit}&language=${language}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${process.env.admintoken}`,
                    'Content-Type': 'application/json',
                },
            }
        )
        const data = (await response.json()) as fetchPaginatedWordsResponse

        if (response.ok) {
            const { items, totalItems } = data

            if (totalItems === 0) {
                ctx.answerCbQuery(`Предложенных слов нет`)
                return
            }

            // Формируем сообщение с результатами
            const resultMessage = await createResultMessage(
                items,
                totalItems,
                page,
                limit
            )
            // Формируем клавиатуру, используя word._id
            const selectionButtons: any = items.map(
                (word: IWordModel, index: number) =>
                    Markup.button.callback(
                        `${index + 1}`,
                        `select_word_for_suggest_translate_${word._id}`
                    )
            )

            // Разбиваем кнопки по два ряда (по 5 кнопок на ряд)
            const rows: any = []
            for (let i = 0; i < selectionButtons.length; i += 5) {
                rows.push(selectionButtons.slice(i, i + 5))
            }

            // Добавляем пагинацию в отдельный ряд
            const paginationButtons = [
                Markup.button.callback('⬅️', 'prev_page'),
                Markup.button.callback('Назад', 'back'),
                Markup.button.callback('➡️', 'next_page'),
            ]

            const selectionKeyboard = Markup.inlineKeyboard([
                ...rows,
                paginationButtons,
            ])

            ctx.session.page = page

            await sendOrEditMessage(
                ctx,
                resultMessage,
                selectionKeyboard,
                reply
            )
            ctx.wizard.selectStep(4) // Переход на шаг 4
        } else {
            await ctx.reply('Ошибка при получении данных.')
        }
    } catch (error) {
        console.error(error)
        await ctx.reply('Произошла ошибка при запросе.')
    }
}
