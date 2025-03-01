import { User } from 'telegraf/typings/core/types/typegram'
export interface ILevel extends Document {
    name: string
    icon: string
    minRating: number
    maxRating?: number // undefined для последнего уровня
    createdAt: Date
    updatedAt: Date
    _id: string
}
export interface TelegramUser extends User {
    _id: string
    rating: number
    level: string | ILevel
    referrals_telegram?: string[]
    id: number
    email: string
    c_username: string
    theme: 'light' | 'dark'
    platform: string
    via_app: boolean
    photo_url: string
    phone?: string | number
    role: 'admin' | 'user' | 'moderator' | undefined
    vocabular: {
        selected_language_for_translate: 'russian' | 'buryat'
    }
    subscription: {
        type: 'monthly' | 'quarterly' | 'annual' | null
        startDate: Date | null
        endDate: Date | null
        isActive: boolean
        paymentId: string
    }
    createdAt: Date
    updatedAt: Date
}
