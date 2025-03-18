import express from 'express'
import { Markup, Scenes, session, Telegraf } from 'telegraf'
import dotenv from 'dotenv'
dotenv.config() // Загружаем переменные окружения
import bodyParser from 'body-parser'
import morgan from 'morgan'
import { MyContext } from './types/MyContext'
import dictionaryWizard from './dictionaryWizard'
import sendOrEditMessage from './utils/sendOrEditMessage'
import subscribeWizard from './subscribe'
import { fetchUser } from './utils/fetchUser'
import { createUser } from './utils/createUser'
import logger from './utils/logger'
import dashboardWizard from './dashboard'
import { saveAction } from './utils/saveAction'
import { error } from 'console'

const app = express()
const botusername = process.env.botusername
app.use(bodyParser.json())
app.use(morgan('dev'))

const port = process.env.PORT || 1442
const mode = process.env.mode || 'development'
const secretPath = `/${process.env.secret_path}` || ''
const bot = new Telegraf<MyContext>(process.env.bot || '')
// Функция для установки вебхука
const setWebhook = async (url: string) => {
    try {
        // await bot.telegram.deleteWebhook()
        await bot.telegram.setWebhook(`${url}${secretPath}`)
        console.log(`Webhook установлен: ${url}${secretPath}`)
        // const info = await bot.telegram.getWebhookInfo()
        // console.log(info)
    } catch (error) {
        console.error('Ошибка при установке вебхука:', error)
    }
}

// Конфигурация для разных режимов
// if (mode === 'development') {
    // const fetchNgrokUrl = async () => {
        // try {
            // const res = await fetch('http://127.0.0.1:4040/api/tunnels')
            // const json: any = await res.json()
            // const secureTunnel = json.tunnels[0].public_url
            // console.log(`Ngrok URL: ${secureTunnel}`)
            // await setWebhook(secureTunnel)
        // } catch (error) {
            // console.error('Ошибка при получении URL из ngrok:', error)
        // }
    // }
    // fetchNgrokUrl()
// } else 

if (mode === 'production') {
    const siteUrl = process.env.site_url || 'https://example.com'
    setWebhook(`${siteUrl}`)
}

// Middleware для обработки запросов от Telegram
app.use(express.json())
app.use('/hello', async (req, res) => {
    res.status(200).json({ message: 'hello' })
    return
})
app.use(`${secretPath}`, async (req, res) => {
    try {
        console.log(`${secretPath}`)
        await bot.handleUpdate(req.body, res)
    } catch (error) {
        logger.error(`Ошибка обработки вебхука\n ${error}`)
    }
})
app.get(`/success/:user_id`, async (req, res) => {
    const { user_id } = req.params
    console.log(user_id)
    await bot.telegram.sendSticker(
        user_id,
        'CAACAgIAAxkBAAJO9meo05D2PXjCHlhtwBt5r7iGr9xlAAINAAOWn4wONM9_DtpaNXU2BA'
    )
    await bot.telegram.sendMessage(user_id, 'Получен платеж', {
        reply_markup: {
            inline_keyboard: [[{ text: 'На главную', callback_data: 'back' }]],
        },
    })
    res.status(200).json({
        message: 'Сообщение про подписку успешно отправлено!',
    })
    return
})

// Создание основной (главной) сцены
const homeScene = new Scenes.BaseScene<MyContext>('home')
const webapp_url = process.env.webapp_url

if (!webapp_url) {
    throw 'webappurl not setted'
}

const homeKeyboard = Markup.inlineKeyboard([
    [
        Markup.button.webApp('🚀 Самоучитель', webapp_url), // Замените на URL вашего веб-приложения
        Markup.button.callback('📘 Словарь', 'dictionary-wizard'),
    ],
    [Markup.button.webApp('🏆 Лидерборд', 'https://anoname.xyz/leaderboard')],
    [Markup.button.callback('💎 Премиум доступ', 'subcribe')],
    [Markup.button.callback('👤 Личный кабинет', 'dashboard-wizard')],
])
const homeGreetingMessage = `<b>Самоучитель бурятского языка</b>\n\nКаждое взаимодействие с ботом влияет на сохранение и дальнейшее развитие Бурятского языка\n\nВыберите раздел, чтобы приступить`
homeScene.enter((ctx) => {
    // console.log(`Вход в сцену Home`)
    sendOrEditMessage(ctx, homeGreetingMessage, homeKeyboard)
})
homeScene.start((ctx) => {
    sendOrEditMessage(ctx, homeGreetingMessage, homeKeyboard)
})
// homeScene.leave(async (ctx) => {
//     // console.log(`Выход из сцен Home`)
// })
// Обработка действия "dictionary-wizard"
homeScene.action('dictionary-wizard', async (ctx: MyContext) => {
    await ctx.scene.enter('dictionary-wizard')
})
homeScene.on('message', async (ctx: any) => {
    if (ctx.update.message) {
        if (ctx.update.message.text) {
            const message: string = ctx.update.message.text
            if (message === 'Поехали') {
            }
        }
    }
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
        ttl: 300,
    }
)

