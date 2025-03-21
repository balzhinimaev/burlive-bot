import winston from 'winston'
import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import DailyRotateFile from 'winston-daily-rotate-file'

// Путь к папке logs рядом с папкой src
const logsDir = resolve(__dirname, '..', 'logs')

// Проверка наличия папки logs, иначе создание
if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true })
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
    return String(now.getMonth() + 1).padStart(2, '0')
}

const getDateForDirNameYear = () => {
    return String(new Date().getFullYear())
}

// Форматы логирования
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // Вывод временной метки в локальном времени (например, для Ulaanbaatar)
    winston.format.printf(({ level, message, timestamp }) => {
        const localTime = new Date(timestamp as string).toLocaleString('ru-RU', {
            timeZone: 'Asia/Ulaanbaatar',
        })
        return `${localTime} [${level}]: ${message}`
    })
)

const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
)

// Создание логгера Winston с DailyRotateFile
const logger = winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.Console({
            format: consoleFormat,
            level: 'info',
        }),
        new winston.transports.File({
            filename: `${logsDir}/combined.log`,
            level: 'info',
            format: fileFormat,
        }),
        new DailyRotateFile({
            filename: `${logsDir}/${getDateForDirNameYear()}/${getDateForDirNameMonth()}/log-${getDateForFileNameFull()}.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            format: fileFormat,
        }),
    ],
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
})

// Функция для добавления контекста запроса к логам
export const addRequestContext = (req: any) => ({
    userId: req.userId || 'anonymous',
    requestId: req.requestId,
    ip: req.ip,
    path: req.originalUrl,
    method: req.method,
})

export default logger
