import log4js from "log4js";
import { Pool, PoolConnection } from "mysql";
import { Context, MultiTxnMngr, Task } from "multiple-transaction-manager";
declare class MysqlDBContext implements Context {
    connPool: Pool;
    txn: PoolConnection | undefined;
    contextId: string;
    logger: log4js.Logger;
    constructor(connPool: Pool);
    init(): Promise<Context>;
    commit(): Promise<Context>;
    rollback(): Promise<Context>;
    isInitialized(): boolean;
    getName(): string;
    getTransaction(): PoolConnection;
    addTask(txnMngr: MultiTxnMngr, querySql: string, params?: any | undefined): void;
    addFunctionTask(txnMngr: MultiTxnMngr, execFunc: ((txn: PoolConnection, task: Task) => Promise<any | undefined>) | undefined): void;
}
declare class MysqlDBTask implements Task {
    params: any;
    context: MysqlDBContext;
    querySql: string;
    rs: any | undefined;
    execFunc: ((txn: PoolConnection, task: Task) => Promise<any | undefined>) | undefined;
    constructor(context: MysqlDBContext, querySql: string, params: any, execFunc: ((txn: PoolConnection, task: Task) => Promise<any | undefined>) | undefined);
    getContext(): MysqlDBContext;
    exec(): Promise<Task>;
    setParams(params: any): void;
    getResult(): any | undefined;
}
export { MysqlDBContext, MysqlDBTask };
