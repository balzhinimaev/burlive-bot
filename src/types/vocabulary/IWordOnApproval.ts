export interface IWordOnApproval {
    _id: string
    text: string
    normalized_text: string // Новый атрибут для нормализованного текста
    language: string
    author: any
    contributors: string[]
    status: string
    pre_translations: any[]
    createdAt: Date
    updatedAt: Date
    dialect?: string
    themes?: []
    // Additional fields, if needed
}

interface IWordModelTranslation {
    _id: string
    text: string
    normalized_text: string
}
