import { Database as IDatabase } from "./interfaces/database";
import * as path from "path";
import BSqlite from "better-sqlite3-multiple-ciphers";

const DB_BASE_KEY = Buffer.from([
    0xF1, 0x70, 0xCE, 0xA4, 0xDF, 0xCE, 0xA3, 0xE1,
    0xA5, 0xD8, 0xC7, 0x0B, 0xD1, 0x00, 0x00, 0x00
]);
const DB_KEY = Buffer.from([
    0x6D, 0x5B, 0x65, 0x33, 0x63, 0x36,
    0x63, 0x25, 0x54, 0x71, 0x2D, 0x73,
    0x50, 0x53, 0x63, 0x38, 0x6D, 0x34,
    0x37, 0x7B, 0x35, 0x63, 0x70, 0x23,
    0x37, 0x34, 0x53, 0x29, 0x73, 0x43,
    0x36, 0x33
]);

function deriveDecryptionKey(keyHex: string, baseKeyHex: string): Buffer {
    const key = Buffer.from(keyHex, "hex");
    const baseKey = Buffer.from(baseKeyHex, "hex");

    if (baseKey.length < 13) {
        throw new Error("Invalid Base Key length. Must be at least 13 bytes.");
    }

    const finalKey = Buffer.alloc(key.length);
    for (let i = 0; i < key.length; i++) {
        finalKey[i] = key[i] ^ baseKey[i % 13];
    }
    return finalKey;
}

export class SqlDatabase implements IDatabase {
    private db: BSqlite.Database;

    constructor(dbPath: string, callback: (err?: Error) => void) {
        try {
            this.db = new BSqlite(dbPath);

            if (path.basename(dbPath) === 'meta') {
                const decryptionKey = deriveDecryptionKey(DB_KEY.toString("hex"), DB_BASE_KEY.toString("hex"));
                this.db.pragma(`cipher='chacha20'`);
                this.db.key(decryptionKey);
                this.db.pragma("quick_check");
            }
            
            callback();
        } catch (err) {
            callback(err as Error);
        }
    }

    execute(sql: string, callback?: (rows: string[][], err?: Error) => void): void {
        if (!callback) return;
        
        try {
            const stmt = this.db.prepare(sql);

            if (stmt.reader) {
                const columns = stmt.columns().map(c => c.name);
                const dataRows = stmt.raw().all() as string[][];
                callback([columns, ...dataRows]);
            } else {
                stmt.run();
                callback([]);
            }
        } catch (err) {
            callback([], err as Error);
        }
    }

    close(callback: (err?: Error) => void): void {
        try {
            if (this.db && this.db.open) {
                this.db.close();
            }
            callback();
        } catch (err) {
            callback(err as Error);
        }
    }
}
