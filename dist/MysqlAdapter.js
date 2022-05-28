"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlDBTask = exports.MysqlDBContext = void 0;
const uuid_1 = require("uuid");
const log4js_1 = __importDefault(require("log4js"));
const toUnnamed = require('named-placeholders')();
class MysqlDBContext {
    constructor(connPool) {
        this.txn = undefined;
        this.logger = log4js_1.default.getLogger("MultiTxnMngr");
        this.connPool = connPool;
        this.contextId = (0, uuid_1.v1)();
    }
    init() {
        return new Promise((resolve, reject) => {
            if (this.isInitialized()) {
                reject("Context already initialised.");
            }
            else {
                try {
                    this.connPool.getConnection((err1, connection) => {
                        if (err1) {
                            reject(err1);
                        }
                        else {
                            this.txn = connection;
                            resolve(this);
                        }
                    });
                }
                catch (err) {
                    reject(err);
                }
            }
        });
    }
    commit() {
        return new Promise((resolve, reject) => {
            var _a;
            if (!this.isInitialized()) {
                reject("Cannot commit. Context not initialised.");
            }
            else {
                (_a = this.txn) === null || _a === void 0 ? void 0 : _a.commit((err) => {
                    var _a;
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.logger.debug(this.getName() + " is committed.");
                        resolve(this);
                    }
                    // todo: error handling??
                    (_a = this.txn) === null || _a === void 0 ? void 0 : _a.release();
                    this.txn = undefined;
                });
            }
        });
    }
    rollback() {
        return new Promise((resolve, reject) => {
            var _a;
            if (!this.isInitialized()) {
                reject("Cannot rollback. Context not initialised.");
            }
            else {
                (_a = this.txn) === null || _a === void 0 ? void 0 : _a.rollback((err) => {
                    var _a;
                    if (err) {
                        reject(err);
                    }
                    else {
                        this.logger.debug(this.getName() + " is rollbacked.");
                        resolve(this);
                    }
                    // todo: error handling??
                    (_a = this.txn) === null || _a === void 0 ? void 0 : _a.release();
                    this.txn = undefined;
                });
            }
        });
    }
    isInitialized() {
        return this.txn != undefined;
    }
    getName() {
        return "MYSQL DB Context: " + this.contextId;
    }
    getTransaction() {
        if (!this.txn)
            throw new Error("Transaction not initialised!");
        return this.txn;
    }
    addTask(txnMngr, querySql, params) {
        const task = new MysqlDBTask(this, querySql, params, undefined);
        txnMngr.addTask(task);
    }
    addFunctionTask(txnMngr, execFunc) {
        const task = new MysqlDBTask(this, "", undefined, execFunc);
        txnMngr.addTask(task);
    }
}
exports.MysqlDBContext = MysqlDBContext;
class MysqlDBTask {
    constructor(context, querySql, params, execFunc) {
        this.context = context;
        this.querySql = querySql;
        if (params)
            this.params = params;
        if (execFunc)
            this.execFunc = execFunc;
    }
    getContext() {
        return this.context;
    }
    exec() {
        return new Promise((resolveTask, rejectTask) => {
            if (this.execFunc) {
                this.execFunc(this.getContext().getTransaction(), this).then((res) => {
                    this.rs = res;
                    resolveTask(this);
                }).catch((err) => {
                    rejectTask(err);
                });
            }
            else {
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
                    }
                    else {
                        this.rs = { results, fields };
                        resolveTask(this);
                    }
                });
            }
        });
    }
    setParams(params) {
        this.params = params;
    }
    getResult() {
        return this.rs;
    }
}
exports.MysqlDBTask = MysqlDBTask;
