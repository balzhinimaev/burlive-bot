import { Scenes, Composer, Markup } from 'telegraf'
import { MyContext } from './types/MyContext'
import sendOrEditMessage from './utils/sendOrEditMessage'
import { fetchUser } from './utils/fetchUser'
import { savePhoneNumber } from './utils/savePhoneNumber'
import logger from './utils/logger'
import { fetchUserReferralInfo } from './utils/fetchUserReferralInfo'

// Клавиатура с кнопками подписки
const dashboardButtons = Markup.inlineKeyboard([
    [Markup.button.callback('Информация о проекте', 'about')],
    // [Markup.button.callback("Мои данные", "home")],
    [Markup.button.callback('Справочные материалы', 'home')],
    [Markup.button.callback('💰 Зарабатывайте с нами', 'refferal')],
    [
        Markup.button.callback('Назад', 'back'),
        Markup.button.url('Обратная связь', 'https://t.me/frntdev'), // Ссылка на обратную связь
    ],
])
// Клавиатура с кнопками для рефереров
const referralButtons = Markup.inlineKeyboard([
    [Markup.button.callback('Статистика', 'stats')],
    [Markup.button.callback('Вывод средств', 'withdraw')],
    // [Markup.button.callback('💰 Зарабатывайте с нами', 'refferal')],
    [
        Markup.button.callback('Назад', 'back-to-dashboard'),
        Markup.button.url('Обратная связь', 'https://t.me/frntdev'), // Ссылка на обратную связь
    ],
])
// Клавиатура с кнопками для секции О проекте
const aboutButtons = Markup.inlineKeyboard([
    [
        Markup.button.callback('Назад', 'back-to-dashboard'),
        Markup.button.url('Обратная связь', 'https://t.me/frntdev'), // Ссылка на обратную связь
    ],
])
// Клавиатура с кнопками для секции Вывод средств
const withdrawButtons = Markup.inlineKeyboard([
    [{ text: "по системе быстрых платежей", callback_data: "withdraw_to_spb" }],
    [{ text: "по номеру карты", callback_data: "withdraw_to_cart" }],
    [{ text: "telegram stars", callback_data: "withdraw_to_stars" }],
    [{ text: "кошелек TON", callback_data: "withdraw_to_ton" }],
    [
        Markup.button.callback('Назад', 'back-to-refferal'),
        Markup.button.url('Обратная связь', 'https://t.me/frntdev'), // Ссылка на обратную связь
    ],
])

// Функция запроса номера телефона
const requestPhoneNumber = async (ctx: MyContext) => {
    const callbackQuery = (ctx.update as any).callback_query
    const messageId = callbackQuery?.message?.message_id
    if (messageId) {
        await ctx.deleteMessage(messageId)
    }

    await ctx.reply(
        'Для оформления подписки, пожалуйста, поделитесь своим номером телефона.',
        Markup.keyboard([
            [Markup.button.contactRequest('📞 Отправить номер телефона')],
        ])
            .oneTime() // Клавиатура исчезнет после отправки
            .resize() // Автоматически подгоняет размер клавиатуры
    )
}

const stepHandler = new Composer<MyContext>()
stepHandler.action('back', async (ctx) => {
    // Markup.removeKeyboard()
    // ctx.reply('привет', { reply_markup: { remove_keyboard: true } })
    ctx.scene.enter('home')
})

stepHandler.action(`about`, async (ctx) => {
    await generateAboutSection(ctx)
    ctx.answerCbQuery('about')
})

async function generateAboutSection(ctx: MyContext) {
    let message = `<b>О проекте</b>\n\n`
    message += `Этот языковой бот создан, чтобы сделать изучение Бурятского простым, увлекательным и эффективным.`
    message += `\n\nЗдесь тебя ждут: \n<i>— интерактивный самоучитель, \n— расширяемый языковой корпус, \n— удобный словарь, \n — голосования за материалы, \n — интересные конкурсы.</i> \n\n`
    message += `<i>p.s. 06.03.2025 Проект на стадии разработки. Бот будет работать некорректно. Просим не блокировать бота.</i>\n@bur_live`
    await sendOrEditMessage(ctx, message, aboutButtons)
    ctx.wizard.selectStep(2)
}
async function generateWithdrawSection(ctx: MyContext) {
    let message = `<b>Вывод средств</b>\n\n`
    message += `Выберите метод вывода средств\n`
    await sendOrEditMessage(ctx, message, withdrawButtons)
    ctx.wizard.selectStep(3)
}

