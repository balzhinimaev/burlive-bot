import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

// Rate limiter for API endpoints
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Too many requests, please try again later',
        })
    },
})

// More strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        res.status(429).json({
            error: 'Too many attempts, please try again later',
        })
    },
})
