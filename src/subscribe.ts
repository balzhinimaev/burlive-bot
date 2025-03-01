import { Scenes, Composer, Markup } from 'telegraf'
import { MyContext } from './types/MyContext'
import sendOrEditMessage from './utils/sendOrEditMessage'
import { fetchUser } from './utils/fetchUser'
import { error } from 'console'
import { createSubscribeUrl } from './utils/createSubscribeUrl'
import { savePhoneNumber } from './utils/savePhoneNumber'

// Клавиатура с кнопками подписки
const subscribeButtons = Markup.inlineKeyboard([
    [Markup.button.callback('1 месяц / 399 руб', 'subscribe_1_month')],
    [Markup.button.callback('3 месяца / 999 руб', 'subcribe_3_month')],
    [Markup.button.callback('12 месяцев / 3599 руб', 'subscribe_1_year')],
    [Markup.button.callback('Назад', 'back')],
])

// Тип состояния для Wizard-сцены
interface WizardState {
    language?: string
    suggestion?: boolean
    selectedWordId?: string
    selectedDialect?: string
    normalized_text?: string
}

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

// Обработчик шага 2
const stepHandler = new Composer<MyContext>()
stepHandler.action('back', async (ctx) => {
    // Markup.removeKeyboard()
    // ctx.reply('привет', { reply_markup: { remove_keyboard: true } })
    ctx.scene.enter('home')
})
// Унифицированная функция для создания подписки
const createSubscriptionMessage = async (
    ctx: MyContext,
    userId: string,
    subscriptionType: 'monthly' | 'quarterly' | 'annual'
) => {
    try {
        const request = await createSubscribeUrl(userId, subscriptionType)
        let rusType: string = ``

        if (subscriptionType === 'monthly') {
            rusType = '1 месяц'
        } else if (subscriptionType === 'quarterly') {
            rusType = '3 месяца'
        } else if (subscriptionType === 'annual') {
            rusType = '1 год'
        }

        // Формирование сообщения
        const message = `💎 <b>Премиум доступ</b>\n\nОформление подписки на ${rusType}\nСтоимость: ${request.amount} ₽\n\nДля оплаты нажмите кнопку "Оплатить"`

        // Отправка сообщения
        await sendOrEditMessage(
            ctx,
            message,
            Markup.inlineKeyboard([
                [Markup.button.url('Оплатить', request.confirmation_url)],
                [Markup.button.callback('Назад', 'back')]
            ])
        )

        // Ответ на callback
        await ctx.answerCbQuery()
    } catch (error) {
        console.error('Ошибка при создании подписки:', error)
    }
}


// Унифицированный обработчик для всех вариантов подписки
const handleSubscribeAction = async (ctx: MyContext) => {
    try {
        const userId = ctx.from?.id
        if (!userId) return

        const userStatus = await fetchUser(userId)
        console.log(userStatus)
        
        if (userStatus.is_exists && !userStatus.user.phone) {
            await requestPhoneNumber(ctx)
        } else {
            // Унифицированный процесс обработки подписки
            const subscriptionMap: Record<string, 'monthly' | 'quarterly' | 'annual'> = {
                'subscribe_1_month': 'monthly',
                'subcribe_3_month': 'quarterly',
                'subscribe_1_year': 'annual',
            }

            const data: string = ctx.update.callback_query.data
            const subscriptionType = subscriptionMap[data]

            if (subscriptionType) {
                await createSubscriptionMessage(ctx, userStatus.user._id, subscriptionType)
                return
            }

            await ctx.answerCbQuery()
        }
    } catch (error) {
        const message = `Произошла ошибка, попробуйте позже, или свяжитесь @frntdev`
        await sendOrEditMessage(
            ctx,
            message,
            Markup.inlineKeyboard([[Markup.button.callback('Назад', 'back')]])
        )
    }
}
// Привязка обработчика к нескольким callback данным
stepHandler.action(
    ['subscribe_1_month', 'subcribe_3_month', 'subscribe_1_year'],
    handleSubscribeAction
)
stepHandler.action(/^.*$/, async (ctx: MyContext) => {
    ctx.wizard.selectStep(2)
    ctx.answerCbQuery()
})
stepHandler.on('message', async (ctx) => {
    await subscribeGreeting(ctx)
})
// Сцена "Подписка"
const subscribeWizard = new Scenes.WizardScene(
    'subscribe-wizard',
    stepHandler,

    // Шаг 1: Проверка состояния и вывод айди пользователя
    async (ctx: MyContext) => {
        if (ctx.updateType === 'message') {
            await subscribeGreeting(ctx)
        }
    },

    // Шаг 2: Обработка запроса номера телефона
    async (ctx) => {
        await requestPhoneNumber(ctx)
        if (ctx.updateType === 'callback_query') {
        }
    }
)

