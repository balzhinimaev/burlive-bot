import express from 'express'
import { Markup, Scenes, session, Telegraf } from 'telegraf'
import dotenv from 'dotenv'
dotenv.config() // Загружаем переменные окружения
import bodyParser from 'body-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import compression from 'compression'
import { MyContext } from './types/MyContext'
import dictionaryWizard from './dictionaryWizard'
import sendOrEditMessage from './utils/sendOrEditMessage'
import subscribeWizard from './subscribe'
import { fetchUser } from './utils/fetchUser'
import { createUser } from './utils/createUser'
import logger from './utils/logger'
import dashboardWizard from './dashboard'
import { saveAction } from './utils/saveAction'
import { apiLimiter, authLimiter } from './middleware/rateLimiter'
import { errorHandler } from './middleware/errorHandler'
import { addRequestId } from './middleware/requestId'
import config from './config'

const app = express()
app.use(helmet()) // Security headers
app.use(compression()) // Response compression
// app.use(bodyParser.json())
app.use(addRequestId) // Add unique request ID
app.use(morgan('combined'))
app.use(express.json())

// Initialize Telegram bot
const bot = new Telegraf<MyContext>(config.bot.token)

// Home scene messages and keyboards
const HOME_GREETING_MESSAGE = `<b>Самоучитель бурятского языка</b>\n\nКаждое взаимодействие с ботом влияет на сохранение и дальнейшее развитие Бурятского языка\n\nВыберите раздел, чтобы приступить`
const HOME_KEYBOARD = Markup.inlineKeyboard([
    [
        Markup.button.webApp('🚀 Самоучитель', config.bot.webappUrl),
        Markup.button.callback('📘 Словарь', 'dictionary-wizard'),
    ],
    [Markup.button.webApp('🏆 Лидерборд', config.leaderboard.url)],
    [Markup.button.callback('💎 Премиум доступ', 'subcribe')],
    [Markup.button.callback('👤 Личный кабинет', 'dashboard-wizard')],
])

// Webhook setup function
const setWebhook = async (url: string) => {
    try {
        await bot.telegram.setWebhook(`${url}${config.bot.secretPath}`)
        console.log(`Webhook set: ${url}${config.bot.secretPath}`)
    } catch (error) {
        console.error('Error setting webhook:', error)
    }
}

// Set webhook for production mode
if (config.env === 'production') {
    const siteUrl = config.site.url || 'https://example.com'
    setWebhook(siteUrl)
}

/**
 * User registration and welcome message
 * @param ctx - Telegram context
 * @param referralCode - Optional referral code
 * @returns Promise<boolean> - Success status
 */
const registerUser = async (
    ctx: MyContext,
    referral?: string
): Promise<boolean> => {
    try {
        const userId = ctx.from?.id
        if (!userId) throw new Error('User ID not found')

        const request = await createUser(
            userId,
            ctx.from.first_name,
            referral || '',
            ctx.from.last_name,
            ctx.from.username,
            config.bot.username
        )

        // Welcome message
        let welcomeMessage: string =
            '<b>Привет!</b> Добро пожаловать в наш языковой бот, где обучение – это игра:\n\n'
        welcomeMessage += '• <b>Самоучитель:</b> Учись легко и без скуки.\n'
        welcomeMessage +=
            '• <b>Языковой корпус &amp; словарь:</b> Добавляй крутые примеры, ищи переводы в пару кликов.\n'
        welcomeMessage +=
            '• <b>Голосование, рейтинги &amp; конкурсы:</b> Твое мнение решает, а активность вознаграждается!\n\n'
        welcomeMessage +=
            'Готов прокачать навыки и создавать контент? Поехали!\n\n'
        welcomeMessage +=
            'Этот проект все еще на стадии доработки, как закончим, мы вам напишем! Пожалуйста, не блокируйте бота.'

        let refIsExists: boolean = false

        // Track referral if provided
        if (request.user && referral) {
            try {
                // logger.info(referralCode)
                await fetch(`${config.api.url}/telegram/user/track-referral`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, referral }),
                })
            } catch (error) {
                logger.error(`Error tracking referral: ${error}`)
            }
        }

        if (request.user) {
            logger.info(`User ${userId} registered!`)

            bot.telegram.sendMessage(
                config.chats.informator,
                `Пользователь: <code>${userId}</code> зарегистирован\n` +
                    `Рефералка: ${referral ? '<code>' + referral + '</code>' : 'Отсутствует'}`,
                {
                    parse_mode: 'HTML',
                }
            )
            await ctx.reply(welcomeMessage, {
                parse_mode: 'HTML',
                reply_markup: { remove_keyboard: true },
            })
            return true
        } else {
            return false
        }
    } catch (error) {
        logger.error(`Registration error: ${error}`)
        return false
    }
}

