// src/router.ts

import { Observable, Subject, merge, from, delay, timer } from 'rxjs';
import ms from 'ms'; 
import { filter, map, tap, catchError, switchMap } from 'rxjs/operators';
import { BotService, BotContext, ParsedCommand } from './bot.service';
import { BufferProcessor } from './buffer-processor'; // Если нужен
import Debug from 'debug';

const debug = Debug('bot:router');

// --- Концепция: Обработчик команды ---
// Это функция, которая принимает BotContext и возвращает Observable<void> (или Observable<string> для ответа)

// Или просто выполняет сайд-эффекты (отправку сообщений)
export type CommandHandler<R = void> = (context: BotContext) => Observable<R>;

// --- Концепция: Обработчик потока ---
// Это функция, которая принимает Observable<BotContext> и выполняет какую-то логику
// Например, реагирует на определенные типы сообщений
export type StreamHandler = (input$: Observable<BotContext>) => Observable<void>;
 
// --- Концепция: Duplex Stream ---
// Это может быть Observable, который одновременно читает и пишет.
// В контексте бота, это может быть поток, который читает входящие сообщения
// и выдает исходящие сообщения для отправки.

export class Router {
    private bufferProcessor: BufferProcessor; // Пример зависимости
    private commandHandlers: Map<string, CommandHandler> = new Map();
    private streamHandlers: StreamHandler[] = [];

    constructor(private botService: BotService) {
        this.bufferProcessor = new BufferProcessor(); // Инициализация, если нужна
        this.registerDefaultHandlers(); // Регистрация базовых обработчиков
    }

    // --- Регистрация обработчиков ---

    // Регистрируем обработчик для конкретной команды
    public registerCommand(commandName: string, handler: CommandHandler): void {
        this.commandHandlers.set(commandName, handler);
    }

    // Регистрируем обработчик для потока сообщений (например, для всех текстовых сообщений)
    public registerStreamHandler(handler: StreamHandler): void {
        this.streamHandlers.push(handler);
    }

  // --- Парсинг команды ---
    private parseCommand(message: BotContext): ParsedCommand | null {
        if (message.messageText && message.messageText.startsWith('/')) {
            const parts = message.messageText.trim().split(/\s+/);
            const command = parts[0].substring(1); // Убираем '/'
            const args = parts.slice(1);
            const rawArgs = message.messageText.substring(command.length + 1).trim();
            
            // Фильтруем, чтобы не обрабатывать как команду, если это не команда, а просто текст
            if (this.commandHandlers.has(command) || message.command === command) { // Проверяем наличие обработчика или если команда была помечена в BotService
                return { command, args, rawArgs };
            }
        }
        return null;
    }

  // --- Функция вызова обработчика (FunctionCall) ---
    private executeCommandHandler(context: BotContext, command: string, handler: CommandHandler): Observable<void> {
        console.log(`[Router] Executing handler for command: ${command}`);
        // Здесь можно добавить логику для передачи более полного контекста,
        // если CommandHandler ожидает что-то большее, чем BotContext
        return handler(context).pipe(
            catchError(error => {
                console.error(`[Router] Error executing command handler for ${command}:`, error);
                this.botService.sendMessage(context.chatId, `Произошла ошибка при выполнении команды /${command}: ${error.message}`);
                return from([]); // Возвращаем пустой Observable, чтобы завершить цепочку
            })
        );
    }

  // --- Центральная точка запуска маршрутизации ---
    public startRouting(): void {
        console.log('[Router] Starting routing...');
        debug('Starting routing...');

        // Объединяем все входящие сообщения и потенциальные команды, которые могли быть помечены в BotService
        const allEvents$ = merge(
            this.botService.allMessages$,
            // Если BotService помечает команды отдельно, их тоже можно включить
            // Этот пример предполагает, что BotService уже пушит BotContext для команд в incomingMessageSubject
        );

        // --- Обработка всех сообщений (Stream Handlers) ---
        // Для каждого зарегистрированного обработчика потока, подписываем его на все сообщения
        this.streamHandlers.forEach(handler => {
            handler(allEvents$).subscribe(); // Подписываемся, чтобы обработчик начал работу
        });

        // --- Обработка команд (Command Handlers) ---
        allEvents$.pipe(
            // Фильтруем только те сообщения, которые могут быть командами
            filter((context, index) => typeof context.messageText === 'string' && context.messageText.startsWith('/') || typeof context.command === 'string'), // Или если команда была явно помечена
            map(context => {
                // Парсим команду, если это возможно
                const parsed = this.parseCommand(context);
                if (parsed) {
                    return { ...context, parsedCommand: parsed }; // Добавляем разобранную команду к контексту
                } else if (context.command) { // Если команда была помечена напрямую (например, /start)
                    return { ...context, parsedCommand: { command: context.command, args: [], rawArgs: '' } };
                }
                return null; // Не команда, пропускаем
            }),
            filter(contextWithParsedCommand => contextWithParsedCommand !== null), // Пропускаем null
            switchMap(contextWithParsedCommand => {
                const { parsedCommand, ...restOfContext } = contextWithParsedCommand!;
                const handler = this.commandHandlers.get(parsedCommand.command);

                if (handler) {
                    // Если нашли обработчик, вызываем его
                    return this.executeCommandHandler(contextWithParsedCommand!, parsedCommand.command, handler).pipe(
                        map(() => contextWithParsedCommand) // Возвращаем контекст, чтобы можно было продолжить цепочку, если нужно
                    );
                } else {
                    // Если обработчика нет, отправляем сообщение об ошибке
                    this.botService.sendMessage(contextWithParsedCommand!.chatId, `Команда /${parsedCommand.command} не найдена.`);
                    return from([null]); // Возвращаем null, чтобы фильтровать дальше
                }
            }),
            filter(result => result !== null), // Фильтруем результаты, которые были обработаны (т.е. не null)
            // На данном этапе мы уже выполнили команды, если они были.
            // Можно добавить дальнейшую обработку, если нужно.
            // Например, если команда вернула Observable<string>, можно отправить его.
            // tap(result => { if (typeof result === 'string') this.botService.sendMessage(result.chatId, result.text)})
        ).subscribe();
    }

