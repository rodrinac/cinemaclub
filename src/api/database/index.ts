import * as SQLite from 'expo-sqlite';
import { TmdbMovie } from '../tmdb';

class Database {
  private connection = SQLite.openDatabase('CinemaClub');

  constructor() {
    this.connection.exec([{ sql: 'PRAGMA foreign_keys = ON;', args: [] }], false, () => console.log('Foreign keys turned on'));
  
    this.initDB();
  }

  private initDB() {
    const sql = [
      `DROP TABLE IF EXISTS movie_bookmark;`,
      `CREATE TABLE IF NOT EXISTS movie_bookmark (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movie INT UNIQUE NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS movie_filter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        genre STRING UNIQUE NOT NULL,
        filter STRING NOT NULL
      );`
    ];

    this.connection.transaction(tx => sql.forEach(query => tx.executeSql(query)));
  }

  public existsBookmark(movie: TmdbMovie): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.connection.transaction(tx => {
        tx.executeSql(`select * from movie_bookmark where movie =?`, [movie.id], (_, { rows }) => {
          resolve(rows.length === 1);
        });
      }, reject);
    });    
  }

  public async addBookmark(movie: TmdbMovie): Promise<any> {
    const exists = await this.existsBookmark(movie);

    return new Promise((resolve, reject) => {
      this.connection.transaction(tx => {
        if (!exists) {
          tx.executeSql(`insert into movie_bookmark (movie) values(?)`, [movie.id], (_, { rows }) => {
            resolve(rows.item(0));
          });
        }
      }, reject);
    });
  }

  public removeBookmark(movie: TmdbMovie): Promise<any> {
   
    return new Promise((resolve, reject) => {
      this.connection.transaction(tx => {
        this.connection.transaction(tx => {
          tx.executeSql(`delete from movie_bookmark where movie =?`, [movie.id], (_, { rows }) => {
            resolve(rows.item(0));
          });
        }, reject);
      });
    });
  }
}


export default new Database();