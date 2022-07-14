import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import log4js from "log4js";
import { FunctionContext, MultiTxnMngr, Task } from "multiple-transaction-manager";
import mysql from "mysql2";
import { MysqlDBContext } from "../src/index";

log4js.configure({
    appenders: { 'out': { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});

const pool = mysql.createPool({
    connectionLimit: 3,
    host: "localhost",
    user: "root",
    password: "changeme",
    database: "mtxnmngr"
});

describe("Multiple transaction manager mysql workflow test...", () => {

    beforeAll(() => { global.console = require('console'); });

    test("Success-commit case", async () => {

        // init manager & context
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();
        const mysqlContext = new MysqlDBContext(txnMngr, pool);
        const functionContext = new FunctionContext(txnMngr);

        // Add first step
        mysqlContext.addTask("DELETE FROM test_table");

        // Add second step
        mysqlContext.addTask("INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Dave" });

        // Add third step
        functionContext.addTask(
            (task) => { return new Promise((resolve, _reject) => { console.log("All done."); resolve(task); }); },
            null, // optional params
            (task) => { return new Promise((resolve, _reject) => { console.log("Committing..."); resolve(task); }); },
            (task) => { return new Promise((resolve, _reject) => { console.log("Rolling back..."); resolve(task); }); }
        );

        await expect(txnMngr.exec()).resolves.not.toBeNull();

    });


    test("Fail-rollback case", async () => {

        // init manager & context
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();
        const mysqlContext = new MysqlDBContext(txnMngr, pool);
        const functionContext = new FunctionContext(txnMngr);

        // Add first step
        mysqlContext.addTask("DELETE FROM test_table");

        // Add second step
        mysqlContext.addTask("INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Dave" });

        // Add third step -> Causes primary key violation
        mysqlContext.addTask("INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Kevin" });

        // Add last step -> should not execute
        functionContext.addTask(
            (task) => { return new Promise((resolve, _reject) => { console.log("Face the thing that should not be..."); resolve(task); }); }
        );

        await expect(txnMngr.exec()).rejects.not.toBeNull();

    });

    test("Function task example", async () => {

        // init manager & context
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();
        const mysqlContext = new MysqlDBContext(txnMngr, pool);

        // Add first step
        mysqlContext.addTask("DELETE FROM test_table");

        // Add second step
        mysqlContext.addFunctionTask(
            (txn, _task) => {
                return new Promise<unknown | undefined>((resolve, reject) => {
                    txn.query("INSERT INTO test_table(id, name) VALUES (1, 'Stuart')", null, (err, results, fields) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve({ results, fields });
                        }
                    });
                });
            });

        // Add control step
        const controlTask: Task = mysqlContext.addTask("SELECT * FROM test_table");

        await txnMngr.exec();

        expect(controlTask.getResult().results[0]["name"]).toEqual("Stuart");
    });

    afterAll(() => { pool.end(); });

});