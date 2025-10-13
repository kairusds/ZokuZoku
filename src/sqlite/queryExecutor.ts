import { SqlDatabase } from "./sqliteDatabase";
import { Database } from "./interfaces/database";
import { extractStatements } from "./queryParser";
import { ResultSet } from "./common";
import { Statement } from "./interfaces/statement";
import { QueryResult } from ".";

export interface QueryExecutionOptions {
    sql: string[]; // sql to execute before executing the query (e.g ATTACH DATABASE <path>; PRAGMA foreign_keys = ON; ecc)
}

export function executeQuery(dbPath: string, query: string, options: QueryExecutionOptions = {sql: []}): Promise<QueryResult> {
    return new Promise((resolve) => {
        let statements: Statement[];
        try {
            statements = extractStatements(query);
        } catch (err) {
            resolve({ error: new Error(`Unable to execute query: ${(err as Error).message}`) });
            return;
        }

        let resultSet: ResultSet = [];
        let error: Error | undefined;

        const database: Database = new SqlDatabase(dbPath, (err) => {
            if (err) {
                error = err;
                resolve({ resultSet, error });
                return;
            }
            
            const tasks: ((cb: () => void) => void)[] = [];

            for (const sql of options.sql) {
                tasks.push((cb) => {
                    if (error) return cb();
                    database.execute(sql, (_rows, err) => {
                        if (err) {
                            error = new Error(`Failed to setup database: ${err.message}`);
                        }
                        cb();
                    });
                });
            }

            for (const statement of statements) {
                tasks.push((cb) => {
                    if (error) return cb();
                    database.execute(statement.sql, (rows, err) => {
                        if (err) {
                            error = err;
                        } else {
                            let header = rows.length > 0 ? (rows.shift() || []) : [];
                            resultSet.push({ stmt: statement.sql, header: header!, rows });
                        }
                        cb();
                    });
                });
            }
            
            let currentTask = 0;
            const runNextTask = () => {
                if (currentTask >= tasks.length || error) {
                    database.close(() => {
                        resolve({ resultSet, error });
                    });
                    return;
                }
                const task = tasks[currentTask];
                currentTask++;
                task(runNextTask);
            };

            runNextTask();
        });
    });
}