    // --- Примеры регистрации обработчиков ---
    private registerDefaultHandlers(): void {
        console.log('[Router] Registering default handlers...');

        // 1. Обработчик для команды /start
        // ИСПРАВЛЕНО: Удален async и используется from() для преобразования Promise в Observable
        this.registerCommand('start', (ctx) => {
            // this.botService.sendMessage возвращает Promise<any>
            return from(
                from(this.botService.sendMessage(ctx.chatId, `Добро пожаловать, ${ctx?.from?.first_name}!`).pipe(
                    map(() => undefined as void)
                ))
            ).pipe(
                map(() => undefined as void) // Убеждаемся, что возвращаем Observable<void>
            );
        });  

        // 2. Обработчик для команды /echo
        // ИСПРАВЛЕНО: Используется from() для преобразования Promise в Observable
        this.registerCommand('echo', (ctx) => {
            let messageToSend: string;
            if (ctx.parsedCommand && ctx.parsedCommand.rawArgs) {
                messageToSend = `Вы сказали: ${ctx.parsedCommand.rawArgs}`;
            } else {
                messageToSend = "Пожалуйста, укажите текст для эха.";
            }
            
            // from(Promise) делает CommandHandler корректным
            return from(this.botService.sendMessage(ctx.chatId, messageToSend)).pipe(
                map(() => undefined as void) // Убеждаемся, что возвращаем Observable<void>
            );
        });
        
        // 3. Обработчик команды /buffer_test (интеграция с BufferProcessor)
        this.registerCommand('buffer_test', (ctx) => {
            const bufferSize = ctx.parsedCommand?.args[0] ? parseInt(ctx.parsedCommand.args[0], 10) : 10;
            if (isNaN(bufferSize) || bufferSize <= 0) {
                this.botService.sendMessage(ctx.chatId, "Размер буфера должен быть положительным числом.");
                return from([]); // Пустой Observable
            }
            
            console.log(`Testing buffer allocation and filling for size: ${bufferSize}`);
            return this.bufferProcessor.allocateBuffer(bufferSize).pipe(
                switchMap(buffer => this.bufferProcessor.fillBuffer(buffer, 0xAA).pipe(
                    tap(filledBuffer => {
                        const bufferInfo = `Buffer allocated (unsafe), filled with 0xAA. First 10 bytes: ${filledBuffer.slice(0, 10).toString('hex')}`;
                        this.botService.sendMessage(ctx.chatId, bufferInfo);
                    }),
                    map(() => undefined as void)
                )),
                catchError(error => {
                    console.error("Error processing buffer test:", error);
                    this.botService.sendMessage(ctx.chatId, `Ошибка при тестировании буфера: ${error.message}`);
                    return from([]);
                })
            );
        });

        this.registerCommand('delay', (ctx) => { 
            const delayMs = ctx.parsedCommand?.args[0] ? parseInt(ctx.parsedCommand.args[0], 10) : 1000;
            if (isNaN(delayMs) || delayMs <= 0) {
                this.botService.sendMessage(ctx.chatId, "Задержка должна быть положительным числом (мс).");
                return from([]); // Пустой Observable 
            }
            debug(`Delaying for ${ms(delayMs)}...`);
            console.log(`Delaying for ${ms(delayMs)}...`);
            return timer(delayMs).pipe(
                map(() => undefined as void)
            );
        });


        // 4. Пример Stream Handler: реация на любое текстовое сообщение
        this.registerStreamHandler((input$: Observable<BotContext>) => {
            return input$.pipe(
                // Фильтруем только текстовые сообщения, которые не являются командами
                filter(context => context.messageText !== undefined && !context.messageText.startsWith('/')),
                tap(context => {
                    console.log(`[StreamHandler] Received plain text: ${context.messageText}`);
                    // Здесь можно добавить сложную логику, например, NLP-обработку
                    // или реакцию на определенные ключевые слова.
                    // Пример: if (context.messageText?.includes("погода")) { ... }
                }),
                // Можно вернуть Observable<void> или Observable<OutgoingMessage>
                map(() => undefined as void) // Пример: просто логируем, ничего не возвращая
            );
        });
    }
}