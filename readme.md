# @multiple-transaction-manager/mysql

> MySql context implementation for multiple-transaction-manager library. 

## API

### Classes

#### __MysqlDBContext__

####  `constructor(txnMngr, connPool)`
-   `txnMngr`: _{MultiTxnMngr}_ The multiple transaction manager to to bind with the context.
-   `connPool`: _{Pool}_ The MySql connection pool obtain the session from.
-   Returns: {MysqlDBContext} The created _MysqlDBContext_ instance.

#### `addFunctionTask(execFunc)`

Adds a task to the transaction manager.

-   `execFunc`: _{execFunc: (txn: PoolConnection, task: Task) => Promise<unknown | undefined>) | undefined}_ The function to be executes in promise. MySql connection is provided to the function.
-   Returns: {MysqlDBTask} Returns the created _MysqlDBTask_ instance.

#### `addTask(querySql: string, params?: unknown | undefined)`

A shortcut to add a SQL task to the transaction manager.

-   `querySql`: _{string}_ The query string to be executes in promise.
-   `params`: _{unknown | undefined}_ Optional parameter object to bind SQL statement variables.
-   Returns: {MysqlDBTask} The created _MysqlDBTask_ instance.


#### __MysqlDBTask__

####  `constructor(context, querySql, params, execFunc)`
-   `context`: _{MysqlDBContext}_ The _MysqlDBContext_ to to bind with the task.
-   `querySql`: _{string}_ The query string to be executes in promise. __Ignored if execFunc parameter is provided__.
-   `params`: _{unknown | undefined}_ Optional parameter object to bind SQL statement variables. __Ignored if execFunc parameter is provided__.
-   `execFunc`: _{execFunc: (txn: PoolConnection, task: Task) => Promise<unknown | undefined>) | undefined}_  The function to be executes in promise. MySql connection is provided to the function.
-   Returns: {MysqlDBTask} The created _MysqlDBTask_ instance.

## Example

https://github.com/kaplanke/mtxn-mysql/blob/master/test/mtxn.mysql.test.ts

```js

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
```
