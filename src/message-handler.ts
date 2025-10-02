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

        this.botService.messages$.subscribe(message => {
            console.log(`[Received]: Chat ${message.chatId}, Text: "${message.messageText}"`);
        }); 

        // Обрабатываем команды
        this.botService.messages$.pipe(
            filter(msg => msg.command !== undefined),
            tap(msg => console.log(`[Command]: ${msg.command} from User ${msg.userId}`)),
            filter(msg => VALID_USER_IDS.includes(msg.userId))
        ).subscribe({
            next: () => {},
            error: err => console.error(`[Error]: ${err.message}`)
        });
    }
}