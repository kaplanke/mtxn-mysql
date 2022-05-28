import { v1 } from "uuid";
import log4js from "log4js";
import { Pool, PoolConnection } from "mysql";
import { Context, MultiTxnMngr, Task } from "multiple-transaction-manager";

const toUnnamed = require('named-placeholders')();

class MysqlDBContext implements Context {

    connPool: Pool;
    txn: PoolConnection | undefined = undefined;
    contextId: string;
    logger = log4js.getLogger("MultiTxnMngr");

    constructor(connPool: Pool) {
        this.connPool = connPool;
        this.contextId = v1();
    }

    init(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (this.isInitialized()) {
                reject("Context already initialised.");
            } else {
                try {
                    this.connPool.getConnection((err1, connection) => {
                        if (err1) {
                            reject(err1);
                        } else {
                            this.txn = connection;
                            resolve(this);
                        }
                    });
                } catch (err) {
                    reject(err);
                }
            }
        });
    }

    commit(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized()) {
                reject("Cannot commit. Context not initialised.");
            } else {
                this.txn?.commit((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.logger.debug(this.getName() + " is committed.");
                        resolve(this);
                    }
                    // todo: error handling??
                    this.txn?.release();
                    this.txn = undefined;
                });
            }
        });
    }

    rollback(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized()) {
                reject("Cannot rollback. Context not initialised.");
            } else {
                this.txn?.rollback((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.logger.debug(this.getName() + " is rollbacked.");
                        resolve(this);
                    }
                    // todo: error handling??
                    this.txn?.release();
                    this.txn = undefined;
                });
            }
        });
    }

    isInitialized(): boolean {
        return this.txn != undefined;
    }

    getName(): string {
        return "MYSQL DB Context: " + this.contextId;
    }

    getTransaction(): PoolConnection {
        if (!this.txn)
            throw new Error("Transaction not initialised!");
        return this.txn;
    }

    addTask(txnMngr: MultiTxnMngr, querySql: string, params?: any | undefined) {
        const task = new MysqlDBTask(this, querySql, params, undefined);
        txnMngr.addTask(task);
    }

    addFunctionTask(txnMngr: MultiTxnMngr,
        execFunc: ((txn: PoolConnection, task: Task) => Promise<any | undefined>) | undefined) {
        const task = new MysqlDBTask(this, "", undefined, execFunc);
        txnMngr.addTask(task);
    }
}

class MysqlDBTask implements Task {
    params: any;
    context: MysqlDBContext;
    querySql: string;
    rs: any | undefined; // {any, FieldInfo[]}
    execFunc: ((txn: PoolConnection, task: Task) => Promise<any | undefined>) | undefined;

    constructor(context: MysqlDBContext,
        querySql: string,
        params: any,
        execFunc: ((txn: PoolConnection, task: Task) => Promise<any | undefined>) | undefined) {
        this.context = context;
        this.querySql = querySql;
        if (params)
            this.params = params;
        if (execFunc)
            this.execFunc = execFunc;
    }

    getContext(): MysqlDBContext {
        return this.context;
    }

    exec(): Promise<Task> {
        return new Promise<Task>((resolveTask, rejectTask) => {
            if (this.execFunc) {
                this.execFunc(this.getContext().getTransaction(), this).then((res) => {
                    this.rs = res;
                    resolveTask(this);
                }).catch((err) => {
                    rejectTask(err);
                });
            } else {
                let params = [];
                if (this.params) {
                    if (this.params instanceof Function)
                        params = this.params();
                    else
                        params = this.params;
                }
                var q = toUnnamed(this.querySql, params);
                this.getContext().getTransaction().query(q[0], q[1], (err, results, fields) => {
                    if (err) {
                        rejectTask(err);
                    } else {
                        this.rs = { results, fields };
                        resolveTask(this);
                    }
                });
            }
        });
    }

    setParams(params: any) {
        this.params = params;
    }

    getResult(): any | undefined {
        return this.rs;
    }

}

export { MysqlDBContext, MysqlDBTask };