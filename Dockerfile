FROM node:lts

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

RUN npm install -g npm@11.0.0

# Устанавливаем зависимости
RUN npm install

# Копируем остальной исходный код
COPY . .

# Собираем приложение
RUN npx tsc

# Экспонируем порт
EXPOSE 1442

# Запускаем приложение
CMD ["npm", "run", "start"]
