import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const playgroundState=sqliteTable('playground_state',{id:text('id').primaryKey(),revision:integer('revision').notNull().default(0),value:text('value').notNull()});
