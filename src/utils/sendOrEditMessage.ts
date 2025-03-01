import { Markup } from 'telegraf'
import { MyContext } from '../types/MyContext'
import logger from './logger'
import { blockUser } from './blockUser'

// Функция для отправки или редактирования сообщений
const sendOrEditMessage = async (
    ctx: MyContext,
    text: string,
    buttons?: ReturnType<typeof Markup.inlineKeyboard> | null,
    reply?: boolean
) => {
    try {
        const inlineKeyboard = buttons?.reply_markup?.inline_keyboard || [] // Убедитесь, что кнопки существуют или используем пустой массив
        if (reply) {
            await ctx.reply(text, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: inlineKeyboard },
                link_preview_options: {
                    is_disabled: true,
                },
            })
        } else {
            if (ctx.updateType === 'callback_query') {
                try {
                    await ctx.editMessageText(text, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: inlineKeyboard, // Передаем массив кнопок
                        },
                        link_preview_options: {
                            is_disabled: true,
                        },
                    })
                } catch (err) {
                    // Игнорируем ошибку, если сообщение уже было отредактировано
                }
            } else {
                await ctx.reply(text, {
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: inlineKeyboard },
                    link_preview_options: {
                        is_disabled: true,
                    },
                })
                // await ctx.telegram.sendMessage(1471276151, 'привет')
            }
        }
    } catch (error) {
        logger.error(
            // @ts-ignore
            `Ошибка при отправке сообщения, ${error.response.description} ${error.on.payload.chat_id}`
        )
        
        // @ts-ignore
        if (error.response.description === 'Forbidden: bot was blocked by the user') {
            // @ts-ignore
            const res = await blockUser(error.on.payload.chat_id)
            logger.info(res.message)
        }
    }
}

export default sendOrEditMessage