// Приветственное сообщение с информацией о подписке
async function subscribeGreeting(ctx: MyContext, reply?: boolean) {
    try {
        const userId = ctx.from?.id
        if (!userId) return

        const response = await fetchUser(userId)
        const isActive = response.user.subscription.isActive

        // const subscribeMessage = `<b>💎 Премиум доступ</b>\n\nСтаньте частью сообщества\nПремиум-доступ поддерживает развитие нашего проекта и помогает сохранить бурятский язык.\n\n<b>Что включает Премиум?</b>\n\n<strong><i>+ Эксклюзивные материалы</i></strong>\n<strong><i>+ Ускоренный прогресс</i></strong>\n<strong><i>+ Без рекламы</i></strong>\n<strong><i>+ Продвинутый рейтинг и награды</i></strong>\n<strong><i>+ Доступ к словарю</i></strong>\n<strong><i>+ Расширенные тренировки</i></strong>`
        let subscribeMessage = `<b>💎 Премиум доступ</b>\n\n`
        if (!isActive) {
            subscribeMessage += `Премиум-доступ поддерживает развитие нашего проекта и помогает сохранить бурятский язык.`
            subscribeMessage += `\n\n<b>Что включает Премиум?</b>\n\n<strong><i>+ Эксклюзивные материалы</i></strong>\n<strong><i>+ Ускоренный прогресс</i></strong>\n<strong><i>+ Без рекламы</i></strong>\n<strong><i>+ Продвинутый рейтинг и награды</i></strong>\n<strong><i>+ Доступ к словарю</i></strong>\n<strong><i>+ Расширенные тренировки</i></strong>`
        } else {
            if (
                response.user.subscription.startDate !== null &&
                response.user.subscription.endDate !== null
            ) {
                const startDate = new Date(response.user.subscription.startDate)
                const endDate = new Date(response.user.subscription.endDate)
                subscribeMessage += `Подписка действует с <b><i>${startDate.toLocaleDateString('ru-Ru')}</i></b>`
                subscribeMessage += `\nПодписка истекает <b><i>${endDate.toLocaleDateString('ru-Ru')}</i></b>`
                subscribeMessage += `\n\n<b>Что включает Премиум?</b>\n\n<strong><i>+ Эксклюзивные материалы</i></strong>\n<strong><i>+ Ускоренный прогресс</i></strong>\n<strong><i>+ Без рекламы</i></strong>\n<strong><i>+ Продвинутый рейтинг и награды</i></strong>\n<strong><i>+ Доступ к словарю</i></strong>\n<strong><i>+ Расширенные тренировки</i></strong>`
            } else {
                ctx.telegram.sendMessage(
                    1272270574,
                    `Статус подписки активен у пользователя ${ctx.from.id}, но нет окончания или начала`
                )
                throw error
            }
        }
        // throw error
        await sendOrEditMessage(ctx, subscribeMessage, subscribeButtons, reply)
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

subscribeWizard.on("contact", async (ctx: any) => {
    if (ctx.update) {
        if (ctx.update.message.contact) {
            const contact: {
                phone_number: string;
                first_name: string;
                user_id: number
            } = ctx.update.message.contact

            const request = await savePhoneNumber(contact.user_id, contact.phone_number)
            ctx.reply(request.message, {
                reply_markup: { remove_keyboard: true },
            })
            await subscribeGreeting(ctx, true)
        }
    }
})

// Вход в сцену "Подписка"
subscribeWizard.enter(async (ctx: MyContext) => {
    await subscribeGreeting(ctx)
})

export default subscribeWizard
