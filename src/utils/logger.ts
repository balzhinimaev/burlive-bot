import winston from 'winston'
import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import DailyRotateFile from 'winston-daily-rotate-file'

// Путь к папке logs рядом с папкой src
const logsDir = resolve(__dirname, '..', 'logs')

// Проверка наличия папки logs, иначе создание
if (!existsSync(logsDir)) {
    mkdirSync(logsDir)
}

// Получение текущей даты в формате для имени файла
const getDateForFileNameFull = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const getDateForDirNameMonth = () => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${month}`
}

const getDateForDirNameYear = () => {
    const now = new Date()
    const year = now.getFullYear()
    return `${year}`
}

// Формат для консоли с человеко-понятным временем по улан-удэнскому времени
const humanReadableConsoleFormat = winston.format.printf(
    ({ level, message, timestamp }) => {
        const localTime = new Date(timestamp as string).toLocaleString('ru-RU', {
            timeZone: 'Asia/Ulaanbaatar',
        })
        return `${localTime} [${level}]: ${message}`
    }
)

// Создание логгера Winston с настройкой файлов для каждого дня в отдельных папках для каждого месяца
const logger = winston.createLogger({
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                humanReadableConsoleFormat
            ),
            level: 'info',
        }),
        new winston.transports.File({
            filename: `${logsDir}/combined.log`,
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
        }),
        new DailyRotateFile({
            filename: `${logsDir}/${getDateForDirNameYear()}/${getDateForDirNameMonth()}/log-${getDateForFileNameFull()}.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
        }),
    ],
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
})

export default logger