async function generateRefferalSection(ctx: MyContext) {
    const userId = ctx.from?.id
    if (!userId) throw Error

    const referralInfo = await fetchUserReferralInfo(userId)

    let message = `<b>💰 Реферальная программа</b>\n\n`
    message += `Приглашай и зарабатывай бонусы!\n`
    message += `Стань частью нашей реферальной программы и получай вознаграждения за каждого друга, который зарегистрируется и оформит подписку.\n\n`
    message += `<b>Твоя реферальная ссылка:</b>\n<code>${referralInfo.referralLink}</code>\n\n`
    message += `<b>Ваш уровень: 174.5 руб за каждого платного подписчика</b>\n`
    message += `<b>Баланс:</b> ${referralInfo.earnedBonus} руб.\n`
    message += `<b>Привлечено пользователей:</b> ${referralInfo.referralsCount}\n`
    message += `<b>Оформили подписки:</b> ${referralInfo.subscribedReferralsCount}\n`
    message += `<b>Конверсия:</b> ${
        referralInfo.referralsCount > 0
            ? Math.round(
                  (referralInfo.subscribedReferralsCount /
                      referralInfo.referralsCount) *
                      100
              )
            : 0
    }%`

    await sendOrEditMessage(ctx, message, referralButtons)
    ctx.wizard.selectStep(1)
}
stepHandler.action(`refferal`, async (ctx) => await generateRefferalSection(ctx))

// stepHandler.action(/^.*$/, async (ctx: MyContext) => {
//     ctx.wizard.selectStep(2)
//     ctx.answerCbQuery()
// })

stepHandler.on('message', async (ctx) => {
    await dashboardGreeting(ctx)
})

// Сцена "Подписка"
const dashboardWizard = new Scenes.WizardScene(
    'dashboard-wizard',
    stepHandler,

    // Шаг 1: Проверка состояния и вывод айди пользователя
    async (ctx: MyContext) => {
        if (ctx.updateType === 'message') {
            // logger.info(`step 1`)
            ctx.wizard.selectStep(0)
            await dashboardGreeting(ctx)
        } else if (ctx.updateType === 'callback_query') {
            const data: 'back-to-dashboard' | 'stats' | 'withdraw' =
                ctx.update.callback_query.data

            if (data === 'back-to-dashboard') {
                ctx.wizard.selectStep(0)
                await dashboardGreeting(ctx)
            }

            if (data === 'withdraw') {
                await generateWithdrawSection(ctx)
            }

            if (data === 'stats') {
                ctx.answerCbQuery()
            }
        }
    },

    async (ctx: MyContext) => {
        if (ctx.updateType === 'message') {
            await generateAboutSection(ctx)
        } else if (ctx.updateType === 'callback_query') {
            const data: 'back-to-dashboard' = ctx.update.callback_query.data

            if (data === 'back-to-dashboard') {
                ctx.wizard.selectStep(0)
                await dashboardGreeting(ctx)
            }

            ctx.answerCbQuery()
        }
    },
    
    async (ctx: MyContext) => {
        if (ctx.updateType === "message") {
            await generateWithdrawSection(ctx)
        } else if (ctx.updateType === 'callback_query') {
            const data: 'back-to-refferal' = ctx.update.callback_query.data

            if (data === 'back-to-refferal') {
                return await generateRefferalSection(ctx)
            }

            ctx.answerCbQuery()

        }
    }
)

// Приветственное сообщение с информацией о подписке
async function dashboardGreeting(ctx: MyContext, reply?: boolean) {
    try {
        const userId = ctx.from?.id
        if (!userId) throw Error

        const response = await fetchUser(userId)
        const isActive = response.user.subscription.isActive
        const createdDate = new Date(response.user.createdAt)
        // const greetingMessage = `<b>💎 Премиум доступ</b>\n\nСтаньте частью сообщества\nПремиум-доступ поддерживает развитие нашего проекта и помогает сохранить бурятский язык.\n\n<b>Что включает Премиум?</b>\n\n<strong><i>+ Эксклюзивные материалы</i></strong>\n<strong><i>+ Ускоренный прогресс</i></strong>\n<strong><i>+ Без рекламы</i></strong>\n<strong><i>+ Продвинутый рейтинг и награды</i></strong>\n<strong><i>+ Доступ к словарю</i></strong>\n<strong><i>+ Расширенные тренировки</i></strong>`
        let greetingMessage = `<b>Личный кабинет</b>\n\n`
        greetingMessage += `<b>ID:</b> <code>${response.user.id}</code>\n`
        greetingMessage += `<b>Рейтинг:</b> <code>${response.user.rating}</code>\n`
        greetingMessage += `<b>Дата регистрации:</b> <code><b>${createdDate.toLocaleDateString('ru-Ru')}</b></code>\n`
        // throw error
        await sendOrEditMessage(ctx, greetingMessage, dashboardButtons, reply)
    } catch (error) {
        const message = `Произошла ошибка, попробуйте позже, или свяжитесь @frntdev`
        await sendOrEditMessage(
            ctx,
            message,
            Markup.inlineKeyboard([[Markup.button.callback('Назад', 'back')]]),
            reply
        )
        // ctx.scene.enter("home")
    }
}

dashboardWizard.on('contact', async (ctx: any) => {
    if (ctx.update) {
        if (ctx.update.message.contact) {
            const contact: {
                phone_number: string
                first_name: string
                user_id: number
            } = ctx.update.message.contact

            const request = await savePhoneNumber(
                contact.user_id,
                contact.phone_number
            )
            ctx.reply(request.message, {
                reply_markup: { remove_keyboard: true },
            })
            await dashboardGreeting(ctx, true)
        }
    }
})

// Вход в сцену "Подписка"
dashboardWizard.enter(async (ctx: MyContext) => {
    await dashboardGreeting(ctx)
})

export default dashboardWizard
