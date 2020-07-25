import * as SQLite from 'expo-sqlite';
import { TmdbMovie, TmdbGenre } from '../tmdb';

export enum GenreFilter {
  WITH_THESE,
  WITHOUT_THESE
}

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
      `CREATE TABLE IF NOT EXISTS genre_filter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        genre STRING UNIQUE NOT NULL,
        filter INT NOT NULL
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
        } else {
          resolve(null);
        }
      }, reject);
    });
  }

  public removeBookmark(movie: TmdbMovie): Promise<any> {
   
    return new Promise((resolve, reject) => {
      this.connection.transaction(tx => {
        this.connection.transaction(tx => {
          tx.executeSql(`DELETE FROM movie_bookmark WHERE movie = ?`, [movie.id], (_, { rows }) => {
            resolve(rows.item(0));
          });
        }, reject);
      });
    });
  }

  public async toggleGenreFilter(genre: TmdbGenre, filter: GenreFilter): Promise<any> {
    const hasGenreFilter = await this.hasGenreFilter(genre);

    return new Promise((resolve, reject) => {
      this.connection.transaction(tx => {
        if (hasGenreFilter) {
          tx.executeSql(`DELETE genre_filter WHERE id = ?`, [filter, genre.id], resolve);
        } else {
          tx.executeSql(`INSERT INTO genre_filter(genre, filter) VALUES(?, ?)`, [genre.id, filter], resolve);
        }
      }, reject);
    });
  }

  public async hasGenreFilter(genre: TmdbGenre): Promise<boolean> {
    
    return new Promise((resolve, reject) => {
      this.connection.transaction(tx => {
        tx.executeSql(`SELECT * FROM genre_filter WHERE genre = ?`, [genre.id], (_, { rows }) => {
          resolve(rows.length > 0);        
        });
      }, reject);
    });
  }

  public async getCurrentGenreFilter(): Promise<GenreFilter> {
    
    return new Promise((resolve, reject) => {
      this.connection.transaction(tx => {
        tx.executeSql(`SELECT * FROM genre_filter LIMIT 1`, [], (_, { rows }) => {
          resolve(rows.item(0)?.filter);        
        });
      }, reject);
    });
  }


  public async getGenreFilters(): Promise<number[]> {
    
    return new Promise((resolve, reject) => {
      this.connection.transaction(tx => {
        tx.executeSql(`SELECT * FROM genre_filter`, [], (_, { rows }) => {
          resolve(Array(rows.length).fill('0').map((_, i) => Number(rows.item(i).genre)));        
        });
      }, reject);
    });
  }

  public async setGenreFilter(filter: GenreFilter): Promise<any> {
    
    return new Promise((resolve, reject) => {
      this.connection.transaction(tx => {
        tx.executeSql(`UPDATE genre_filter SET filter = ?`, [filter], _ => resolve(null));
      }, reject);
    });
  }
}

export default new Database();