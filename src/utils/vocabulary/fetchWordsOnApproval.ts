import { Markup } from "telegraf"
import { MyContext } from "../../types/MyContext"
import { IWordModel } from "../../types/vocabulary/IWordModel"
import sendOrEditMessage from "../sendOrEditMessage"
interface WordsOnApprovalResponse {
    words: IWordModel[]
    total_count: number
}
const dialectNames: { [key: string]: string } = {
    khori: 'Хоринский диалект',
    bulagat: 'Булагатский диалект',
    sartul: 'Сартульский диалект',
    unknown: 'Неизвестный диалект',
    // Добавьте другие диалекты, если они есть
}
// Словари для перевода языков и диалектов с индекс сигнатурой
const languageNames: { [key: string]: string } = {
    russian: 'Русский язык',
    buryat: 'Бурятский язык',
    // Добавьте другие языки, если они есть
}
export default async function fetchWordsOnApproval(
    ctx: MyContext,
    page = 1,
    limit = 10,
    reply = false
) {
    try {
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

        if (response.ok) {
            const data = (await response.json()) as WordsOnApprovalResponse
            const { words, total_count } = data

            // Формируем результат и клавиатуру
            const resultMessage = await createResultMessage(
                words,
                total_count,
                page,
                limit
            )

            const selectionButtons = [
                words
                    .slice(0, 5)
                    .map((_word: IWordModel, index: number) =>
                        Markup.button.callback(
                            `${index + 1}`,
                            `select_word_${index}`
                        )
                    ),
                words
                    .slice(5, 10)
                    .map((_word: IWordModel, index: number) =>
                        Markup.button.callback(
                            `${index + 6}`,
                            `select_word_${index + 5}`
                        )
                    ),
            ]

            const paginationButtons = [
                Markup.button.callback('⬅️', 'prev_page'),
                Markup.button.callback('Назад', 'back'),
                Markup.button.callback('➡️', 'next_page'),
            ]

            const selectionKeyboard = Markup.inlineKeyboard([
                ...selectionButtons,
                paginationButtons,
            ])
            ctx.session.page = page

            await sendOrEditMessage(
                ctx,
                resultMessage,
                selectionKeyboard,
                reply
            )
            ctx.wizard.selectStep(3)
        } else {
            await ctx.reply('Ошибка при получении данных.')
        }
    } catch (error) {
        console.error(error)
        await ctx.reply('Произошла ошибка при запросе.')
    }
}

export async function createResultMessage(
    words: IWordModel[],
    total_count: number,
    page: number,
    limit: number
) {
    // Вычисляем общее количество страниц
    const totalPages = Math.ceil(total_count / limit)

    let resultMessage = `<b>Словарь — Добавление переводов ✍️</b>\n\n`
    // Формируем строку с указанием текущей страницы и общего количества страниц
    resultMessage += `<b>Страница ${page}/${totalPages}</b>\n`
    resultMessage += `<i>Показано  ${page * limit - limit + 1}-${Math.min(
        page * limit,
        total_count
    )} из ${total_count} слов которым нужно добавить перевод</i>\n\n`

    words.forEach((word, index) => {
        const languageFullName = languageNames[word.language] || word.language
        const dialectFullName = word.dialect
            ? dialectNames[word.dialect] || word.dialect
            : ''

        // Если индекс не равен 10, добавляем пробел после номера
        const indexStr = index + 1 === 10 ? `${index + 1}. ` : `${index + 1}.  `

        resultMessage += `${indexStr}${word.text} – <i>Переводов (${word.translations.length}), ${
            dialectFullName ? `, ${dialectFullName}` : ''
        }</i>\n`
    })

    resultMessage += `\n<i><b>Выберите номер слова, к которому будете добавлять перевод</b></i>`

    return resultMessage
}