// Использование middleware сессий и сцен
bot.use(session())
bot.use((ctx, next) => {
    const userId = ctx.from?.id
    if (!userId) throw Error
    // logger.info(`${userId} Запускает бота`)

    const updateType = ctx.updateType
    let message = ``
    let photo = ``
    let scene = ``
    if (updateType === 'message') {
        if (ctx.update.message) {
            message = ctx.update.message
            saveAction(userId, updateType, message)
        }
    }

    if (updateType === 'callback_query') {
        const data: 'dashboard-wizard' | 'home-scene' | 'subscribe' =
            ctx.update.callback_query.data
        if (
            data === 'dashboard-wizard' ||
            data === 'subscribe' ||
            data === 'home-scene'
        ) {
            ctx.currentScene = data
        }
        saveAction(userId, updateType, data)
    }

    return next()
})
bot.use(stage.middleware())

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port} в режиме ${mode}`)
})

bot.start(async (ctx: MyContext) => {
    try {
        const userId = ctx.from?.id
        if (!userId) throw Error

        let referralCode: any
        if (ctx.startPayload) {
            const startParameter = ctx.startPayload
            if (startParameter && startParameter.startsWith('ref_')) {
                referralCode = startParameter.substring(4) // Remove 'ref_' prefix
            }
        }

        console.log(referralCode)

        const userStatus = await fetchUser(userId)
        // console.log(userStatus)
        if (userStatus.is_exists) {
            if (referralCode) {
                ctx.reply('Вы уже зарегистрированы в системе')
            }
            ctx.scene.enter('home')
        } else {
            const request = await createUser(
                userId,
                ctx.from.first_name,
                referralCode,
                ctx.from.last_name,
                ctx.from.username,
                botusername
            )
            let welcomeMessage: string =
                '<b>Привет!</b> Добро пожаловать в наш языковой бот, где обучение – это игра:\n'
            welcomeMessage += '\n'
            welcomeMessage += '• <b>Самоучитель:</b> Учись легко и без скуки.\n'
            welcomeMessage +=
                '• <b>Языковой корпус &amp; словарь:</b> Добавляй крутые примеры, ищи переводы в пару кликов.\n'
            welcomeMessage +=
                '• <b>Голосование, рейтинги &amp; конкурсы:</b> Твое мнение решает, а активность вознаграждается!\n'
            welcomeMessage += '\n'
            welcomeMessage +=
                'Готов прокачать навыки и создавать контент? Поехали!\n\n'
            welcomeMessage += `Этот проект все еще на стадии доработки, как закончим, мы вам напишем! Пожалуйста, не блокируйте бота.`

            if (request.user && referralCode) {
                // Track referral
                try {
                    await fetch(
                        `${process.env.api_url}/telegram/user/track-referral`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                userId,
                                referralCode,
                            }),
                        }
                    )
                } catch (error) {
                    logger.error(`Error tracking referral: ${error}`)
                }
            }

            if (request.user) {
                logger.info(`Пользователь ${userId} зарегистрирован!`)
                await ctx.reply(welcomeMessage, {
                    parse_mode: 'HTML',
                    reply_markup: { remove_keyboard: true },
                })
                ctx.scene.enter('home')
            } else {
                throw Error
            }
        }
    } catch (error) {
        logger.error(`Ошибка`)
        const message = `Произошла ошибка, попробуйте позже, или свяжитесь @frntdev или введите /start`
        await sendOrEditMessage(
            ctx,
            message,
            Markup.inlineKeyboard([[Markup.button.callback('Назад', 'back')]])
        )
    }
})
homeScene.start(async (ctx: MyContext) => {
    try {
        const userId = ctx.from?.id
        if (!userId) throw Error

        let referralCode: any
        if (ctx.startPayload) {
            const startParameter = ctx.startPayload
            if (startParameter && startParameter.startsWith('ref_')) {
                referralCode = startParameter.substring(4) // Remove 'ref_' prefix
            }
        }

        console.log(referralCode)

        const userStatus = await fetchUser(userId)
        // console.log(userStatus)
        if (userStatus.is_exists) {
            if (referralCode) {
                ctx.reply('Вы уже зарегистрированы в системе')
            }
            ctx.scene.enter('home')
        } else {
            const request = await createUser(
                userId,
                referralCode,
                ctx.from.first_name,
                ctx.from.last_name,
                ctx.from.username,
                botusername
            )
            let welcomeMessage: string =
                '<b>Привет!</b> Добро пожаловать в наш языковой бот, где обучение – это игра:\n'
            welcomeMessage += '\n'
            welcomeMessage += '• <b>Самоучитель:</b> Учись легко и без скуки.\n'
            welcomeMessage +=
                '• <b>Языковой корпус &amp; словарь:</b> Добавляй крутые примеры, ищи переводы в пару кликов.\n'
            welcomeMessage +=
                '• <b>Голосование, рейтинги &amp; конкурсы:</b> Твое мнение решает, а активность вознаграждается!\n'
            welcomeMessage += '\n'
            welcomeMessage +=
                'Готов прокачать навыки и создавать контент? Поехали!\n\n'
            welcomeMessage += `Этот проект все еще на стадии доработки, как закончим, мы вам напишем! Пожалуйста, не блокируйте бота.`

            if (request.user && referralCode) {
                // Track referral
                try {
                    await fetch(
                        `${process.env.api_url}/telegram/user/track-referral`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                userId,
                                referralCode,
                            }),
                        }
                    )
                } catch (error) {
                    logger.error(`Error tracking referral: ${error}`)
                }
            }

            if (request.user) {
                logger.info(`Пользователь ${userId} зарегистрирован!`)
                await ctx.reply(welcomeMessage, {
                    parse_mode: 'HTML',
                    reply_markup: { remove_keyboard: true },
                })
                ctx.scene.enter('home')
            } else {
                throw Error
            }
        }
    } catch (error) {
        logger.error(`Ошибка`)
        const message = `Произошла ошибка, попробуйте позже, или свяжитесь @frntdev или введите /start`
        await sendOrEditMessage(
            ctx,
            message,
            Markup.inlineKeyboard([[Markup.button.callback('Назад', 'back')]])
        )
    }
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
bot.action(/^.*$/, async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) throw Error
    const userStatus = await fetchUser(userId)
    if (userStatus.is_exists) {
        await sendOrEditMessage(ctx, homeGreetingMessage, homeKeyboard)
        ctx.answerCbQuery()
        return
    } else {
        if (ctx.update.callback_query.message?.message_id) {
            for (
                let i = ctx.update.callback_query.message?.message_id;
                i !== 0;
                i--
            ) {
                await ctx.deleteMessage(i).catch(error => {
                    console.log(error)
                })
                logger.info(`Сообщение ${i} удалено`)
            }
        }

        const request = await createUser(
            userId,
            '',
            ctx.from.first_name,
            ctx.from.last_name,
            ctx.from.username,
            botusername
        )
        let welcomeMessage: string =
            '<b>Привет!</b> Добро пожаловать в наш языковой бот, где обучение – это игра:\n'
        welcomeMessage += '\n'
        welcomeMessage += '• <b>Самоучитель:</b> Учись легко и без скуки.\n'
        welcomeMessage +=
            '• <b>Языковой корпус &amp; словарь:</b> Добавляй крутые примеры, ищи переводы в пару кликов.\n'
        welcomeMessage +=
            '• <b>Голосование, рейтинги &amp; конкурсы:</b> Твое мнение решает, а активность вознаграждается!\n'
        welcomeMessage += '\n'
        welcomeMessage +=
            'Готов прокачать навыки и создавать контент? Поехали!\n\n'
        welcomeMessage += `Этот проект все еще на стадии доработки, как закончим, мы вам напишем! Пожалуйста, не блокируйте бота.`

        // if (request.user && referralCode) {
        //     // Track referral
        //     try {
        //         await fetch(
        //             `${process.env.api_url}/telegram/user/track-referral`,
        //             {
        //                 method: 'POST',
        //                 headers: {
        //                     'Content-Type': 'application/json',
        //                 },
        //                 body: JSON.stringify({
        //                     userId,
        //                     referralCode,
        //                 }),
        //             }
        //         )
        //     } catch (error) {
        //         logger.error(`Error tracking referral: ${error}`)
        //     }
        // }

        if (request.user) {
            logger.info(`Пользователь ${userId} зарегистрирован!`)
            await ctx.reply(welcomeMessage, {
                parse_mode: 'HTML',
                reply_markup: { remove_keyboard: true },
            })
            sendOrEditMessage(ctx, homeGreetingMessage, homeKeyboard, true)
            return
        } else {
            logger.error('Ошибка в index.ts при обработке действий кнопок')
            throw Error
        }
    }
})

// bot.on('message', async (ctx) => {
// console.log(ctx.update.message)
// ctx.telegram.sendSticker()
// })
