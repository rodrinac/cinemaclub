package tech.kaomidev.cinemaclub.database

import androidx.room.Database
import androidx.room.RoomDatabase
import tech.kaomidev.cinemaclub.data.genre.Genre

@Database(entities = [Genre::class], version = 2, exportSchema = false)
abstract class DatabaseController : RoomDatabase() {

    abstract fun genreDao(): GenreDao
}