/*
    Originally a part of AlexCovizzi/vscode-sqlite
    Licensed under Apache License 2.0

    Modified for ZokuZoku
*/

import { workspace } from "vscode";
import { ResultSet } from "./common";
import { executeQuery, QueryExecutionOptions } from "./queryExecutor";
import { join } from "path";
import config from "../config";

class SQLite {
    private extensionPath: string;
    private mdbPath?: string;
    private metaPath?: string;

    constructor(extensionPath: string, mdbPath?: string, metaPath?: string) {
        this.extensionPath = extensionPath;
        this.mdbPath = mdbPath;
        this.metaPath = metaPath;
    }

    private static _instance?: SQLite;
    static init(extensionPath: string) {
        let gameDataDir = config().get<string>("gameDataDir");
        let mdbPath = gameDataDir ? join(gameDataDir, "master", "master.mdb") : undefined;
        let metaPath = gameDataDir ? join(gameDataDir, "meta") : undefined;
        this._instance = new SQLite(extensionPath, mdbPath, metaPath);
    }

    static get instance(): SQLite {
        return this._instance!;
    }

    async query(dbPath: string, query: string, options?: QueryExecutionOptions): Promise<ResultSet> {
        const queryRes = await executeQuery(dbPath, query, options);
        if (queryRes.error) {
            throw queryRes.error;
        }
        return queryRes.resultSet!;
    }

    queryMdb(query: string, options?: QueryExecutionOptions): Promise<ResultSet> {
        if (!this.mdbPath) {
            throw new Error("Query cannot be performed because the game data directory is not set.");
        }
        return this.query(this.mdbPath, query, options);
    }

    queryMeta(query: string, options?: QueryExecutionOptions): Promise<ResultSet> {
        if (!this.metaPath) {
            throw new Error("Query cannot be performed because the game data directory is not set.");
        }
        return this.query(this.metaPath, query, options);
    }

    async loadMdbTable(tableName: MdbTableName) {
        const columns = MDB_TABLE_COLUMNS[tableName];
        const columnNames = columns.map(s => `"${s}"`).join(",");
        const orderByNames = columns.slice(0, -1).map(s => `"${s}"`).join(",");
        const queryRes = await SQLite.instance.queryMdb(
            `SELECT ${columnNames} FROM ${tableName} ORDER BY ${orderByNames}`
        );
        return queryRes[0].rows;
    }
}

export const MDB_TABLE_NAMES = ["text_data", "character_system_text", "race_jikkyo_comment", "race_jikkyo_message"] as const;
export type MdbTableName = (typeof MDB_TABLE_NAMES)[number];

export const MDB_TABLE_COLUMNS: {[K in MdbTableName]: string[]} = {
    "text_data": [ "category", "index", "text" ],
    "character_system_text": [ "character_id", "voice_id", "text" ],
    "race_jikkyo_comment": [ "id", "message" ],
    "race_jikkyo_message": [ "id", "message" ]
};

export function buildQueryExecutionOptions(setupDatabaseConfig: { [dbPath: string]: { sql: string[]; } }, dbPath: string): QueryExecutionOptions {
    if (!workspace.workspaceFolders) {
        return { sql: [] };
    }
    for (let configDbPath in setupDatabaseConfig) {
        if (join(workspace.workspaceFolders[0].uri.fsPath, configDbPath) === dbPath) {
            let sql = setupDatabaseConfig[configDbPath].sql;
            return { sql };
        }
    }
    return { sql: [] };
}

export interface QueryResult {resultSet?: ResultSet; error?: Error; }

export default SQLite;