/**
 * Handle user start or entry
 * @param ctx - Telegram context
 * @returns Promise<void>
 */
const handleUserEntry = async (ctx: MyContext): Promise<void> => {
    try {
        const userId = ctx.from?.id
        // logger.info(`${userId}`)
        if (!userId) throw new Error('User ID not found')

        // Extract referral code if present
        let referralCode: string | undefined
        if (ctx.startPayload && ctx.startPayload.startsWith('ref_')) {
            referralCode = ctx.startPayload.substring(4)
        }

        const userStatus = await fetchUser(userId)

        // logger.info(`${userStatus.is_exists}`)
        if (userStatus.is_exists) {
            if (referralCode) {
                await ctx.reply('Вы уже зарегистрированы в системе')
            }
            await ctx.scene.enter('home')
        } else {
            const success = await registerUser(ctx, referralCode)
            if (success) {
                await ctx.scene.enter('home')
            } else {
                throw new Error('Failed to register user')
            }
        }
    } catch (error) {
        // console.log(error)
        logger.error(`Entry error: ${error}`)
        const message =
            'Произошла ошибка, попробуйте позже, или свяжитесь @frntdev или введите /start'
        await sendOrEditMessage(
            ctx,
            message,
            Markup.inlineKeyboard([[Markup.button.callback('Назад', 'back')]])
        )
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: Date.now(),
    })
})

app.post('/send_message', async (req, res): Promise<void> => {

    const { source_language, target_language, user, result } = req.body

    const userId = user.id

    try {
        await bot.telegram.sendMessage(
            config.chats.vocabulary_logger,
            `Пользователь: <code>${userId}</code>\n` + `burlangdb: ${result}`,
            {
                parse_mode: 'HTML',
            }
        )
        res.status(200).json({ message: "Сообщение отправлено" })
        return
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Ошибка при отправке сообщения" })
    }

    return
})

// Graceful shutdown handling
const gracefulShutdown = async () => {
    logger.info('Received shutdown signal, closing connections...')

    // Close the bot webhook
    try {
        await bot.telegram.deleteWebhook()
        logger.info('Bot webhook deleted')
    } catch (error) {
        logger.error(`Error deleting webhook: ${error}`)
    }

    // Close any database connections here
    // db.close()

    logger.info('All connections closed, shutting down')
    process.exit(0)
}

// Register shutdown handlers
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Global error handler
app.use(errorHandler)

app.use(config.bot.secretPath, async (req, res) => {
    try {
        await bot.handleUpdate(req.body, res)
    } catch (error) {
        logger.error(`Webhook processing error: ${error}`)
    }
})

app.get('/success/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params

        await bot.telegram.sendSticker(
            user_id,
            'CAACAgIAAxkBAAJO9meo05D2PXjCHlhtwBt5r7iGr9xlAAINAAOWn4wONM9_DtpaNXU2BA'
        )

        await bot.telegram.sendMessage(user_id, 'Получен платеж', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'На главную', callback_data: 'back' }],
                ],
            },
        })

        res.status(200).json({
            message: 'Сообщение про подписку успешно отправлено!',
        })
    } catch (error) {
        logger.error(`Payment success handler error: ${error}`)
        res.status(500).json({ error: 'Internal server error' })
    }
})

// Создание основной (главной) сцены
const homeScene = new Scenes.BaseScene<MyContext>('home')

// Обработка действия "dictionary-wizard"
homeScene.action('dictionary-wizard', async (ctx: MyContext) => {
    await ctx.scene.enter('dictionary-wizard')
})

