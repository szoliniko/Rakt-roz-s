// SQLite operations stay synchronous inside the warehouse coordination object.
// transactionSync rolls back the inventory, history and command ID together.
export function cloudflareDatabase(storage) {
  return {
    exec(sql){storage.sql.exec(sql).toArray();},
    prepare(sql){return {
      get(...params){return storage.sql.exec(sql,...params).toArray()[0];},
      all(...params){return storage.sql.exec(sql,...params).toArray();},
      run(...params){const cursor=storage.sql.exec(sql,...params);cursor.toArray();return {changes:cursor.rowsWritten};}
    };},
    close(){}
  };
}
