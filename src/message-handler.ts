// src/message-handler.ts

import { from, Observable } from 'rxjs';
import { filter, map, switchMap, tap, catchError } from 'rxjs/operators';
import { BotService } from './bot.service';
import { BufferProcessor } from './buffer-processor'; 
import { PassThrough, Duplex } from "stream";
import * as _ from 'lodash'; // Импортируем Lodash

// Статический список существующих ID пользователей для примера
const VALID_USER_IDS = [5489287822, 824733457]; 

export class MessageHandler {
    private bufferProcessor: BufferProcessor;

    constructor(private botService: BotService) {
        this.bufferProcessor = new BufferProcessor();
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        // ... (Существующие подписки /start и /echo остаются без изменений) ...

        this.botService.messages$.subscribe(message => {
            console.log(`[Received]: Chat ${message.chatId}, Text: "${message.messageText}"`);
        });
        
        // ... (Обработчик /start) ...
        this.botService.messages$.pipe(
            filter(msg => msg.messageText === '/start')
        ).subscribe(msg => {
            console.log(`Handling /start for user ${msg.userId}`);
            this.botService.sendMessage(
                msg.chatId, 
                `Привет! Вы запустили бота. Ваш ID: ${msg.userId}`
            );
        });

        // --- ОБРАБОТЧИК С ИСПОЛЬЗОВАНИЕМ LODASH ---
        this.botService.messages$.pipe(
            filter((msg, index) => msg.messageText?.startsWith('/check_users') ?? false)
        ).subscribe(msg => {
            // Пример: парсим строку ID через пробел, пропуская команду
            const inputIdsString = msg.messageText?.substring('/check_users'.length).trim();
            
            // Используем _.split и _.map для безопасного парсинга
            const inputIds = _.chain(inputIdsString)
                .split(',') // Разделяем по запятой
                .map(idStr => _.trim(idStr)) // Удаляем пробелы вокруг каждого ID
                .map(idStr => parseInt(idStr, 10)) // Преобразуем в число
                .filter(id => !_.isNaN(id)) // Удаляем NaN, если парсинг провалился
                .value(); // Получаем финальный массив
                
            if (inputIds.length === 0) {
                this.botService.sendMessage(msg.chatId, "Пожалуйста, укажите ID через запятую. Пример: /check_users 123456, 789012");
                return;
            }

            // Используем _.intersection для нахождения общих элементов (валидных ID)
            const foundValidIds = _.intersection(inputIds, VALID_USER_IDS);

            let responseText;

            if (foundValidIds.length > 0) {
                responseText = `Найдено ${foundValidIds.length} валидных ID: ${foundValidIds.join(', ')}.`;
            } else {
                responseText = "Среди предоставленных ID не найдено известных пользователей.";
            }

            this.botService.sendMessage(msg.chatId, responseText);
        });

        // ... (Обработчик /buffer_test остается без изменений) ...
        // (Включая его здесь для полноты, если вы его оставили)
        this.botService.messages$.pipe(
            filter(msg => msg.messageText?.startsWith('/buffer_test') ?? false),
            map(msg => {
                const parts = msg.messageText?.split(' ') ?? [];
                let bufferSize = 10; 
                if (parts.length > 1) {
                    const parsedSize = parseInt(parts[1], 10);
                    if (!isNaN(parsedSize) && parsedSize > 0) {
                        bufferSize = parsedSize;
                    }
                }
                return { ...msg, bufferSize };
            }),
            switchMap(msg => {
                console.log(`Testing buffer allocation and filling for size: ${msg.bufferSize}`);
                return this.bufferProcessor.allocateBuffer(msg.bufferSize).pipe(
                    switchMap(buffer => 
                        this.bufferProcessor.fillBuffer(buffer, 0xAA)
                    ),
                    tap(filledBuffer => {
                        const bufferInfo = `Buffer allocated (unsafe), filled with 0xAA. First 10 bytes: ${filledBuffer.slice(0, 10).toString('hex')}`;
                        this.botService.sendMessage(msg.chatId, bufferInfo);
                    }),
                    catchError(error => {
                        console.error("Error processing buffer test:", error);
                        this.botService.sendMessage(msg.chatId, `Ошибка при тестировании буфера: ${error.message}`);
                        return from([]); 
                    })
                );
            })
        ).subscribe();
    }
}