// Создание Stage для управления сценами
const stage = new Scenes.Stage<MyContext>(
    [
        homeScene,
        dictionaryWizard,
        // sentencesScene,
        dashboardWizard,
        // selfTeacherScene,
        subscribeWizard,
    ],
    {
        default: 'home',
    }
)

// Использование middleware сессий и сцен
bot.use(session())
bot.use(async (ctx, next) => {
    if (ctx.update.channel_post) {
        return
    }

    const userId = ctx.from?.id
    // console.log(userId)
    if (!userId) throw Error
    // logger.info(`${userId} Запускает бота`)

    const updateType = ctx.updateType
    let message = ``
    let photo = ``
    let scene = ``
    // if (updateType === 'message') {
    //     if (ctx.update.message) {
    //         message = ctx.update.message
    //         saveAction(userId, updateType, message)
    //     }
    // }

    if (updateType === 'callback_query') {
        try {
            const userStatus = await fetchUser(userId)
            if (!userStatus.is_exists) {
                await registerUser(ctx)
                await sendOrEditMessage(
                    ctx,
                    HOME_GREETING_MESSAGE,
                    HOME_KEYBOARD,
                    true
                )
                return
            }
        } catch (error) {
            console.log(error)
            sendOrEditMessage(
                ctx,
                `Произошла ошибка, повторите запрос или отправьте /start`
            )
            logger.error(error)
            throw Error
        }

        const data: 'dashboard-wizard' | 'home-scene' | 'subscribe' =
            ctx.update.callback_query.data
        if (
            data === 'dashboard-wizard' ||
            data === 'subscribe' ||
            data === 'home-scene'
        ) {
            ctx.currentScene = data
        }
        // saveAction(userId, updateType, data)
    }

    return next()
})

bot.use(stage.middleware())

// Bot command handlers
bot.start(handleUserEntry)
homeScene.start(handleUserEntry)

homeScene.enter((ctx) => {
    sendOrEditMessage(ctx, HOME_GREETING_MESSAGE, HOME_KEYBOARD)
})
// Запуск сервера
app.listen(config.port, () => {
    logger.info(`Server started on port ${config.port} in ${config.env} mode`)

    // Log system information
    logger.info(`Node version: ${process.version}`)
    logger.info(
        `Memory usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`
    )
})

bot.action('dictionary-wizard', async (ctx) => {
    ctx.scene.enter('dictionary-wizard')
    await ctx.answerCbQuery()
})
bot.action('subcribe', async (ctx) => {
    await ctx.scene.enter('subscribe-wizard')
})
bot.action('dashboard-wizard', async (ctx) => {
    await ctx.scene.enter('dashboard-wizard')
})
// Handle other actions (fallback)
homeScene.action(/^.*$/, async (ctx) => {
    try {
        const userId = ctx.from?.id

        if (ctx.from?.is_bot || !userId) {
            throw new Error('Invalid user or bot')
        }

        const userStatus = await fetchUser(userId)

        if (userStatus.is_exists) {
            await sendOrEditMessage(ctx, HOME_GREETING_MESSAGE, HOME_KEYBOARD)
            ctx.answerCbQuery()
            return
        } else {
            // Clean up old messages
            if (ctx.update.callback_query.message?.message_id) {
                for (let i = ctx.update.callback_query.message.message_id; i !== 0; i--) {
                    await ctx.deleteMessage(i).catch(error => {
                        console.log(`Failed to delete message ${i}: ${error}`)
                    })
                    logger.info(`Message ${i} deleted`)
                }
            }

            const success = await registerUser(ctx)
            if (success) {
                await sendOrEditMessage(ctx, HOME_GREETING_MESSAGE, HOME_KEYBOARD, true)
            } else {
                logger.error('Error in action handler during user registration')
                throw new Error('Failed to register user')
            }
        }
    } catch (error) {
        logger.error(`Action handler error: ${error}`)
        await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте снова.')
    }
})

// homeScene.on('message', async (ctx) => {
// console.log(ctx.update.message)
// // ctx.telegram.sendSticker()
// })
