import { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger'

export class AppError extends Error {
    statusCode: number
    isOperational: boolean

    constructor(message: string, statusCode: number) {
        super(message)
        this.statusCode = statusCode
        this.isOperational = true
        Error.captureStackTrace(this, this.constructor)
    }
}

export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Default error status and message
    const statusCode = (err as AppError).statusCode || 500
    const message = err.message || 'Internal Server Error'

    // Log error details
    if (statusCode >= 500) {
        logger.error(
            `${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
        )
        logger.error(err.stack)
    } else {
        logger.warn(
            `${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
        )
    }

    // Send response based on environment
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        res.status(statusCode).json({
            status: 'error',
            message: 'Something went wrong',
        })
    } else {
        res.status(statusCode).json({
            status: statusCode >= 500 ? 'error' : 'fail',
            message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        })
    }
}
