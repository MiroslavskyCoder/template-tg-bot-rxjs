
const TELEGRAM_BOT_TOKEN = '';

import { BotService } from './bot.service';
import { Router } from './router'; // Импортируем Router  

function bootstrap() {
    console.log('Starting RxJS Telegram Bot with Router...');
    
    // 1. Инициализируем сервис бота
    const botService = new BotService(TELEGRAM_BOT_TOKEN);
    
    // 2. Инициализируем роутер, передавая ему сервис бота
    const router = new Router(botService);
    
    // 3. Запускаем роутер (он сам подпишется на события бота)
    router.startRouting();
    
    // 4. Запускаем опрос сервера Telegram
    botService.startPolling();
}

bootstrap();