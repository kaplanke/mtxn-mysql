import log4js from "log4js";
import mysql from "mysql";
import { MultiTxnMngr, FunctionContext, Task } from "multiple-transaction-manager";
import { MysqlDBContext } from "../src/index";

log4js.configure({
    appenders: { 'out': { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});
const logger = log4js.getLogger();

const pool = mysql.createPool({
    connectionLimit: 3,
    host: "localhost",
    user: "root",
    password: "1q2w3e4r",
    database: "mtxnmngr"
});

describe("Multiple transaction manager mysql workflow test...", () => {

    beforeAll(() => { global.console = require('console'); });

    test("Success-commit case", async () => {

        // init manager
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();

        const mysqlContext = new MysqlDBContext(pool);

        // Add first step
        mysqlContext.addTask(txnMngr, "DELETE FROM test_table");

        // Add second step
        mysqlContext.addTask(txnMngr, "INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Dave" });

        // Add third step
        FunctionContext.addTask(txnMngr,
            (task) => { return new Promise((resolve, reject) => { console.log("All done."); resolve(task); }); },
            null, // optional params
            (task) => { return new Promise((resolve, reject) => { console.log("Committing..."); resolve(task); }); },
            (task) => { return new Promise((resolve, reject) => { console.log("Rolling back..."); resolve(task); }); }
        );


        await expect(txnMngr.exec()).resolves.not.toBeNull();

    });


    test("Fail-rollback case", async () => {

        // init manager
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();

        const mysqlContext = new MysqlDBContext(pool);

        // Add first step
        mysqlContext.addTask(txnMngr, "DELETE FROM test_table");

        // Add second step
        mysqlContext.addTask(txnMngr, "INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Dave" });

        // Add third step -> Causes primary key violation
        mysqlContext.addTask(txnMngr, "INSERT INTO test_table(id, name) VALUES (:id, :name)", { "id": 1, "name": "Kevin" });

        // Add last step -> should not execute
        FunctionContext.addTask(txnMngr,
            (task) => { return new Promise((resolve, reject) => { console.log("All done."); resolve(task); }); },
            null, // optional params
            (task) => { return new Promise((resolve, reject) => { console.log("Committing..."); resolve(task); }); },
            (task) => { return new Promise((resolve, reject) => { console.log("Rolling back..."); resolve(task); }); }
        );


        await expect(txnMngr.exec()).rejects.not.toBeNull();

    });

    test("Function task example", async () => {

        // init manager
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();

        const mysqlContext = new MysqlDBContext(pool);

        // Add first step
        mysqlContext.addTask(txnMngr, "DELETE FROM test_table");

        // Add second step
        mysqlContext.addFunctionTask(txnMngr,
            (txn, task) => {
                return new Promise<any | undefined>((resolve, reject) => {
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
        mysqlContext.addTask(txnMngr, "SELECT * FROM test_table");

        const tasks:Task[] = await txnMngr.exec();
        
        expect(tasks[2].getResult().results[0]["name"]).toEqual("Stuart");
    });


    afterAll(() => { pool.end(); });

});