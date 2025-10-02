// src/buffer-processor.ts

import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export class BufferProcessor {

    /**
     * Создает буфер заданной длины.
     * @param size Длина буфера.
     * @returns Observable, который эмитирует созданный буфер.
     */
    public allocateBuffer(size: number): Observable<Buffer> {
        return from(new Promise<Buffer>((resolve, reject) => {
        if (size < 0) {
            return reject(new Error("Buffer size cannot be negative"));
        }
        try {
            // Используем buffer.allocUnsafe для создания буфера.
            // Он может быть быстрее, но содержит "мусор" от предыдущих операций.
            // Убедитесь, что вы его правильно заполняете или очищаете.
            const buffer = Buffer.allocUnsafe(size);
            console.log(`Buffer allocated (unsafe): ${buffer.length} bytes.`);
            resolve(buffer);
        } catch (error) {
            reject(error);
        }
        }));
    }

    /**
     * Заполняет буфер заданным значением.
     * @param buffer Буфер для заполнения.
     * @param fillValue Значение для заполнения (0-255).
     * @param offset Начальный индекс для заполнения.
     * @param length Количество байт для заполнения.
     * @returns Observable, который эмитирует заполненный буфер.
     */
    public fillBuffer(
        buffer: Buffer, 
        fillValue: number, 
        offset: number = 0, 
        length: number = buffer.length - offset
    ): Observable<Buffer> {
        return from(new Promise<Buffer>((resolve, reject) => {
        try {
            // Используем buffer.fill для заполнения буфера.
            // fillValue должен быть числом от 0 до 255.
            if (fillValue < 0 || fillValue > 255) {
                return reject(new Error("fillValue must be between 0 and 255"));
            }
            if (offset < 0 || offset >= buffer.length) {
                return reject(new Error("offset is out of bounds"));
            }
            if (length < 0 || offset + length > buffer.length) {
                return reject(new Error("length is out of bounds"));
            }

            buffer.fill(fillValue, offset, offset + length);
            console.log(`Buffer filled with ${fillValue} from index ${offset} for ${length} bytes.`);
            resolve(buffer);
        } catch (error) {
            reject(error);
        }
        }));
    }
}