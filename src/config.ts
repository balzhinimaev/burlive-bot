import dotenv from 'dotenv'
import Joi from 'joi'

dotenv.config()

// Define validation schema for environment variables
const envSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number().default(1442),
    BOT_TOKEN: Joi.string().required(),
    SECRET_PATH: Joi.string().required(),
    WEBAPP_URL: Joi.string().uri().required(),
    API_URL: Joi.string().uri().required(),
    SITE_URL: Joi.string().uri().required(),
    BOT_USERNAME: Joi.string().required(),
    API_TOKEN: Joi.string().required(),
    LEADERBOARD_LINK: Joi.string().required(),
    INFORMATOR_CHAT: Joi.string().required(),
    VOCABULARY_LOGGER_CHAT: Joi.string().required(),
    // Add other required environment variables
}).unknown()

// Validate environment variables against schema
const { error, value: envVars } = envSchema.validate(process.env)
if (error) {
    throw new Error(`Config validation error: ${error.message}`)
}

// Export configuration as a centralized object
export default {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    bot: {
        token: envVars.BOT_TOKEN,
        username: envVars.BOT_USERNAME,
        secretPath: `/${envVars.SECRET_PATH || ''}`,
        webappUrl: envVars.WEBAPP_URL,
    },
    api: {
        url: envVars.API_URL,
        token: envVars.API_TOKEN,
    },
    site: {
        url: envVars.SITE_URL,
    },
    chats: {
        informator: envVars.INFORMATOR_CHAT,
        vocabulary_logger: envVars.VOCABULARY_LOGGER_CHAT,
    },
    leaderboard: {
        url: envVars.LEADERBOARD_LINK,
    },
    logging: {
        level: envVars.NODE_ENV === 'development' ? 'debug' : 'info',
    },
}
