// src/bot.service.ts

import { Telegraf, Context, NarrowedContext } from 'telegraf';
import { Update } from 'telegraf/typings/core/types/typegram';
import { Subject, Observable, fromEvent, defer, from } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import type { Message } from '@telegraf/types'; 
import Debug from 'debug'; // Импортируем debug

const debug = Debug('bot:service'); // Создаем экземпляр debug

// Объект для разбора команд
export interface ParsedCommand {
    command: string;
    args: string[];
    rawArgs: string;
}
// Расширяем BotMessage для большего контекста
export interface BotContext { // Наследуем от Update для полного контекста Telegram
    chatId: number;
    userId: number;
    messageText?: string; // Опционально, если это текстовое сообщение
    // Можно добавить другие свойства, например, данные пользователя из БД
    telegramBot: Telegraf; // Даем доступ к самому боту, если нужно
    command?: string; // Опционально, если это команда
    parsedCommand?: ParsedCommand;
    from: Message['from'];
}

// Общий Subject для всех входящих сообщений (с расширенным контекстом)
const incomingMessageSubject = new Subject<BotContext>();

export class BotService {
    private bot: Telegraf;
    
    // Observable для всех входящих сообщений
    public readonly allMessages$: Observable<BotContext> = incomingMessageSubject.asObservable();
    
    // Observable для текстовых сообщений
    public readonly messages$: Observable<BotContext> = incomingMessageSubject.pipe(
        filter((ctx) => ctx.messageText !== undefined)
    )

    constructor(token: string) {
        this.bot = new Telegraf(token);
        this.setupListeners();
    }

    private setupListeners(): void {
        // Обрабатываем все типы обновлений, которые могут быть интересны
        // В данном примере фокусируемся на текстовых сообщениях
        this.bot.on(
            ['text', 'document', 'photo', 'sticker', 'audio', 'video'], // Пример разных типов
            (ctx: NarrowedContext<Context, Update>) => {
                // Создаем наш унифицированный BotContext
                const botContext: BotContext = {
                    ...ctx.update, // Включаем все свойства объекта update
                    chatId: ctx.chat?.id ?? 0,
                    userId: ctx.from?.id ?? 0,
                    telegramBot: this.bot,
                    from: ctx.from
                };

                // Если это текстовое сообщение, добавляем текст
                if (ctx.message && 'text' in ctx.message) {
                    botContext.messageText = ctx.message.text;
                }
                
                console.log(`[BotService] Received update: Type: ${ctx.updateType}, ChatID: ${botContext.chatId}, UserID: ${botContext.userId}`);
                incomingMessageSubject.next(botContext);
            }
        );

        // Добавляем обработку команды /start отдельно, чтобы не зависеть от типа сообщения
        this.bot.command('start', (ctx) => {
            const botContext: BotContext = {
                ...ctx.update,
                chatId: ctx.chat.id,
                userId: ctx.from.id,
                telegramBot: this.bot,
                // Можно добавить команду как свойство, если нужно
                command: 'start', 
                from: ctx.from
            };
            debug(`Received command: start`);
            console.log(`[BotService] Received command: start`);
            incomingMessageSubject.next(botContext);
        });
        // Можно добавить другие команды аналогично
        this.bot.command('echo', (ctx) => {
            const botContext: BotContext = {
                ...ctx.update,
                chatId: ctx.chat.id,
                userId: ctx.from.id,
                telegramBot: this.bot,
                command: 'echo', 
                from: ctx.from
            };
            console.log(`[BotService] Received command: echo`);
            incomingMessageSubject.next(botContext);
        });
    }

    public startPolling(): void {
        console.log('Bot polling started...');
        this.bot.launch();
        debug('Bot polling started (debug enabled)');
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }

    public sendMessage(chatId: number, text: string): Observable<void> {
        this.bot.telegram.sendMessage(chatId, text);
        return from([]);
    }
}